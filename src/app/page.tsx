'use client'

import { useState, useEffect } from 'react'
import { usePlayerStore } from '@/lib/store'
import { GameNetwork }  from '@/lib/network'
import Onboarding  from '@/components/Onboarding'
import Lobby       from '@/components/Lobby'
import GameScreen  from '@/components/GameScreen'
import Leaderboard from '@/components/Leaderboard'
import Dashboard   from '@/components/Dashboard'
import { Room }    from '@/lib/supabase'

type Screen = 'onboarding' | 'lobby' | 'game' | 'leaderboard' | 'dashboard'

export default function Home() {
  const [hydrated, setHydrated] = useState(false)
  const [screen,   setScreen]   = useState<Screen>('onboarding')
  const [gameRoom, setGameRoom] = useState<Room | null>(null)
  const [gameNet,  setGameNet]  = useState<GameNetwork | null>(null)
  const [isHost,   setIsHost]   = useState(false)
  const [isSolo,   setIsSolo]   = useState(false)

  useEffect(() => {
    setHydrated(true)
    const saved = usePlayerStore.getState()
    setScreen(saved.username && saved.wallet ? 'lobby' : 'onboarding')
  }, [])

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
          onStartGame={(host, room, net) => {
            setIsHost(host)
            setIsSolo(false)
            setGameRoom(room)
            setGameNet(net)
            setScreen('game')
          }}
          onStartSolo={() => {
            setIsHost(true)
            setIsSolo(true)
            setGameRoom(null)
            setGameNet(null)
            setScreen('game')
          }}
          onLeaderboard={() => setScreen('leaderboard')}
          onDashboard={()   => setScreen('dashboard')}
        />
      )}
      {screen === 'game' && (
        <GameScreen
          room={gameRoom}
          isHost={isHost}
          net={gameNet}
          isSolo={isSolo}
          onGameEnd={() => {
            setGameNet(null)
            setIsSolo(false)
            setScreen('lobby')
          }}
        />
      )}
      {screen === 'leaderboard' && <Leaderboard onBack={() => setScreen('lobby')} />}
      {screen === 'dashboard'   && <Dashboard   onBack={() => setScreen('lobby')} />}
    </>
  )
}
