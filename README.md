# ANAGOGAME

A real-time PVP slime soccer game built with Godot 3.

## Features

- **Online PVP** — WebRTC with Google STUN + Open Relay TURN servers (no port forwarding needed, works anywhere)
- **Room browser** — open rooms listed live via Supabase, 2 players per room, auto-deleted after use
- **Leaderboard** — top players by wins, wallet addresses shown for reward distribution
- **Dashboard** — username + wallet address saved locally and synced to Supabase
- **No auth** — just enter a username and wallet address to play
- **Cartoon UI** — landscape-only, designed for Telegram Mini App
- **Sounds** — procedurally synthesized, no audio files needed

## Tech Stack

- **Game engine**: Godot 3.x
- **Networking**: WebRTC (`WebRTCMultiplayer`) + Google STUN + openrelay.metered.ca TURN
- **Backend**: Supabase (rooms, signals, leaderboard, player profiles)
- **Platform**: Telegram Mini App (landscape)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Fill in your credentials in `src/Supabase/SupabaseClient.gd`:

```gdscript
const SUPABASE_URL      := "https://YOUR_PROJECT_ID.supabase.co"
const SUPABASE_ANON_KEY := "YOUR_ANON_KEY"
```

### 2. Export for Web (Vercel / any static host)

1. Open the project in Godot 3
2. Go to **Project → Export → Add → HTML5**
3. Export to a folder (e.g. `export/`)
4. Deploy the `export/` folder to Vercel:

```bash
npm i -g vercel
vercel export/
```

Or drag the `export/` folder into [vercel.com/new](https://vercel.com/new).

> **Note:** Vercel needs HTTPS for WebRTC to work. Vercel provides this automatically.

### 3. Telegram Mini App

Set your Vercel URL as the Mini App URL in [@BotFather](https://t.me/BotFather).

## Controls

| Player | Move | Jump |
|--------|------|------|
| Left slime | A / D | W |
| Right slime | J / L | I |

On mobile, touch controls are handled by the on-screen buttons.

## Room Lifecycle

- Rooms auto-delete when the game ends
- Rooms auto-delete if the host is alone for 10 seconds
- Rooms older than 10 minutes are filtered from the list
- Optional: enable `pg_cron` in Supabase to hard-delete stale rows (see `schema.sql`)
