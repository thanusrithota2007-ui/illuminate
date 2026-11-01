-- Illuminate community stories. Run once in the Supabase SQL editor.
-- No author identity is stored. Rows are added and approved by an administrator (public submissions are disabled).
create table if not exists public.community_stories (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Acne','Pigmentation','Skin tone','Scars','Social-media pressure')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 20 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  consent_given boolean not null check (consent_given),         -- explicit consent to publish, required
  consent_version text not null,                                 -- which consent wording was agreed to
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (status <> 'approved' or published_at is not null)
);
alter table public.community_stories enable row level security;
revoke all on public.community_stories from anon, authenticated;
-- Deliberately NO policies: browsers using the anon key can read or write nothing.
-- Only the FastAPI backend (service-role key, server-side) reads rows, and only approved + consented ones.
-- Moderation: review rows in the dashboard, then set status='approved', published_at=now().
