-- Bookmark-AI schema. Apply with `supabase db push` or paste into the SQL editor.
-- One user owns everything; row-level security enforces it for every verb.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- collections
create table public.collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ------------------------------------------------------------------ bookmarks
create table public.bookmarks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  collection_id      uuid references public.collections (id) on delete set null,
  url                text not null check (char_length(url) <= 2048),
  url_normalized     text not null,
  title              text not null default '' check (char_length(title) <= 300),
  description        text check (char_length(description) <= 1000),
  summary            text check (char_length(summary) <= 600),
  -- Tags live on the row as text[]: every read needs them, writes are per-row,
  -- and a GIN index answers "has tag" queries. A join table would buy nothing here.
  tags               text[] not null default '{}' check (cardinality(tags) <= 8),
  category           text check (category in ('article','documentation','tool','video','repository','paper','product','reference','other')),
  favicon_url        text,
  image_url          text,
  favourite          boolean not null default false,
  read_at            timestamptz,
  archived_at        timestamptz,
  enrichment         text not null default 'pending' check (enrichment in ('pending','done','fallback','failed')),
  reading_minutes    integer check (reading_minutes between 0 and 600),
  health             text not null default 'unknown' check (health in ('unknown','ok','redirected','dead')),
  health_checked_at  timestamptz,
  last_opened_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Full-text document: title outranks summary outranks tags outranks url.
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple',  array_to_string(tags, ' ')), 'C') ||
    setweight(to_tsvector('simple',  coalesce(url_normalized, '')), 'D')
  ) stored,
  -- Duplicates are a database guarantee, not a JavaScript hope.
  unique (user_id, url_normalized)
);

create index bookmarks_user_created_idx on public.bookmarks (user_id, created_at desc);
create index bookmarks_search_idx       on public.bookmarks using gin (search);
create index bookmarks_tags_idx         on public.bookmarks using gin (tags);
create index bookmarks_title_trgm_idx   on public.bookmarks using gin (title gin_trgm_ops);

-- ------------------------------------------------------------------ updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger bookmarks_touch_updated_at
  before update on public.bookmarks
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------------ RLS
alter table public.collections enable row level security;
alter table public.bookmarks   enable row level security;

create policy "collections: owner only" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bookmarks: owner only" on public.bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --------------------------------------------------------------------- search
-- Ranked full-text search with a trigram fallback for typos and partial words.
-- RLS still applies because the function runs with the caller's rights.
create or replace function public.search_bookmarks(q text, max_rows integer default 50)
returns setof public.bookmarks
language sql stable
as $$
  with query as (select websearch_to_tsquery('english', q) as tsq)
  select b.*
  from public.bookmarks b, query
  where b.user_id = auth.uid()
    and (b.search @@ query.tsq or b.title % q)
  order by
    ts_rank_cd(b.search, query.tsq) desc,
    similarity(b.title, q) desc,
    b.created_at desc
  limit max_rows;
$$;

-- Rename or merge a tag on every row in one statement.
create or replace function public.rename_tag(from_tag text, to_tag text)
returns integer
language plpgsql
as $$
declare affected integer;
begin
  update public.bookmarks
  set tags = (
    select coalesce(array_agg(distinct t order by t), '{}')
    from unnest(array_replace(tags, from_tag, nullif(to_tag, ''))) as t
    where t is not null
  )
  where user_id = auth.uid() and from_tag = any (tags);
  get diagnostics affected = row_count;
  return affected;
end $$;
