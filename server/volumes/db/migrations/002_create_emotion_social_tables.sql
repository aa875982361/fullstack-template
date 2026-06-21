-- Emotion social MVP schema.
-- This patch is idempotent and keeps writes service-mediated while allowing
-- logged-in users to read their own rooms/messages for Realtime subscriptions.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.anonymous_profiles (
  user_id uuid primary key,
  display_name text not null,
  avatar_seed text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.emotion_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  input_text text not null,
  primary_emotion text not null,
  mixed_emotions jsonb not null default '[]'::jsonb,
  intensity numeric(3,2) not null default 0.50,
  valence numeric(4,3) not null default 0,
  arousal numeric(4,3) not null default 0.50,
  tendency text not null default 'needs_listening',
  confidence numeric(3,2) not null default 0.60,
  empathy_message text not null default '',
  raw_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint emotion_records_intensity_range check (intensity >= 0 and intensity <= 1),
  constraint emotion_records_valence_range check (valence >= -1 and valence <= 1),
  constraint emotion_records_arousal_range check (arousal >= 0 and arousal <= 1),
  constraint emotion_records_confidence_range check (confidence >= 0 and confidence <= 1)
);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  emotion_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint chat_rooms_status_check check (status in ('active', 'closed'))
);

create table if not exists public.match_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  emotion_record_id uuid not null references public.emotion_records(id) on delete cascade,
  status text not null default 'queued',
  primary_emotion text not null,
  intensity numeric(3,2) not null,
  valence numeric(4,3) not null,
  arousal numeric(4,3) not null,
  room_id uuid references public.chat_rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_queue_status_check check (status in ('queued', 'matched', 'cancelled')),
  constraint match_queue_intensity_range check (intensity >= 0 and intensity <= 1),
  constraint match_queue_valence_range check (valence >= -1 and valence <= 1),
  constraint match_queue_arousal_range check (arousal >= 0 and arousal <= 1)
);

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null,
  anonymous_name text not null,
  avatar_seed text not null,
  emotion_record_id uuid references public.emotion_records(id) on delete set null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null,
  sender_alias text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_content_length check (char_length(content) between 1 and 1000)
);

create or replace function public.is_chat_room_member(room_id_to_check uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_room_members
    where room_id = room_id_to_check
      and user_id = auth.uid()
  );
$$;

create unique index if not exists anonymous_profiles_display_name_idx
  on public.anonymous_profiles(display_name);

create index if not exists emotion_records_user_created_idx
  on public.emotion_records(user_id, created_at desc);

create index if not exists match_queue_status_emotion_idx
  on public.match_queue(status, primary_emotion, created_at);

create unique index if not exists match_queue_one_active_per_user_idx
  on public.match_queue(user_id)
  where status = 'queued';

create index if not exists chat_room_members_user_idx
  on public.chat_room_members(user_id, joined_at desc);

create index if not exists chat_messages_room_created_idx
  on public.chat_messages(room_id, created_at);

drop trigger if exists set_anonymous_profiles_updated_at on public.anonymous_profiles;
create trigger set_anonymous_profiles_updated_at
  before update on public.anonymous_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_match_queue_updated_at on public.match_queue;
create trigger set_match_queue_updated_at
  before update on public.match_queue
  for each row execute function public.set_updated_at();

drop trigger if exists set_chat_rooms_updated_at on public.chat_rooms;
create trigger set_chat_rooms_updated_at
  before update on public.chat_rooms
  for each row execute function public.set_updated_at();

alter table public.anonymous_profiles enable row level security;
alter table public.emotion_records enable row level security;
alter table public.match_queue enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'anonymous_profiles'
      and policyname = 'service_role_manage_anonymous_profiles'
  ) then
    create policy service_role_manage_anonymous_profiles
      on public.anonymous_profiles
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'anonymous_profiles'
      and policyname = 'users_read_own_anonymous_profile'
  ) then
    create policy users_read_own_anonymous_profile
      on public.anonymous_profiles
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'emotion_records'
      and policyname = 'service_role_manage_emotion_records'
  ) then
    create policy service_role_manage_emotion_records
      on public.emotion_records
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'emotion_records'
      and policyname = 'users_read_own_emotion_records'
  ) then
    create policy users_read_own_emotion_records
      on public.emotion_records
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_queue'
      and policyname = 'service_role_manage_match_queue'
  ) then
    create policy service_role_manage_match_queue
      on public.match_queue
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_queue'
      and policyname = 'users_read_own_match_queue'
  ) then
    create policy users_read_own_match_queue
      on public.match_queue
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_rooms'
      and policyname = 'service_role_manage_chat_rooms'
  ) then
    create policy service_role_manage_chat_rooms
      on public.chat_rooms
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_rooms'
      and policyname = 'members_read_chat_rooms'
  ) then
    create policy members_read_chat_rooms
      on public.chat_rooms
      for select
      to authenticated
      using (public.is_chat_room_member(id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_room_members'
      and policyname = 'service_role_manage_chat_room_members'
  ) then
    create policy service_role_manage_chat_room_members
      on public.chat_room_members
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_room_members'
      and policyname = 'members_read_chat_room_members'
  ) then
    create policy members_read_chat_room_members
      on public.chat_room_members
      for select
      to authenticated
      using (public.is_chat_room_member(room_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'service_role_manage_chat_messages'
  ) then
    create policy service_role_manage_chat_messages
      on public.chat_messages
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'members_read_chat_messages'
  ) then
    create policy members_read_chat_messages
      on public.chat_messages
      for select
      to authenticated
      using (public.is_chat_room_member(room_id));
  end if;
end
$$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception
    when undefined_object then
      null;
    when duplicate_object then
      null;
  end;
end
$$;
