'use client'

import { useState, useEffect } from 'react'
import { usePlayerStore } from '@/lib/store'
import Onboarding  from '@/components/Onboarding'
import Lobby       from '@/components/Lobby'
import GameScreen  from '@/components/GameScreen'
import Leaderboard from '@/components/Leaderboard'
import Dashboard   from '@/components/Dashboard'
import { Room }    from '@/lib/supabase'

type Screen = 'onboarding' | 'lobby' | 'game' | 'leaderboard' | 'dashboard'

export default function Home() {
  const { username, wallet } = usePlayerStore()

  // ── Hydration guard ──────────────────────────────────────────────────────
  // Zustand persist rehydrates from localStorage after the first render.
  // We wait one tick before deciding which screen to show so we don't
  // flash the onboarding screen for returning users.
  const [hydrated, setHydrated] = useState(false)
  const [screen,   setScreen]   = useState<Screen>('onboarding')
  const [gameRoom, setGameRoom] = useState<Room | null>(null)
  const [isHost,   setIsHost]   = useState(false)

  useEffect(() => {
    setHydrated(true)
    // After hydration, check if the user already has a saved profile
    const saved = usePlayerStore.getState()
    if (saved.username && saved.wallet) {
      setScreen('lobby')
    } else {
      setScreen('onboarding')
    }
  }, [])

  // Show nothing until hydration is done to avoid flicker
  if (!hydrated) {
    return (
      <div className="w-screen h-screen bg-[#5B4AE8] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-[4px] border-white border-t-[#E8820C] animate-spin" />
      </div>
    )
  }

  return (
    <>
      {screen === 'onboarding' && (
        <Onboarding onDone={() => setScreen('lobby')} />
      )}
      {screen === 'lobby' && (
        <Lobby
          onStartGame={(host, room) => { setIsHost(host); setGameRoom(room); setScreen('game') }}
          onLeaderboard={() => setScreen('leaderboard')}
          onDashboard={()   => setScreen('dashboard')}
        />
      )}
      {screen === 'game' && gameRoom && (
        <GameScreen
          room={gameRoom}
          isHost={isHost}
          onGameEnd={() => setScreen('lobby')}
        />
      )}
      {screen === 'leaderboard' && <Leaderboard onBack={() => setScreen('lobby')} />}
      {screen === 'dashboard'   && <Dashboard   onBack={() => setScreen('lobby')} />}
    </>
  )
}
