-- Minimal stand-in for Supabase's auth schema so the migration can be exercised locally.
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x.com'), ('22222222-2222-2222-2222-222222222222','b@x.com');
