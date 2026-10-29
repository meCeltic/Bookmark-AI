-- Exercises the migration as a non-superuser: RLS isolation, the unique
-- canonical-url index, ranked search, tag rename and the updated_at trigger.
-- Every "expect" line must print t.

do $$ begin if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user nologin; end if; end $$;
grant usage on schema public, auth, extensions to app_user;
grant all on all tables in schema public to app_user;
grant execute on all functions in schema public, extensions to app_user;
grant execute on function auth.uid() to app_user;
set role app_user;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false) \gset
insert into public.collections (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'Eng') returning id as col \gset

insert into public.bookmarks (user_id, url, url_normalized, title, summary, tags, collection_id)
values ('11111111-1111-1111-1111-111111111111', 'https://www.postgresql.org/docs/current/textsearch-intro.html',
        'https://postgresql.org/docs/current/textsearch-intro.html', 'PostgreSQL: Full Text Search introduction',
        'The official tour of tsvector and tsquery.', '{postgres,search}', :'col');
insert into public.bookmarks (user_id, url, url_normalized, title, tags)
values ('11111111-1111-1111-1111-111111111111', 'https://react.dev', 'https://react.dev', 'React', '{react,javascript}');

-- duplicate canonical url is refused by the index
\set ON_ERROR_STOP 0
insert into public.bookmarks (user_id, url, url_normalized, title) values ('11111111-1111-1111-1111-111111111111', 'https://react.dev/', 'https://react.dev', 'dup');
-- writing as another user is refused by RLS
insert into public.bookmarks (user_id, url, url_normalized, title) values ('22222222-2222-2222-2222-222222222222', 'https://evil.com', 'https://evil.com', 'x');
\set ON_ERROR_STOP 1

select (count(*) = 2) as "expect: user a sees two rows" from public.bookmarks;
select (count(*) = 1) as "expect: full-text hit on tsvector" from public.search_bookmarks('tsvector') where title like 'PostgreSQL%';
select (count(*) = 1) as "expect: partial word hit on postgre" from public.search_bookmarks('postgre') where title like 'PostgreSQL%';
select (count(*) = 1) as "expect: tag hit on javascript" from public.search_bookmarks('javascript') where title = 'React';
select (public.rename_tag('react', 'reactjs') = 1) as "expect: one row renamed";
select (tags = '{javascript,reactjs}') as "expect: tags merged and sorted" from public.bookmarks where title = 'React';
update public.bookmarks set favourite = true where title = 'React';
select (updated_at > created_at) as "expect: updated_at touched" from public.bookmarks where title = 'React';

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false) \gset
select (count(*) = 0) as "expect: user b sees nothing" from public.bookmarks;
