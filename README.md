# ANAGOGAME

Real-time PVP slime soccer — Telegram Mini App built with Next.js.

## Stack

- **Next.js 14** + TypeScript + Tailwind CSS
- **Matter.js** — 2D physics (slimes, ball, goals)
- **WebRTC** — peer-to-peer gameplay (Google STUN + Open Relay TURN, no port forwarding)
- **Supabase** — rooms, WebRTC signaling, leaderboard, player profiles
- **Web Audio API** — procedural sounds, no audio files needed
- **Zustand** — state management + localStorage persistence

## Features

- Online PVP — anyone anywhere can connect and play
- Room browser — open rooms listed live, auto-deleted after use or after 10s idle
- No auth — just username + wallet address (saved to localStorage, synced to Supabase)
- Leaderboard — top players by wins, click to copy wallet for reward distribution
- Dashboard — view/edit your profile and stats
- Cartoon UI — landscape-only, designed for Telegram Mini App
- Touch controls — on-screen buttons for mobile

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `anagogame-web/supabase/schema.sql` in the SQL Editor
3. Copy your project URL and anon key

### 2. Environment

```bash
cd anagogame-web
cp .env.local.example .env.local
# Fill in your Supabase credentials in .env.local
```

### 3. Run locally

```bash
cd anagogame-web
npm install
npm run dev
```

### 4. Deploy to Vercel

```bash
cd anagogame-web
npx vercel
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel dashboard → Project Settings → Environment Variables.

### 5. Telegram Mini App

Set your Vercel URL as the Mini App URL in [@BotFather](https://t.me/BotFather).
