'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Room, submitMatch, deleteRoom } from '@/lib/supabase'
import { GameEngine, CANVAS_W, CANVAS_H } from '@/lib/gameEngine'
import { drawFrame, drawHUD } from '@/lib/renderer'
import { GameNetwork } from '@/lib/network'
import { usePlayerStore, useGameStore, TEAMS } from '@/lib/store'
import { sound } from '@/lib/sound'

interface Props {
  room:      Room
  isHost:    boolean
  onGameEnd: () => void
}

const GAME_DURATION = 120  // 2 minutes

export default function GameScreen({ room, isHost, onGameEnd }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const engineRef  = useRef<GameEngine | null>(null)
  const netRef     = useRef<GameNetwork | null>(null)
  const rafRef     = useRef<number>(0)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTime   = useRef<number>(0)

  const { playerId, username, wallet } = usePlayerStore()
  const { leftScore, rightScore, incrementLeft, incrementRight, setScore, resetGame } = useGameStore()

  const [timeLeft,  setTimeLeft]  = useState(GAME_DURATION)
  const [message,   setMessage]   = useState('')
  const [paused,    setPaused]    = useState(false)
  const [gameOver,  setGameOver]  = useState(false)

  const timeLeftRef = useRef(GAME_DURATION)
  const pausedRef   = useRef(false)

  // ─── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    resetGame(GAME_DURATION)
    sound.whistle()

    const engine = new GameEngine(0, 1)
    engineRef.current = engine

    // Goal callback
    engine.onGoal = (side) => {
      sound.goal()
      if (side === 'left')  incrementRight()
      else                  incrementLeft()

      const scorer = side === 'left'
        ? TEAMS[engine.right.team.name === engine.right.team.name ? 1 : 1].name
        : TEAMS[0].name
      showMessage(side === 'left' ? `${engine.right.team.name} SCORES!` : `${engine.left.team.name} SCORES!`)

      if (isHost) {
        const { leftScore: l, rightScore: r } = useGameStore.getState()
        netRef.current?.sendGoal(side)
        netRef.current?.sendScores(l, r)
      }
    }

    // Network
    const net = new GameNetwork()
    netRef.current = net
    net.onEvent = (e) => {
      if (e.type === 'ball_state'  && !isHost) engine.applyRemoteBall(e.pos, e.vel, e.angVel)
      if (e.type === 'slime_state')            engine.applyRemoteSlime(e.isHost, e.pos)
      if (e.type === 'goal')        { if (e.side === 'left') incrementRight(); else incrementLeft() }
      if (e.type === 'scores')      setScore(e.left, e.right)
      if (e.type === 'disconnected') endGame()
    }

    // Re-attach to existing room (already connected from Lobby)
    // The GameNetwork instance from Lobby is passed via room context
    // For simplicity we re-use the room id to reconnect
    if (isHost) net.hostRoom(room.id, playerId).catch(() => {})
    else        net.joinRoom(room.id, playerId).catch(() => {})

    // Timer
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return
      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)
      if (timeLeftRef.current <= 5 && timeLeftRef.current > 0) sound.countdown()
      if (timeLeftRef.current <= 0) endGame()
    }, 1000)

    // Keyboard
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (isHost) {
        if (e.key === 'a' || e.key === 'ArrowLeft')  engine.setLeftKeys({ left: down })
        if (e.key === 'd' || e.key === 'ArrowRight') engine.setLeftKeys({ right: down })
        if (e.key === 'w' || e.key === 'ArrowUp')    engine.setLeftKeys({ up: down })
      } else {
        if (e.key === 'a' || e.key === 'ArrowLeft')  engine.setRightKeys({ left: down })
        if (e.key === 'd' || e.key === 'ArrowRight') engine.setRightKeys({ right: down })
        if (e.key === 'w' || e.key === 'ArrowUp')    engine.setRightKeys({ up: down })
      }
      if (e.key === 'Escape') togglePause()
    }
    window.addEventListener('keydown', (e) => onKey(e, true))
    window.addEventListener('keyup',   (e) => onKey(e, false))

    // Game loop
    function loop(ts: number) {
      if (!pausedRef.current) {
        const dt = Math.min(ts - lastTime.current, 50)
        lastTime.current = ts
        engine.step(dt)

        // Send state
        if (isHost) {
          net.sendBallState([engine.ball.x, engine.ball.y], [engine.ball.vx, engine.ball.vy], engine.ball.angle)
        }
        net.sendSlimeState(isHost ? [engine.left.x, engine.left.y] : [engine.right.x, engine.right.y])
      }

      // Draw
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')!
        const { leftScore: ls, rightScore: rs } = useGameStore.getState()
        drawFrame(ctx, engine.left, engine.right, engine.ball)
        drawHUD(ctx,
          engine.left.team.name,  ls,
          engine.right.team.name, rs,
          timeLeftRef.current,
          message || undefined
        )
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    lastTime.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearInterval(timerRef.current!)
      engine.destroy()
      net.disconnect()
      window.removeEventListener('keydown', (e) => onKey(e, true))
      window.removeEventListener('keyup',   (e) => onKey(e, false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showMessage(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 2000)
  }

  function togglePause() {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }

  async function endGame() {
    if (gameOver) return
    setGameOver(true)
    clearInterval(timerRef.current!)
    cancelAnimationFrame(rafRef.current)
    sound.whistle()

    const { leftScore: ls, rightScore: rs } = useGameStore.getState()
    const myScore    = isHost ? ls : rs
    const theirScore = isHost ? rs : ls

    // Submit stats + delete room
    await Promise.all([
      submitMatch(playerId, username, wallet, myScore > theirScore, myScore, theirScore).catch(() => {}),
      deleteRoom(room.id).catch(() => {}),
    ])

    setTimeout(onGameEnd, 3000)
  }

  // ─── Touch controls ───────────────────────────────────────────────────────

  function touchLeft()  { isHost ? engineRef.current?.setLeftKeys({ left: true })  : engineRef.current?.setRightKeys({ left: true }) }
  function touchRight() { isHost ? engineRef.current?.setLeftKeys({ right: true }) : engineRef.current?.setRightKeys({ right: true }) }
  function touchJump()  { isHost ? engineRef.current?.setLeftKeys({ up: true })    : engineRef.current?.setRightKeys({ up: true }) }
  function touchRelease() {
    engineRef.current?.setLeftKeys({ left: false, right: false, up: false })
    engineRef.current?.setRightKeys({ left: false, right: false, up: false })
  }

  const { leftScore: ls, rightScore: rs } = useGameStore()

  return (
    <div className="flex flex-col items-center justify-center w-screen h-screen bg-[#140A0A]">
      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block max-w-full max-h-[calc(100vh-80px)]"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Pause overlay */}
        {paused && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="card text-center">
              <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white mx-auto mb-2"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              <p className="text-xl font-bold">PAUSED</p>
              <button className="btn mt-4" onClick={togglePause}>RESUME</button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="card text-center">
              <p className="text-2xl font-bold text-[#FAD933] mb-2">FINAL WHISTLE!</p>
              <p className="text-lg">{TEAMS[0].name} {ls} — {rs} {TEAMS[1].name}</p>
              <p className="text-[#B8A8E8] text-sm mt-2">Returning to lobby...</p>
            </div>
          </div>
        )}
      </div>

      {/* Touch controls */}
      <div className="flex items-center justify-between w-full px-6 py-2 gap-4">
        <div className="flex gap-3">
          <button
            className="btn btn-purple w-16 h-14 text-xl"
            onTouchStart={touchLeft}  onTouchEnd={touchRelease}
            onMouseDown={touchLeft}   onMouseUp={touchRelease}
          >◀</button>
          <button
            className="btn btn-purple w-16 h-14 text-xl"
            onTouchStart={touchRight} onTouchEnd={touchRelease}
            onMouseDown={touchRight}  onMouseUp={touchRelease}
          >▶</button>
        </div>
        <button className="btn btn-purple btn-sm" onClick={togglePause}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <button
          className="btn w-20 h-14 text-xl"
          onTouchStart={touchJump}  onTouchEnd={touchRelease}
          onMouseDown={touchJump}   onMouseUp={touchRelease}
        >▲</button>
      </div>
    </div>
  )
}
