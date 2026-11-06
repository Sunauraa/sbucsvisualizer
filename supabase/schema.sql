-- ============================================================
-- DSA Visualizer: accounts and sync (decision 7 in notes/design-decisions.md)
--
-- Run once: Supabase dashboard → SQL Editor → paste this file → Run. Safe to run again.
--
-- Every student table has row-level security: a signed-in student can read and write only their own rows,
-- and someone who isn't signed in can read nothing. The browser's "anon" key is public by design; these rules
-- are what protect the data.
-- ============================================================

-- ---------- progress: one row per student per module page ----------
-- data = { tabs: [...], tabsTotal, ops: [...], opsTotal, quiz: { right, total }, lc: [problem numbers] }
create table if not exists public.progress (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page       text not null check (char_length(page) between 1 and 40),
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, page)
);

-- ---------- leetcode: one row per student per problem ----------
-- 'none' means "cleared": kept as a row so the change reaches the student's other computers
create table if not exists public.leetcode (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  problem    integer not null check (problem between 1 and 100000),
  status     text not null check (status in ('none', 'todo', 'solved', 'revisit')),
  updated_at timestamptz not null default now(),
  primary key (user_id, problem)
);

-- ---------- notes pinned to a step ----------
-- meta   = { tab, player, title, step, total }: small, synced to every computer
-- frames = the recorded steps around the pinned one: larger, fetched only when the note is opened
-- deleted = a tombstone, so a deletion reaches the student's other computers
create table if not exists public.notes (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page       text not null check (char_length(page) between 1 and 40),
  body       text not null default '' check (char_length(body) <= 2000),
  meta       jsonb not null default '{}'::jsonb check (octet_length(meta::text) <= 2000),
  frames     jsonb check (frames is null or octet_length(frames::text) <= 30000),
  deleted    boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_updated on public.notes (user_id, updated_at);

-- ---------- the newest change wins ----------
-- A computer that was offline sends its changes late. A change older than what the server already has must
-- not overwrite it. A clock far in the future is pulled back, so one wrong clock can't lock a row.
create or replace function public.keep_newest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists progress_keep_newest on public.progress;
create trigger progress_keep_newest before insert or update on public.progress
  for each row execute function public.keep_newest();
drop trigger if exists leetcode_keep_newest on public.leetcode;
create trigger leetcode_keep_newest before insert or update on public.leetcode
  for each row execute function public.keep_newest();
drop trigger if exists notes_keep_newest on public.notes;
create trigger notes_keep_newest before insert or update on public.notes
  for each row execute function public.keep_newest();

-- ---------- at most 200 notes per student ----------
create or replace function public.notes_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.notes n where n.user_id = new.user_id and not n.deleted) >= 200 then
    raise exception 'A student can keep at most 200 notes.';
  end if;
  return new;
end $$;
drop trigger if exists notes_limit on public.notes;
create trigger notes_limit before insert on public.notes
  for each row execute function public.notes_limit();

-- ---------- row-level security: each student sees only their own rows ----------
alter table public.progress enable row level security;
alter table public.leetcode enable row level security;
alter table public.notes    enable row level security;

drop policy if exists "own rows" on public.progress;
create policy "own rows" on public.progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own rows" on public.leetcode;
create policy "own rows" on public.leetcode for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own rows" on public.notes;
create policy "own rows" on public.notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.progress, public.leetcode, public.notes from anon;
grant select, insert, update, delete on public.progress, public.leetcode, public.notes to authenticated;

-- ---------- keep-alive: called once a day by api/keepalive.js ----------
-- Supabase pauses free projects after a week without database activity. This writes one timestamp, so the
-- daily call is real database activity. Nobody can read the table directly.
create table if not exists public.heartbeat (
  id int primary key default 1 check (id = 1),
  at timestamptz not null default now()
);
alter table public.heartbeat enable row level security;
revoke all on public.heartbeat from anon, authenticated;

create or replace function public.ping() returns timestamptz
language sql security definer set search_path = '' as $$
  insert into public.heartbeat (id, at) values (1, now())
  on conflict (id) do update set at = excluded.at
  returning at;
$$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

-- ---------- "Delete my account" ----------
-- Removes the student's login; their progress, LeetCode status and notes go with it (on delete cascade).
create or replace function public.delete_me() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;
