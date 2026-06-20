# Database Patches

Database patches live in:

- `server/volumes/db/init/*.sql`
- `server/volumes/db/migrations/*.sql`

`server/scripts/run-db-patches.sh` runs every `*.sql` file in sorted order and restarts PostgREST to refresh its schema cache. The remote deploy script runs it automatically after `docker compose up -d`.

## Required Rule

Every SQL patch must be idempotent. Assume it may run many times, on partially updated databases, or after a failed deployment retry.

Use patterns like:

```sql
create table if not exists public.example (...);
alter table public.example add column if not exists name text;
create index if not exists example_name_idx on public.example (name);
create or replace function public.example_fn() returns void as $$ ... $$ language plpgsql;
insert into public.example_seed (key, value)
values ('default', '{}')
on conflict (key) do update set value = excluded.value;
```

For objects without `if not exists`, use a guarded `do $$ ... $$` block:

```sql
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'example'
      and policyname = 'example_policy'
  ) then
    create policy example_policy
      on public.example
      for select
      to authenticated
      using (true);
  end if;
end
$$;
```

Avoid:

- Plain `create table ...` without `if not exists`
- Plain `alter table ... add column ...` without `if not exists`
- Plain seed `insert` without `on conflict`
- Destructive data changes unless they are explicitly guarded and reversible
- Assuming a previous patch definitely ran

## Naming

Use sortable names:

```text
001_create_app_settings.sql
002_add_user_profile.sql
003_seed_default_settings.sql
```

Names describe the intended change, but correctness comes from idempotent SQL, not from the file number.

