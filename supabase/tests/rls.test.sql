\set ON_ERROR_STOP on
\set alice '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set bob   '''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''

create schema t; create table t.results (name text, ok boolean, detail text);
create function t.log(n text, ok boolean, d text default '') returns void language sql security definer as $$ insert into t.results values (n, ok, d) $$;
-- denied(): the statement must raise an error (permission denied, RLS violation, constraint ...)
create function t.denied(n text, q text) returns void language plpgsql as $$
begin begin execute q; perform t.log(n, false, 'statement succeeded but should have failed');
  exception when others then perform t.log(n, true, sqlerrm); end; end $$;
-- scalar(): single value of the query, compared as text
create function t.scalar(n text, q text, expected text) returns void language plpgsql as $$
declare v text; begin execute q into v; perform t.log(n, v is not distinct from expected, 'got ' || coalesce(v, 'NULL') || ', expected ' || expected); end $$;
-- dml(): number of rows a DML statement touched
create function t.dml(n text, q text, expected bigint) returns void language plpgsql as $$
declare c bigint; begin execute q; get diagnostics c = row_count; perform t.log(n, c = expected, 'rows ' || c || ', expected ' || expected); end $$;
grant usage on schema t to public;
grant execute on all functions in schema t to public;

-- ---------- fixtures (as table owner) ----------
insert into auth.users (id, raw_user_meta_data) values (:alice, '{"display_name":"Alice"}'), (:bob, '{"display_name":"Bob"}');
select t.scalar('registration trigger creates profile', $q$select display_name from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$, 'Alice');
select t.scalar('seed: 16 published demo stories', $q$select count(*) from public.stories where is_demo_content and status='published'$q$, '16');
select t.scalar('seed: 7 categories', $q$select count(*) from public.story_categories$q$, '7');
select t.scalar('seed: 120 synthetic profiles, 100 eligible', $q$select count(*) || '/' || count(*) filter (where eligible_for_demo_calculation) from public.demo_community_profiles$q$, '120/100');
select t.scalar('demo stories have no author', $q$select count(*) from public.stories where is_demo_content and author_id is not null$q$, '0');
select t.denied('constraint: demo story cannot have an author', $q$insert into public.stories (title, content, author_id, is_demo_content, status, published_at) values ('Bad demo','twenty characters of text here', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, 'published', now())$q$);
select t.denied('constraint: user story needs an author', $q$insert into public.stories (title, content) values ('Orphan','twenty characters of text here')$q$);
select t.scalar('public_stories has no author_id column', $q$select count(*) from information_schema.columns where table_name='public_stories' and column_name='author_id'$q$, '0');

-- ---------- anonymous visitor ----------
set role anon;
select t.scalar('anon reads published stories via view', $q$select count(*) from public.public_stories$q$, '16');
select t.denied('anon cannot read stories base table', $q$select * from public.stories$q$);
select t.denied('anon cannot read letters', $q$select id from public.time_capsule_letters$q$);
select t.denied('anon cannot read skin sessions', $q$select * from public.skin_analysis_sessions$q$);
select t.denied('anon cannot read profiles', $q$select * from public.profiles$q$);
select t.denied('anon cannot insert story', $q$insert into public.stories (title, content) values ('Nope','twenty characters of text here')$q$);
select t.scalar('anon can read categories', $q$select count(*) from public.story_categories$q$, '7');
select t.denied('anon cannot write categories', $q$insert into public.story_categories (slug, name) values ('x','X')$q$);
select t.denied('anon cannot write demo community', $q$delete from public.demo_community_profiles$q$);
select t.denied('anon cannot call open_letter', $q$select public.open_letter(gen_random_uuid())$q$);
select t.scalar('demo similarity (acne) derived from rows: 65 of 100', $q$select matching || '/' || eligible_total || '/' || percent from public.demo_similarity(array['acne'])$q$, '65/100/65.0');
reset role;

-- ---------- Alice (authenticated) ----------
select set_config('request.jwt.claim.sub', :alice, false);
set role authenticated;
select t.dml('alice creates a draft', $q$insert into public.stories (title, content, status) values ('Alice draft','A story that is long enough to pass the check.', 'draft')$q$, 1);
select t.denied('alice cannot set is_demo_content', $q$insert into public.stories (title, content, is_demo_content) values ('Fake demo','A story that is long enough to pass the check.', true)$q$);
select t.denied('alice cannot send author_id (impersonation)', $q$insert into public.stories (author_id, title, content) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Impersonated','A story that is long enough to pass the check.')$q$);
select t.denied('alice cannot set a slug / published_at directly', $q$insert into public.stories (title, content, published_at) values ('Backdated','A story that is long enough to pass the check.', now())$q$);
select t.scalar('alice sees her draft', $q$select count(*) from public.stories where title='Alice draft'$q$, '1');
select t.scalar('alice does NOT see demo rows in base table', $q$select count(*) from public.stories where is_demo_content$q$, '0');
select t.dml('alice assigns a topic to her story', $q$insert into public.story_category_assignments (story_id, category_id) select s.id, c.id from public.stories s, public.story_categories c where s.title='Alice draft' and c.slug='acne'$q$, 1);
select t.dml('alice cannot touch demo stories (update)', $q$update public.stories set title='Hijacked' where is_demo_content$q$, 0);
select t.dml('alice cannot touch demo stories (delete)', $q$delete from public.stories where is_demo_content$q$, 0);
select t.scalar('draft not public (alice, via view)', $q$select count(*) from public.public_stories where title='Alice draft'$q$, '0');
select t.dml('alice publishes', $q$update public.stories set status='published' where title='Alice draft'$q$, 1);
select t.scalar('published_at set by trigger', $q$select (published_at is not null)::text from public.stories where title='Alice draft'$q$, 'true');
select t.scalar('non-anonymous story shows author name', $q$select author_display_name from public.public_stories where title='Alice draft'$q$, 'Alice');
select t.dml('alice goes anonymous', $q$update public.stories set is_anonymous=true where title='Alice draft'$q$, 1);
select t.scalar('anonymous story hides author name', $q$select coalesce(author_display_name,'<hidden>') from public.public_stories where title='Alice draft'$q$, '<hidden>');
select t.denied('alice cannot reassign author_id', $q$update public.stories set author_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where title='Alice draft'$q$);
select t.scalar('alice reads own topics', $q$select count(*) from public.story_category_assignments$q$, '1');
-- letters
select t.dml('alice seals a letter', $q$insert into public.time_capsule_letters (title, content, unlock_at) values ('To me','Dear me, be kind.', now() + interval '30 days')$q$, 1);
select t.denied('letter must unlock in the future', $q$insert into public.time_capsule_letters (title, content, unlock_at) values ('Past','Dear me.', now() - interval '1 day')$q$);
select t.denied('letter content column is not selectable', $q$select content from public.time_capsule_letters$q$);
select t.scalar('alice lists her letters (metadata only)', $q$select count(*) from public.time_capsule_letters$q$, '1');
select t.denied('sealed letter cannot be opened early', $q$select public.open_letter(id) from public.time_capsule_letters$q$);
select t.denied('letters cannot be edited', $q$update public.time_capsule_letters set unlock_at = now() where true$q$);
-- skin sessions
select t.dml('alice saves a skin session', $q$insert into public.skin_analysis_sessions (analysis_results) values ('{"concerns":[{"type":"acne","label":"Acne","ui_score":70}]}')$q$, 1);
select t.denied('alice cannot save a session for another user', $q$insert into public.skin_analysis_sessions (user_id, analysis_results) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','{}')$q$);
select t.denied('skin session must be a JSON object', $q$insert into public.skin_analysis_sessions (analysis_results) values ('[1,2]')$q$);
-- profile
select t.dml('alice edits display name', $q$update public.profiles set display_name='Alice R' where id = auth.uid()$q$, 1);
select t.denied('alice cannot change her profile id', $q$update public.profiles set id = gen_random_uuid()$q$);
select t.scalar('alice sees only her own profile', $q$select count(*) from public.profiles$q$, '1');
select t.denied('alice cannot write demo community', $q$update public.demo_community_responses set is_demo_data = true$q$);
select t.denied('alice cannot write categories', $q$delete from public.story_categories$q$);
reset role;

-- make the letter openable (owner-level time travel), then verify unlocking
update public.time_capsule_letters set created_at = now() - interval '2 days', unlock_at = now() - interval '1 minute';

select set_config('t.lid', (select id::text from public.time_capsule_letters), false);

-- ---------- Bob (authenticated, different user) ----------
select set_config('request.jwt.claim.sub', :bob, false);
set role authenticated;
select t.scalar('bob does not see alice draft/story in base table', $q$select count(*) from public.stories$q$, '0');
select t.scalar('bob sees alice published story through the view', $q$select count(*) from public.public_stories where title='Alice draft'$q$, '1');
select t.dml('bob cannot update alice story', $q$update public.stories set title='Hacked' where title='Alice draft'$q$, 0);
select t.dml('bob cannot delete alice story', $q$delete from public.stories where title='Alice draft'$q$, 0);
select t.scalar('bob sees no letters', $q$select count(*) from public.time_capsule_letters$q$, '0');
select t.denied('bob cannot open alice letter (real id, already unlocked)', format($q$select public.open_letter(%L::uuid)$q$, current_setting('t.lid')));
select t.scalar('bob sees no skin sessions', $q$select count(*) from public.skin_analysis_sessions$q$, '0');
select t.dml('bob cannot delete alice skin session', $q$delete from public.skin_analysis_sessions$q$, 0);
select t.scalar('bob sees only his own profile', $q$select display_name from public.profiles$q$, 'Bob');
select t.dml('bob cannot edit alice profile', $q$update public.profiles set display_name='X' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$, 0);
reset role;
-- RLS on assignments, tested precisely with a real target row (bob targeting alice's story id)
select set_config('request.jwt.claim.sub', :bob, false);
set role authenticated;
do $$ declare sid uuid; begin
  select id into sid from public.stories where title='Alice draft' limit 1;  -- invisible to bob -> null
  perform t.log('bob cannot even see the story id to attach to', sid is null, coalesce(sid::text,'null'));
end $$;
reset role;
do $$ declare sid uuid; begin
  select id into sid from public.stories where title='Alice draft';
  perform set_config('t.sid', sid::text, false);
end $$;
set role authenticated;
select t.denied('bob cannot insert assignment for alice story id', format($q$insert into public.story_category_assignments (story_id, category_id) select %L::uuid, id from public.story_categories where slug='scars'$q$, current_setting('t.sid')));
reset role;

-- ---------- Alice again: unlocked letter ----------
select set_config('request.jwt.claim.sub', :alice, false);
set role authenticated;
select t.scalar('unlocked letter returns its content to the owner', $q$select (public.open_letter(id)->>'content') from public.time_capsule_letters$q$, 'Dear me, be kind.');
select t.scalar('opened_at is recorded', $q$select (opened_at is not null)::text from public.time_capsule_letters$q$, 'true');
select t.dml('alice can delete her letter', $q$delete from public.time_capsule_letters$q$, 1);
reset role;

-- ---------- similarity methodology ----------
select t.scalar('ineligible profiles are excluded (acne rows > 65 overall, still 65 counted)',
  $q$select (select count(*) from public.demo_community_responses r join public.story_categories c on c.id=r.category_id where c.slug='acne') > 65 and (select matching from public.demo_similarity(array['acne'])) = 65$q$, 'true');
select t.scalar('multi-topic = union of matching profiles',
  $q$select (select matching from public.demo_similarity(array['acne','scars'])) = (select count(distinct r.demo_profile_id) from public.demo_community_responses r join public.demo_community_profiles p on p.id=r.demo_profile_id and p.eligible_for_demo_calculation join public.story_categories c on c.id=r.category_id where c.slug in ('acne','scars'))$q$, 'true');
select t.scalar('unknown topic -> 0 matching', $q$select matching from public.demo_similarity(array['nope'])$q$, '0');

-- ---------- seed idempotency ----------
select count(*) as stories_before, (select count(*) from public.demo_community_responses) as responses_before, (select count(*) from public.story_category_assignments where story_id in (select id from public.stories where is_demo_content)) as assign_before from public.stories where is_demo_content \gset
\ir ../migrations/20261101000003_seed_demo_data.sql
select t.scalar('re-running seed adds no stories', $q$select count(*) from public.stories where is_demo_content$q$, :'stories_before');
select t.scalar('re-running seed adds no responses', $q$select count(*) from public.demo_community_responses$q$, :'responses_before');
select t.scalar('re-running seed adds no assignments', $q$select count(*) from public.story_category_assignments where story_id in (select id from public.stories where is_demo_content)$q$, :'assign_before');

-- ---------- report ----------
select case when ok then 'PASS' else 'FAIL' end as result, name, case when ok then '' else detail end as detail from t.results order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
do $$ begin if exists (select 1 from t.results where not ok) then raise exception 'RLS TESTS FAILED'; end if; end $$;
