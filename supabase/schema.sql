-- Screening Room — Phase 1 Database Schema
-- Run this in the Supabase SQL Editor to create all tables and RLS policies.

-- ============================================================
-- TABLES
-- ============================================================

-- User profiles (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text not null,
  email text,
  avatar_url text,
  is_approved boolean default false,
  created_at timestamptz default now()
);

-- Groups (MVP: single row)
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  invite_code text unique not null,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- Group memberships
create table public.group_memberships (
  user_id uuid references public.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  role text check (role in ('admin', 'member')) default 'member',
  joined_at timestamptz default now(),
  primary key (user_id, group_id)
);

-- Content items (movies, TV shows, YouTube videos)
create table public.content_items (
  id uuid default gen_random_uuid() primary key,
  content_type text not null check (content_type in ('movie', 'tv_show', 'youtube_video')),
  external_id text not null,
  title text not null,
  poster_thumbnail_url text,
  year integer,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (external_id, content_type)
);

-- Reviews
create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  content_item_id uuid references public.content_items(id) on delete cascade not null,
  group_id uuid references public.groups(id) on delete cascade not null,
  rating integer check (rating is null or (rating >= 1 and rating <= 10)),
  short_take text check (short_take is null or char_length(short_take) <= 280),
  watched_date date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, content_item_id, group_id)
);

-- Tags (user-applied vibe tags)
create table public.tags (
  id uuid default gen_random_uuid() primary key,
  review_id uuid references public.reviews(id) on delete cascade not null,
  tag text not null
);

-- Streaming availability (cached)
create table public.streaming_availability (
  id uuid default gen_random_uuid() primary key,
  content_item_id uuid references public.content_items(id) on delete cascade not null,
  platform_name text not null,
  platform_logo_url text,
  link text,
  country text default 'US',
  last_checked_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_reviews_group_id on public.reviews(group_id);
create index idx_reviews_user_id on public.reviews(user_id);
create index idx_reviews_content_item_id on public.reviews(content_item_id);
create index idx_reviews_created_at on public.reviews(created_at desc);
create index idx_content_items_external on public.content_items(external_id, content_type);
create index idx_tags_review_id on public.tags(review_id);
create index idx_streaming_content on public.streaming_availability(content_item_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.content_items enable row level security;
alter table public.reviews enable row level security;
alter table public.tags enable row level security;
alter table public.streaming_availability enable row level security;

-- Users: can read all approved users, can update own profile
create policy "Users can view approved users"
  on public.users for select
  using (is_approved = true or id = auth.uid());

create policy "Users can update own profile"
  on public.users for update
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.users for insert
  with check (id = auth.uid());

-- Groups: members can view their groups
create policy "Members can view groups"
  on public.groups for select
  using (
    id in (select group_id from public.group_memberships where user_id = auth.uid())
  );

-- Group memberships: members can see other members in their groups
create policy "Members can view group memberships"
  on public.group_memberships for select
  using (
    group_id in (select group_id from public.group_memberships where user_id = auth.uid())
  );

create policy "Users can insert own membership"
  on public.group_memberships for insert
  with check (user_id = auth.uid());

-- Content items: anyone authenticated can read and insert
create policy "Authenticated users can view content"
  on public.content_items for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert content"
  on public.content_items for insert
  with check (auth.uid() is not null);

-- Reviews: group members can see reviews in their groups
create policy "Group members can view reviews"
  on public.reviews for select
  using (
    group_id in (select group_id from public.group_memberships where user_id = auth.uid())
  );

create policy "Users can insert own reviews"
  on public.reviews for insert
  with check (user_id = auth.uid());

create policy "Users can update own reviews"
  on public.reviews for update
  using (user_id = auth.uid());

create policy "Users can delete own reviews"
  on public.reviews for delete
  using (user_id = auth.uid());

-- Tags: same visibility as reviews
create policy "Users can view tags on visible reviews"
  on public.tags for select
  using (
    review_id in (
      select id from public.reviews
      where group_id in (select group_id from public.group_memberships where user_id = auth.uid())
    )
  );

create policy "Users can insert tags on own reviews"
  on public.tags for insert
  with check (
    review_id in (select id from public.reviews where user_id = auth.uid())
  );

create policy "Users can delete tags on own reviews"
  on public.tags for delete
  using (
    review_id in (select id from public.reviews where user_id = auth.uid())
  );

-- Streaming availability: anyone authenticated can read
create policy "Authenticated users can view streaming"
  on public.streaming_availability for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert streaming"
  on public.streaming_availability for insert
  with check (auth.uid() is not null);

-- ============================================================
-- FUNCTION: auto-update updated_at on reviews
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_review_update
  before update on public.reviews
  for each row execute function public.handle_updated_at();

-- ============================================================
-- FUNCTION: auto-create user profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
