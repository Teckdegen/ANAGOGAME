import { createClient } from '@supabase/supabase-js'

// ─── Fill these in from your Supabase project settings ────────────────────
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? 'https://YOUR_PROJECT_ID.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'YOUR_ANON_KEY'
// ─────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── Types ────────────────────────────────────────────────────────────────

export interface Room {
  id: number
  name: string
  host_id: string
  host_name: string
  guest_id: string
  guest_name: string
  status: 'open' | 'full' | 'done'
  player_count: number
  created_at: string
}

export interface Signal {
  id: number
  room_id: string
  sender_id: string
  type: 'offer' | 'answer' | 'candidate'
  payload: string
  created_at: string
}

export interface LeaderboardRow {
  player_id: string
  username: string
  wallet: string
  wins: number
  losses: number
  goals_scored: number
  matches_played: number
}

// ─── Rooms ────────────────────────────────────────────────────────────────

export async function fetchOpenRooms(): Promise<Room[]> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('status', 'open')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function createRoom(name: string, hostId: string, hostName: string): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .insert({ name, host_id: hostId, host_name: hostName, status: 'open', player_count: 1 })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function joinRoomRecord(roomId: number, guestId: string, guestName: string): Promise<void> {
  await supabase
    .from('rooms')
    .update({ status: 'full', player_count: 2, guest_id: guestId, guest_name: guestName })
    .eq('id', roomId)
}

export async function deleteRoom(roomId: number): Promise<void> {
  await supabase.from('rooms').delete().eq('id', roomId)
  await supabase.from('signals').delete().eq('room_id', String(roomId))
}

// ─── Signals (WebRTC signaling) ───────────────────────────────────────────

export async function pushSignal(
  roomId: number, senderId: string, type: string, payload: string
): Promise<void> {
  await supabase.from('signals').insert({ room_id: String(roomId), sender_id: senderId, type, payload })
}

export async function fetchSignals(roomId: number, myPlayerId: string): Promise<Signal[]> {
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('room_id', String(roomId))
    .neq('sender_id', myPlayerId)
    .order('created_at', { ascending: true })
  if (error) return []
  // Delete processed signals
  if (data && data.length > 0) {
    const ids = data.map((r) => r.id)
    await supabase.from('signals').delete().in('id', ids)
  }
  return data ?? []
}

// ─── Players / Stats ──────────────────────────────────────────────────────

export async function upsertPlayer(playerId: string, username: string, wallet: string): Promise<void> {
  await supabase
    .from('players')
    .upsert({ player_id: playerId, username, wallet }, { onConflict: 'player_id' })
}

export async function submitMatch(
  playerId: string, username: string, wallet: string,
  won: boolean, goalsScored: number, goalsConceded: number
): Promise<void> {
  await supabase.from('match_results').insert({
    player_id: playerId, username, wallet, won, goals_scored: goalsScored, goals_conceded: goalsConceded,
  })
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('wins', { ascending: false })
    .order('goals_scored', { ascending: false })
    .limit(20)
  if (error) return []
  return data ?? []
}
