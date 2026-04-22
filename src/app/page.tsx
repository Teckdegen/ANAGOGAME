'use client'

import { useState } from 'react'
import { usePlayerStore } from '@/lib/store'
import Onboarding from '@/components/Onboarding'
import Lobby      from '@/components/Lobby'
import GameScreen from '@/components/GameScreen'
import Leaderboard from '@/components/Leaderboard'
import Dashboard  from '@/components/Dashboard'
import { Room }   from '@/lib/supabase'

type Screen = 'onboarding' | 'lobby' | 'game' | 'leaderboard' | 'dashboard'

export default function Home() {
  const { username } = usePlayerStore()
  const [screen, setScreen] = useState<Screen>(username ? 'lobby' : 'onboarding')
  const [gameRoom, setGameRoom] = useState<Room | null>(null)
  const [isHost,   setIsHost]   = useState(false)

  return (
    <>
      {/* Portrait lock overlay */}
      <div id="portrait-lock">
        <div style={{ fontSize: '3rem' }}>↻</div>
        <div>Rotate your phone to landscape to play</div>
      </div>

      {/* Screens */}
      {screen === 'onboarding'  && <Onboarding  onDone={() => setScreen('lobby')} />}
      {screen === 'lobby'       && (
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
