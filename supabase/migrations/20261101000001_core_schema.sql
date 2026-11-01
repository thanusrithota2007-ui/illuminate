-- Illuminate core schema (Supabase / PostgreSQL 14+). Additive only: nothing here drops or alters existing data.
-- Tables: profiles, story_categories, stories, story_category_assignments, time_capsule_letters,
--         skin_analysis_sessions, demo_community_profiles, demo_community_responses.

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- A. profiles: one row per Supabase Auth user. No passwords or emails here; Supabase Auth owns credentials.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 60),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Create a profile automatically when someone registers.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(btrim(left(new.raw_user_meta_data ->> 'display_name', 60)), ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- C. story_categories: stable slugs, display names may change.
create table if not exists public.story_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- B. stories: public stories and private drafts. author_id is null only for synthetic demo stories.
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text unique,                                   -- stable id for curated demo stories; null for user stories
  author_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  content text not null check (char_length(btrim(content)) between 20 and 5000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_anonymous boolean not null default false,
  is_demo_content boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint stories_author_or_demo check (is_demo_content or author_id is not null),
  constraint stories_demo_has_no_author check (not is_demo_content or author_id is null),
  constraint stories_published_has_date check (status <> 'published' or published_at is not null)
);
create or replace function public.stories_before_write() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and new.published_at is null then new.published_at = now(); end if;
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists stories_before_write on public.stories;
create trigger stories_before_write before insert or update on public.stories for each row execute function public.stories_before_write();
create index if not exists stories_published_idx on public.stories (published_at desc) where status = 'published';
create index if not exists stories_author_idx on public.stories (author_id, updated_at desc);

-- D. story_category_assignments: a story can belong to several topics (no denormalised category column).
create table if not exists public.story_category_assignments (
  story_id uuid not null references public.stories (id) on delete cascade,
  category_id uuid not null references public.story_categories (id) on delete cascade,
  primary key (story_id, category_id)
);
create index if not exists story_category_assignments_category_idx on public.story_category_assignments (category_id, story_id);

-- E. time_capsule_letters: private letters to a future self. Content is only readable through open_letter().
create table if not exists public.time_capsule_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  unlock_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opened_at timestamptz,
  constraint letters_unlock_after_create check (unlock_at > created_at)
);
create index if not exists letters_user_idx on public.time_capsule_letters (user_id, unlock_at);

-- F. skin_analysis_sessions: OPTIONAL private history. Stores parsed concern scores only, never the photo.
create table if not exists public.skin_analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  analysis_results jsonb not null check (jsonb_typeof(analysis_results) = 'object' and octet_length(analysis_results::text) <= 20000),
  created_at timestamptz not null default now()
);
create index if not exists skin_sessions_user_idx on public.skin_analysis_sessions (user_id, created_at desc);

-- G/H. Synthetic demonstration community. Fabricated identifiers only; no Supabase Auth users are created.
-- A profile "reports a similar concern" when a row exists in demo_community_responses (presence is the indicator).
create table if not exists public.demo_community_profiles (
  id uuid primary key default gen_random_uuid(),
  synthetic_id text not null unique check (synthetic_id ~ '^DEMO-[0-9]{4}$'),
  is_demo_data boolean not null default true check (is_demo_data),
  eligible_for_demo_calculation boolean not null default true,   -- consent-style flag; false rows are excluded from the denominator
  created_at timestamptz not null default now()
);
create table if not exists public.demo_community_responses (
  id uuid primary key default gen_random_uuid(),
  demo_profile_id uuid not null references public.demo_community_profiles (id) on delete cascade,
  category_id uuid not null references public.story_categories (id) on delete cascade,
  is_demo_data boolean not null default true check (is_demo_data),
  created_at timestamptz not null default now(),
  unique (demo_profile_id, category_id)
);
create index if not exists demo_responses_category_idx on public.demo_community_responses (category_id, demo_profile_id);

-- Similarity methodology (documented in README): percent = matching eligible demo profiles / all eligible demo profiles * 100.
-- A profile matches when it reported at least one of the given topics. Independent of any facial or YouCam data.
create or replace function public.demo_similarity(p_category_slugs text[])
returns table (eligible_total integer, matching integer, percent numeric)
language sql stable set search_path = public as $$
  with eligible as (
    select id from demo_community_profiles where eligible_for_demo_calculation and is_demo_data
  ), matched as (
    select distinct r.demo_profile_id
    from demo_community_responses r
    join eligible e on e.id = r.demo_profile_id
    join story_categories c on c.id = r.category_id
    where c.slug = any (p_category_slugs)
  )
  select (select count(*) from eligible)::integer,
         (select count(*) from matched)::integer,
         case when (select count(*) from eligible) = 0 then 0
              else round(100.0 * (select count(*) from matched) / (select count(*) from eligible), 1) end;
$$;

-- Public read model for stories. Runs with the view owner's rights on purpose, so that anonymous visitors never touch the
-- base table: it exposes only published rows, never author_id, and hides the author name for anonymous/demo stories.
create or replace view public.public_stories as
select s.id, s.slug, s.title, s.content, s.is_demo_content, s.is_anonymous, s.published_at, s.created_at,
       case when s.is_anonymous or s.is_demo_content then null else p.display_name end as author_display_name,
       coalesce((select array_agg(c.slug order by c.sort_order)
                 from public.story_category_assignments a join public.story_categories c on c.id = a.category_id
                 where a.story_id = s.id), '{}'::text[]) as category_slugs
from public.stories s
left join public.profiles p on p.id = s.author_id
where s.status = 'published';
