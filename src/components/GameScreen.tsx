'use client'

import { useEffect, useRef, useState } from 'react'
import { Room, submitMatch, leaveRoomRecord, deleteRoom } from '@/lib/supabase'
import { GameEngine, CANVAS_W, CANVAS_H } from '@/lib/gameEngine'
import { drawFrame, drawHUD } from '@/lib/renderer'
import { GameNetwork } from '@/lib/network'
import { usePlayerStore, useGameStore, TEAMS } from '@/lib/store'
import { sound } from '@/lib/sound'

interface Props {
  room:      Room | null      // null = solo/AI mode
  isHost:    boolean          // true = left slime; false = right slime (PvP guest)
  net:       GameNetwork | null  // null = solo/AI mode
  isSolo?:   boolean          // true = play vs AI
  onGameEnd: () => void
}

const GAME_DURATION = 120

export default function GameScreen({ room, isHost, net, isSolo = false, onGameEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const rafRef    = useRef<number>(0)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTime  = useRef<number>(0)
  const gameOverRef = useRef(false)

  const { playerId, username, wallet } = usePlayerStore()
  const { incrementLeft, incrementRight, setScore, resetGame } = useGameStore()

  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [message,  setMessage]  = useState('')
  const [paused,   setPaused]   = useState(false)
  const [gameOver, setGameOver] = useState(false)

  const timeLeftRef = useRef(GAME_DURATION)
  const pausedRef   = useRef(false)
  const messageRef  = useRef('')

  // In PvP: host controls LEFT slime, guest controls RIGHT slime
  // In solo: player always controls LEFT slime, AI controls RIGHT
  const controlsLeft = isSolo || isHost

  useEffect(() => {
    resetGame(GAME_DURATION)
    sound.whistle()

    // Team indices: host/solo = team 0 (left), guest = team 1 (right)
    const engine = new GameEngine(0, 1)
    engineRef.current = engine

    if (isSolo) {
      engine.enableAI()
    }

    // Goal callback
    engine.onGoal = (side) => {
      sound.goal()
      // 'left' goal = right player scores; 'right' goal = left player scores
      if (side === 'left') incrementRight()
      else                 incrementLeft()

      const msg = side === 'left'
        ? `${engine.right.team.name} SCORES!`
        : `${engine.left.team.name} SCORES!`
      messageRef.current = msg
      setMessage(msg)
      setTimeout(() => { messageRef.current = ''; setMessage('') }, 2000)

      // Host is authoritative for scores in PvP
      if (!isSolo && net && isHost) {
        const { leftScore: l, rightScore: r } = useGameStore.getState()
        net.sendGoal(side)
        net.sendScores(l, r)
      }
    }

    // Wire network events (PvP only)
    if (!isSolo && net) {
      net.onEvent = (e) => {
        if (e.type === 'ball_state' && !isHost) {
          // Guest receives ball state from host
          engine.applyRemoteBall(e.pos, e.vel, e.angVel)
        }
        if (e.type === 'slime_state') {
          // Apply the OPPONENT's slime position
          // If I'm host (left), I receive guest's (right) slime → isHost=false in message
          // If I'm guest (right), I receive host's (left) slime → isHost=true in message
          engine.applyRemoteSlime(e.isHost, e.pos)
        }
        if (e.type === 'goal') {
          if (e.side === 'left') incrementRight()
          else                   incrementLeft()
        }
        if (e.type === 'scores') setScore(e.left, e.right)
        if (e.type === 'disconnected') endGame()
      }
    }

    // Timer
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return
      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)
      if (timeLeftRef.current <= 5 && timeLeftRef.current > 0) sound.countdown()
      if (timeLeftRef.current <= 0) endGame()
    }, 1000)

    // Keyboard controls
    const onKeyDown = (e: KeyboardEvent) => handleKey(e, true)
    const onKeyUp   = (e: KeyboardEvent) => handleKey(e, false)

    function handleKey(e: KeyboardEvent, down: boolean) {
      const eng = engineRef.current
      if (!eng) return

      if (controlsLeft) {
        // WASD or Arrow keys → left slime
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft')  eng.setLeftKeys({ left: down })
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') eng.setLeftKeys({ right: down })
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp')    eng.setLeftKeys({ up: down })
      } else {
        // Guest controls right slime
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft')  eng.setRightKeys({ left: down })
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') eng.setRightKeys({ right: down })
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp')    eng.setRightKeys({ up: down })
      }

      if (e.key === 'Escape' && down) togglePause()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)

    // Game loop
    function loop(ts: number) {
      const eng = engineRef.current
      if (!eng) return

      if (!pausedRef.current) {
        const dt = Math.min(ts - lastTime.current, 50)
        lastTime.current = ts
        eng.step(dt)

        if (!isSolo && net) {
          // Host sends ball state to guest
          if (isHost) net.sendBallState([eng.ball.x, eng.ball.y], [eng.ball.vx, eng.ball.vy], eng.ball.angle)
          // Each player sends their own slime position
          const myPos: [number, number] = isHost
            ? [eng.left.x, eng.left.y]
            : [eng.right.x, eng.right.y]
          net.sendSlimeState(myPos)
        }
      }

      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')!
        const { leftScore: ls, rightScore: rs } = useGameStore.getState()
        drawFrame(ctx, eng.left, eng.right, eng.ball)
        drawHUD(ctx, eng.left.team.name, ls, eng.right.team.name, rs, timeLeftRef.current, messageRef.current || undefined)
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    lastTime.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearInterval(timerRef.current!)
      engine.destroy()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function togglePause() {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }

  async function endGame() {
    if (gameOverRef.current) return
    gameOverRef.current = true
    setGameOver(true)
    clearInterval(timerRef.current!)
    cancelAnimationFrame(rafRef.current)
    sound.whistle()

    const { leftScore: ls, rightScore: rs } = useGameStore.getState()

    if (!isSolo && net) {
      const myScore    = isHost ? ls : rs
      const theirScore = isHost ? rs : ls
      net.disconnect()
      await Promise.all([
        submitMatch(playerId, username, wallet, myScore > theirScore, myScore, theirScore).catch(() => {}),
        room
          ? (isHost
              ? deleteRoom(room.id).catch(() => {})
              : leaveRoomRecord(room.id, playerId).catch(() => {}))
          : Promise.resolve(),
      ])
    }

    setTimeout(onGameEnd, 3000)
  }

  // Touch controls — always control your own slime
  const eng = () => engineRef.current
  function touchLeft(down: boolean) {
    controlsLeft ? eng()?.setLeftKeys({ left: down }) : eng()?.setRightKeys({ left: down })
  }
  function touchRight(down: boolean) {
    controlsLeft ? eng()?.setLeftKeys({ right: down }) : eng()?.setRightKeys({ right: down })
  }
  function touchJump(down: boolean) {
    controlsLeft ? eng()?.setLeftKeys({ up: down }) : eng()?.setRightKeys({ up: down })
  }

  const { leftScore: ls, rightScore: rs } = useGameStore()

  return (
    <div className="flex flex-col items-center justify-center w-screen h-screen bg-[#140A0A]">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block max-w-full max-h-[calc(100vh-80px)]"
          style={{ imageRendering: 'pixelated' }}
        />

        {paused && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="card text-center">
              <svg viewBox="0 0 24 24" className="w-10 h-10 fill-[#1A0808] mx-auto mb-2">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
              <p className="text-xl font-bold">PAUSED</p>
              <button className="btn mt-4" onClick={togglePause}>RESUME</button>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="card text-center">
              <p className="text-2xl font-bold text-[#E8820C] mb-2">FINAL WHISTLE!</p>
              <p className="text-lg text-[#1A0808]">{TEAMS[0].name} {ls} — {rs} {TEAMS[1].name}</p>
              <p className="text-[#5C3317] text-sm mt-2">Returning to lobby...</p>
            </div>
          </div>
        )}
      </div>

      {/* Touch controls */}
      <div className="flex items-center justify-between w-full px-6 py-2 gap-4">
        <div className="flex gap-3">
          <button
            className="btn btn-purple w-16 h-14 text-xl select-none"
            onTouchStart={() => touchLeft(true)}  onTouchEnd={() => touchLeft(false)}
            onMouseDown={() => touchLeft(true)}   onMouseUp={() => touchLeft(false)}
            onMouseLeave={() => touchLeft(false)}>◀</button>
          <button
            className="btn btn-purple w-16 h-14 text-xl select-none"
            onTouchStart={() => touchRight(true)} onTouchEnd={() => touchRight(false)}
            onMouseDown={() => touchRight(true)}  onMouseUp={() => touchRight(false)}
            onMouseLeave={() => touchRight(false)}>▶</button>
        </div>
        <button className="btn btn-purple btn-sm" onClick={togglePause}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <button
          className="btn w-20 h-14 text-xl select-none"
          onTouchStart={() => touchJump(true)}  onTouchEnd={() => touchJump(false)}
          onMouseDown={() => touchJump(true)}   onMouseUp={() => touchJump(false)}
          onMouseLeave={() => touchJump(false)}>▲</button>
      </div>
    </div>
  )
}
