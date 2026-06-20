-- Example idempotent patch.
-- All database patches in this template must be safe to run repeatedly.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'service_role_manage_app_settings'
  ) then
    create policy service_role_manage_app_settings
      on public.app_settings
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

insert into public.app_settings (key, value)
values ('template.version', '{"value":"0.1.0"}'::jsonb)
on conflict (key) do update
set
  value = excluded.value,
  updated_at = now();

