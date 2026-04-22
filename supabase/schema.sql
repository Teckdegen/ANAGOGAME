-- ============================================================
--  ANAGOGAME — Supabase Schema
--  Paste this entire file into:
--  Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================


-- ── 1. Players ───────────────────────────────────────────────
-- Stores username + wallet. No auth — player_id is a local UUID.
create table if not exists public.players (
  player_id  text primary key,
  username   text not null,
  wallet     text not null default '',
  updated_at timestamptz not null default now()
);


-- ── 2. Rooms ─────────────────────────────────────────────────
-- Open PVP rooms. Max 2 players. Auto-deleted by the client
-- when the game ends or after 10 seconds of inactivity.
create table if not exists public.rooms (
  id           bigserial primary key,
  name         text        not null,
  host_id      text        not null,
  host_name    text        not null,
  guest_id     text        not null default '',
  guest_name   text        not null default '',
  status       text        not null default 'open',  -- 'open' | 'full' | 'done'
  player_count int         not null default 1,
  created_at   timestamptz not null default now()
);


-- ── 3. Signals ───────────────────────────────────────────────
-- Ephemeral WebRTC signaling (SDP offers/answers + ICE candidates).
-- Rows are deleted immediately after being read by the client.
create table if not exists public.signals (
  id         bigserial primary key,
  room_id    text        not null,
  sender_id  text        not null,
  type       text        not null,   -- 'offer' | 'answer' | 'candidate'
  payload    text        not null,
  created_at timestamptz not null default now()
);


-- ── 4. Match results ─────────────────────────────────────────
-- One row per player per match.
create table if not exists public.match_results (
  id             bigserial primary key,
  player_id      text        not null references public.players(player_id) on delete cascade,
  username       text        not null,
  wallet         text        not null default '',
  won            boolean     not null,
  goals_scored   int         not null default 0,
  goals_conceded int         not null default 0,
  played_at      timestamptz not null default now()
);


-- ── 5. Leaderboard view ──────────────────────────────────────
-- Aggregates stats per player. Used by the leaderboard screen
-- and the dashboard stats section.
create or replace view public.leaderboard as
select
  p.player_id,
  p.username,
  p.wallet,
  count(*) filter (where m.won = true)  as wins,
  count(*) filter (where m.won = false) as losses,
  coalesce(sum(m.goals_scored), 0)      as goals_scored,
  count(*)                              as matches_played
from public.players p
left join public.match_results m on m.player_id = p.player_id
group by p.player_id, p.username, p.wallet
order by wins desc, goals_scored desc;


-- ── 6. Row Level Security ────────────────────────────────────
alter table public.players       enable row level security;
alter table public.rooms         enable row level security;
alter table public.signals       enable row level security;
alter table public.match_results enable row level security;

-- Players: anyone can read and upsert (no auth — trust client UUID)
create policy "players_select" on public.players
  for select using (true);

create policy "players_insert" on public.players
  for insert with check (true);

create policy "players_update" on public.players
  for update using (true) with check (true);

-- Rooms: anyone can read, insert, update, delete
create policy "rooms_all" on public.rooms
  for all using (true) with check (true);

-- Signals: anyone can read, insert, delete (ephemeral signaling data)
create policy "signals_all" on public.signals
  for all using (true) with check (true);

-- Match results: anyone can read and insert
create policy "match_results_select" on public.match_results
  for select using (true);

create policy "match_results_insert" on public.match_results
  for insert with check (true);


-- ── 7. Grants (for anon + authenticated roles) ───────────────
grant select, insert, update         on public.players       to anon, authenticated;
grant select, insert, update, delete on public.rooms         to anon, authenticated;
grant select, insert, delete         on public.signals       to anon, authenticated;
grant select, insert                 on public.match_results to anon, authenticated;
grant select                         on public.leaderboard   to anon, authenticated;

grant usage, select on sequence public.rooms_id_seq          to anon, authenticated;
grant usage, select on sequence public.signals_id_seq        to anon, authenticated;
grant usage, select on sequence public.match_results_id_seq  to anon, authenticated;


-- ── 8. Optional: auto-cleanup stale rooms (pg_cron) ──────────
-- Enable pg_cron in Supabase Dashboard → Database → Extensions
-- then uncomment and run these two lines:
--
-- select cron.schedule('delete-stale-rooms',
--   '* * * * *',
--   $$ delete from public.rooms where created_at < now() - interval '10 minutes' $$);
--
-- select cron.schedule('delete-stale-signals',
--   '* * * * *',
--   $$ delete from public.signals where created_at < now() - interval '5 minutes' $$);
