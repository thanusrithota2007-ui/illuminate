-- Row Level Security and privileges. Grants are deliberately narrow: Supabase grants broad default privileges on public tables,
-- so we revoke first and re-grant only what each role needs. Column grants stop clients from setting server-controlled columns.

alter table public.profiles enable row level security;
alter table public.story_categories enable row level security;
alter table public.stories enable row level security;
alter table public.story_category_assignments enable row level security;
alter table public.time_capsule_letters enable row level security;
alter table public.skin_analysis_sessions enable row level security;
alter table public.demo_community_profiles enable row level security;
alter table public.demo_community_responses enable row level security;

revoke all on public.profiles, public.story_categories, public.stories, public.story_category_assignments,
  public.time_capsule_letters, public.skin_analysis_sessions, public.demo_community_profiles,
  public.demo_community_responses, public.public_stories from anon, authenticated;

-- Categories and the synthetic demo community: world-readable, writable by nobody except the service role / migrations.
grant select on public.story_categories, public.demo_community_profiles, public.demo_community_responses to anon, authenticated;
drop policy if exists categories_read on public.story_categories;
create policy categories_read on public.story_categories for select to anon, authenticated using (true);
drop policy if exists demo_profiles_read on public.demo_community_profiles;
create policy demo_profiles_read on public.demo_community_profiles for select to anon, authenticated using (is_demo_data);
drop policy if exists demo_responses_read on public.demo_community_responses;
create policy demo_responses_read on public.demo_community_responses for select to anon, authenticated using (is_demo_data);
grant execute on function public.demo_similarity(text[]) to anon, authenticated;

-- Public stories are read through the public_stories view (published only, no author_id, anonymity respected).
grant select on public.public_stories to anon, authenticated;

-- profiles: own row only. display_name / avatar_url are the only editable columns.
grant select on public.profiles to authenticated;
grant insert (id, display_name, avatar_url) on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- stories: authors manage their own non-demo rows. author_id is filled by its auth.uid() default and cannot be updated.
grant select on public.stories to authenticated;
grant insert (title, content, status, is_anonymous) on public.stories to authenticated;
grant update (title, content, status, is_anonymous) on public.stories to authenticated;
grant delete on public.stories to authenticated;
drop policy if exists stories_select_own on public.stories;
create policy stories_select_own on public.stories for select to authenticated using (author_id = (select auth.uid()));
drop policy if exists stories_insert_own on public.stories;
create policy stories_insert_own on public.stories for insert to authenticated
  with check (author_id = (select auth.uid()) and not is_demo_content and slug is null);
drop policy if exists stories_update_own on public.stories;
create policy stories_update_own on public.stories for update to authenticated
  using (author_id = (select auth.uid()) and not is_demo_content)
  with check (author_id = (select auth.uid()) and not is_demo_content);
drop policy if exists stories_delete_own on public.stories;
create policy stories_delete_own on public.stories for delete to authenticated
  using (author_id = (select auth.uid()) and not is_demo_content);

-- story_category_assignments: authors may read and edit the topics of their own stories only.
grant select, insert, delete on public.story_category_assignments to authenticated;
drop policy if exists assignments_select_own on public.story_category_assignments;
create policy assignments_select_own on public.story_category_assignments for select to authenticated
  using (exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid())));
drop policy if exists assignments_insert_own on public.story_category_assignments;
create policy assignments_insert_own on public.story_category_assignments for insert to authenticated
  with check (exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid()) and not s.is_demo_content));
drop policy if exists assignments_delete_own on public.story_category_assignments;
create policy assignments_delete_own on public.story_category_assignments for delete to authenticated
  using (exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid()) and not s.is_demo_content));

-- time_capsule_letters: sealed until unlock_at. The content column is NOT selectable; read it with open_letter().
grant select (id, user_id, title, unlock_at, created_at, updated_at, opened_at) on public.time_capsule_letters to authenticated;
grant insert (title, content, unlock_at) on public.time_capsule_letters to authenticated;
grant delete on public.time_capsule_letters to authenticated;
drop policy if exists letters_select_own on public.time_capsule_letters;
create policy letters_select_own on public.time_capsule_letters for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists letters_insert_own on public.time_capsule_letters;
create policy letters_insert_own on public.time_capsule_letters for insert to authenticated
  with check (user_id = (select auth.uid()) and unlock_at > now());
drop policy if exists letters_delete_own on public.time_capsule_letters;
create policy letters_delete_own on public.time_capsule_letters for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.open_letter(p_letter_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.time_capsule_letters%rowtype;
begin
  select * into v from public.time_capsule_letters l where l.id = p_letter_id and l.user_id = auth.uid();
  if not found then raise exception 'Letter not found' using errcode = 'P0002'; end if;
  if v.unlock_at > now() then raise exception 'This letter is sealed until %', v.unlock_at using errcode = 'P0001'; end if;
  update public.time_capsule_letters set opened_at = coalesce(time_capsule_letters.opened_at, now()) where time_capsule_letters.id = v.id;
  return jsonb_build_object('id', v.id, 'title', v.title, 'content', v.content, 'unlock_at', v.unlock_at, 'opened_at', coalesce(v.opened_at, now()));
end $$;
revoke all on function public.open_letter(uuid) from public, anon;
grant execute on function public.open_letter(uuid) to authenticated;

-- skin_analysis_sessions: optional private history, owner only.
grant select, delete on public.skin_analysis_sessions to authenticated;
grant insert (analysis_results) on public.skin_analysis_sessions to authenticated;
drop policy if exists skin_sessions_select_own on public.skin_analysis_sessions;
create policy skin_sessions_select_own on public.skin_analysis_sessions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists skin_sessions_insert_own on public.skin_analysis_sessions;
create policy skin_sessions_insert_own on public.skin_analysis_sessions for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists skin_sessions_delete_own on public.skin_analysis_sessions;
create policy skin_sessions_delete_own on public.skin_analysis_sessions for delete to authenticated using (user_id = (select auth.uid()));
