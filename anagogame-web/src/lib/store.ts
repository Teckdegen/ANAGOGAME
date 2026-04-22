import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

// ─── Teams (same as Godot Globals.teams) ─────────────────────────────────

export interface Team {
  name: string
  body: string        // hex colour
  decoration: string  // hex colour
}

export const TEAMS: Team[] = [
  { name: 'Argentina',   body: '0AFDFF', decoration: 'FFFFFF' },
  { name: 'Spain',       body: 'CF0000', decoration: '05008B' },
  { name: 'Italy',       body: '817CFF', decoration: 'FFFFFF' },
  { name: 'Japan',       body: '06008B', decoration: 'FFFFFF' },
  { name: 'Senegal',     body: 'FFFFFF', decoration: 'FF7900' },
  { name: 'South Korea', body: 'FF0000', decoration: 'FFFFFF' },
  { name: 'Australia',   body: '00CC44', decoration: 'FFFFFF' },
  { name: 'China',       body: 'FFFFFF', decoration: 'FF0000' },
  { name: 'Cameroon',    body: '008700', decoration: 'FF0000' },
  { name: 'Germany',     body: 'FFFFFF', decoration: '111111' },
  { name: 'France',      body: '1200FF', decoration: 'FFFFFF' },
  { name: 'Brazil',      body: 'FDFF00', decoration: '008700' },
  { name: 'Portugal',    body: '7E2405', decoration: '008700' },
  { name: 'England',     body: 'E6E7E7', decoration: 'FF0000' },
  { name: 'Mexico',      body: '006400', decoration: 'FFFFFF' },
  { name: 'Uruguay',     body: '00B9B6', decoration: 'FFFFFF' },
]

// ─── Player store (persisted to localStorage) ─────────────────────────────

interface PlayerState {
  username: string
  wallet: string
  playerId: string
  setPlayer: (username: string, wallet: string) => void
  ensureId: () => string
  walletShort: () => string
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      username: '',
      wallet:   '',
      playerId: '',
      setPlayer(username, wallet) {
        let { playerId } = get()
        if (!playerId) playerId = uuidv4()
        set({ username, wallet, playerId })
      },
      ensureId() {
        let { playerId } = get()
        if (!playerId) {
          playerId = uuidv4()
          set({ playerId })
        }
        return playerId
      },
      walletShort() {
        const w = get().wallet
        if (w.length <= 12) return w
        return `${w.slice(0, 6)}...${w.slice(-4)}`
      },
    }),
    { name: 'anago-player' }
  )
)

// ─── Game state store (in-memory only) ───────────────────────────────────

interface GameState {
  leftScore:       number
  rightScore:      number
  gameInProgress:  boolean
  isPaused:        boolean
  leftTeamIndex:   number
  rightTeamIndex:  number
  duration:        number   // seconds
  elapsed:         number   // seconds
  setScore:        (left: number, right: number) => void
  incrementLeft:   () => void
  incrementRight:  () => void
  setGameInProgress: (v: boolean) => void
  setPaused:       (v: boolean) => void
  setTeam:         (side: 'left' | 'right', index: number) => void
  resetGame:       (duration: number) => void
  tick:            () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  leftScore:      0,
  rightScore:     0,
  gameInProgress: false,
  isPaused:       false,
  leftTeamIndex:  0,
  rightTeamIndex: 1,
  duration:       120,
  elapsed:        0,
  setScore:       (left, right) => set({ leftScore: left, rightScore: right }),
  incrementLeft:  () => set((s) => ({ leftScore: s.leftScore + 1 })),
  incrementRight: () => set((s) => ({ rightScore: s.rightScore + 1 })),
  setGameInProgress: (v) => set({ gameInProgress: v }),
  setPaused:      (v) => set({ isPaused: v }),
  setTeam:        (side, index) =>
    side === 'left'
      ? set({ leftTeamIndex: ((index % TEAMS.length) + TEAMS.length) % TEAMS.length })
      : set({ rightTeamIndex: ((index % TEAMS.length) + TEAMS.length) % TEAMS.length }),
  resetGame: (duration) => set({ leftScore: 0, rightScore: 0, elapsed: 0, duration, gameInProgress: true, isPaused: false }),
  tick: () => set((s) => ({ elapsed: s.elapsed + 1 })),
}))
