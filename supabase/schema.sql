-- ============================================================
--  Slime Soccer — Supabase Schema (wallet-based, no auth)
--  Run this in Supabase SQL Editor → New Query
-- ============================================================

-- ── 1. Players (upserted by client, no auth) ─────────────────
create table if not exists public.players (
  player_id  text primary key,   -- local UUID
  username   text not null,
  wallet     text not null,
  updated_at timestamptz default now()
);

-- ── 2. Rooms (open PVP rooms, 2 players max) ─────────────────
create table if not exists public.rooms (
  id           bigserial primary key,
  name         text not null,
  host_id      text not null,
  host_name    text not null,
  guest_id     text default '',
  guest_name   text default '',
  status       text not null default 'open',  -- 'open' | 'full' | 'done'
  player_count int  not null default 1,
  created_at   timestamptz default now()
);

-- Auto-delete rooms older than 10 minutes (belt-and-suspenders cleanup).
-- Enable pg_cron in Supabase dashboard → Extensions, then run:
--
--   select cron.schedule(
--     'delete-stale-rooms',
--     '* * * * *',   -- every minute
--     $$ delete from public.rooms where created_at < now() - interval '10 minutes' $$
--   );
--
-- Also auto-delete stale signals older than 5 minutes:
--
--   select cron.schedule(
--     'delete-stale-signals',
--     '* * * * *',
--     $$ delete from public.signals where created_at < now() - interval '5 minutes' $$
--   );

-- ── 3. WebRTC Signals (SDP offers/answers + ICE candidates) ──
-- Rows are deleted after being read, so this table stays tiny.
create table if not exists public.signals (
  id         bigserial primary key,
  room_id    text not null,
  sender_id  text not null,
  type       text not null,   -- 'offer' | 'answer' | 'candidate'
  payload    text not null,
  created_at timestamptz default now()
);

-- Auto-delete rooms older than 30 minutes (run as a cron or pg_cron)
-- delete from public.rooms where created_at < now() - interval '30 minutes';

-- ── 3. Match results ─────────────────────────────────────────
create table if not exists public.match_results (
  id             bigserial primary key,
  player_id      text not null references public.players(player_id) on delete cascade,
  username       text not null,
  wallet         text not null,
  won            boolean not null,
  goals_scored   int not null default 0,
  goals_conceded int not null default 0,
  played_at      timestamptz default now()
);

-- ── 4. Leaderboard view ──────────────────────────────────────
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

-- ── 5. Row Level Security ────────────────────────────────────
alter table public.players       enable row level security;
alter table public.rooms         enable row level security;
alter table public.signals       enable row level security;
alter table public.match_results enable row level security;

-- Players: anyone can read/write (no auth — trust client UUID)
create policy "players_all" on public.players for all using (true) with check (true);

-- Rooms: anyone can read/insert/update/delete
create policy "rooms_all" on public.rooms for all using (true) with check (true);

-- Signals: anyone can read/insert/delete (ephemeral signaling data)
create policy "signals_all" on public.signals for all using (true) with check (true);

-- Match results: anyone can read/insert
create policy "match_results_select" on public.match_results for select using (true);
create policy "match_results_insert" on public.match_results for insert with check (true);

-- Leaderboard view is public
grant select on public.leaderboard to anon, authenticated;
grant all    on public.players       to anon, authenticated;
grant all    on public.rooms         to anon, authenticated;
grant all    on public.signals       to anon, authenticated;
grant all    on public.match_results to anon, authenticated;
grant usage, select on sequence public.rooms_id_seq         to anon, authenticated;
grant usage, select on sequence public.signals_id_seq       to anon, authenticated;
grant usage, select on sequence public.match_results_id_seq to anon, authenticated;
