'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Room, submitMatch, deleteRoom } from '@/lib/supabase'
import { GameEngine, CANVAS_W, CANVAS_H } from '@/lib/gameEngine'
import { drawFrame, drawHUD } from '@/lib/renderer'
import { GameNetwork } from '@/lib/network'
import { usePlayerStore, useGameStore, TEAMS } from '@/lib/store'
import { sound } from '@/lib/sound'

interface Props {
  room:      Room | null
  isHost:    boolean
  net:       GameNetwork | null
  isSolo?:   boolean
  onGameEnd: () => void
}

const GAME_DURATION = 120

export default function GameScreen({ room, isHost, net, isSolo = false, onGameEnd }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const engineRef   = useRef<GameEngine | null>(null)
  const rafRef      = useRef<number>(0)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  // lastTime = -1 means "not yet initialised" — avoids the first-frame dt spike
  const lastTime    = useRef<number>(-1)
  const gameOverRef = useRef(false)

  const { playerId, username, wallet } = usePlayerStore()
  const { incrementLeft, incrementRight, setScore, resetGame } = useGameStore()

  const [timeLeft,  setTimeLeft]  = useState(GAME_DURATION)
  const [paused,    setPaused]    = useState(false)
  const [gameOver,  setGameOver]  = useState(false)
  // kickOff > 0 means we're in the post-goal freeze, counting down
  const [kickOff,   setKickOff]   = useState(0)

  const timeLeftRef  = useRef(GAME_DURATION)
  const pausedRef    = useRef(false)
  const messageRef   = useRef('')
  const kickOffRef   = useRef(0)

  // host controls left slime; guest / solo controls left slime too (solo = left vs AI right)
  const controlsLeft = isSolo || isHost

  // ─── Key handlers (defined outside useEffect so touch controls can reuse) ─

  const setMyLeft  = useCallback((v: boolean) => {
    const e = engineRef.current; if (!e) return
    controlsLeft ? e.setLeftKeys({ left: v }) : e.setRightKeys({ left: v })
  }, [controlsLeft])

  const setMyRight = useCallback((v: boolean) => {
    const e = engineRef.current; if (!e) return
    controlsLeft ? e.setLeftKeys({ right: v }) : e.setRightKeys({ right: v })
  }, [controlsLeft])

  const setMyJump  = useCallback((v: boolean) => {
    const e = engineRef.current; if (!e) return
    controlsLeft ? e.setLeftKeys({ up: v }) : e.setRightKeys({ up: v })
  }, [controlsLeft])

  useEffect(() => {
    resetGame(GAME_DURATION)
    sound.whistle()

    const engine = new GameEngine(0, 1)
    engineRef.current = engine
    if (isSolo) engine.enableAI()

    // ── Goal callback ──────────────────────────────────────────────────────
    engine.onGoal = (side) => {
      sound.goal()
      if (side === 'left') incrementRight()
      else                 incrementLeft()

      const msg = side === 'left'
        ? `${engine.right.team.name} SCORES!`
        : `${engine.left.team.name} SCORES!`
      messageRef.current = msg

      // Show kick-off countdown (engine freezes for 1.5 s)
      kickOffRef.current = 3
      setKickOff(3)
      const cd = setInterval(() => {
        kickOffRef.current -= 1
        setKickOff(kickOffRef.current)
        if (kickOffRef.current <= 0) {
          clearInterval(cd)
          messageRef.current = ''
        }
      }, 500)

      if (!isSolo && net && isHost) {
        const { leftScore: l, rightScore: r } = useGameStore.getState()
        net.sendGoal(side)
        net.sendScores(l, r)
      }
    }

    // ── Network events (PvP only) ──────────────────────────────────────────
    if (!isSolo && net) {
      net.onEvent = (e) => {
        if (e.type === 'ball_state'  && !isHost) engine.applyRemoteBall(e.pos, e.vel, e.angVel)
        if (e.type === 'slime_state')            engine.applyRemoteSlime(e.isHost, e.pos)
        if (e.type === 'goal')  { if (e.side === 'left') incrementRight(); else incrementLeft() }
        if (e.type === 'scores') setScore(e.left, e.right)
        if (e.type === 'disconnected') endGame()
      }
    }

    // ── Timer ──────────────────────────────────────────────────────────────
    timerRef.current = setInterval(() => {
      if (pausedRef.current || engine.frozen) return
      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)
      if (timeLeftRef.current <= 5 && timeLeftRef.current > 0) sound.countdown()
      if (timeLeftRef.current <= 0) endGame()
    }, 1000)

    // ── Keyboard ───────────────────────────────────────────────────────────
    function handleKey(ev: KeyboardEvent, down: boolean) {
      // Prevent browser scroll on arrow keys
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(ev.key)) ev.preventDefault()

      const eng = engineRef.current; if (!eng) return
      if (controlsLeft) {
        if (ev.key === 'ArrowLeft'  || ev.key === 'a' || ev.key === 'A') eng.setLeftKeys({ left:  down })
        if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') eng.setLeftKeys({ right: down })
        if (ev.key === 'ArrowUp'    || ev.key === 'w' || ev.key === 'W') eng.setLeftKeys({ up:    down })
      } else {
        if (ev.key === 'ArrowLeft'  || ev.key === 'a' || ev.key === 'A') eng.setRightKeys({ left:  down })
        if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') eng.setRightKeys({ right: down })
        if (ev.key === 'ArrowUp'    || ev.key === 'w' || ev.key === 'W') eng.setRightKeys({ up:    down })
      }
      if (ev.key === 'Escape' && down) togglePause()
    }
    const onKeyDown = (e: KeyboardEvent) => handleKey(e, true)
    const onKeyUp   = (e: KeyboardEvent) => handleKey(e, false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)

    // ── Game loop ──────────────────────────────────────────────────────────
    function loop(ts: number) {
      const eng = engineRef.current; if (!eng) return

      // First frame: just record the timestamp, don't step (avoids huge dt spike)
      if (lastTime.current < 0) {
        lastTime.current = ts
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      if (!pausedRef.current) {
        // Cap dt at 100 ms so a tab-switch doesn't explode the accumulator
        const dt = Math.min(ts - lastTime.current, 100)
        lastTime.current = ts
        eng.step(dt)

        if (!isSolo && net) {
          if (isHost) net.sendBallState([eng.ball.x, eng.ball.y], [eng.ball.vx, eng.ball.vy], eng.ball.angle)
          const myPos: [number, number] = isHost ? [eng.left.x, eng.left.y] : [eng.right.x, eng.right.y]
          net.sendSlimeState(myPos)
        }
      } else {
        // Still update lastTime while paused so we don't get a spike on resume
        lastTime.current = ts
      }

      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')!
        const { leftScore: ls, rightScore: rs } = useGameStore.getState()
        drawFrame(ctx, eng.left, eng.right, eng.ball, eng.leftCampWarning, eng.rightCampWarning)
        drawHUD(
          ctx,
          eng.left.team.name,  ls,
          eng.right.team.name, rs,
          timeLeftRef.current,
          messageRef.current || undefined,
          eng.leftCampWarning,
          eng.rightCampWarning,
        )
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    lastTime.current = -1   // reset sentinel
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
    // Release all keys when pausing so nothing is held on resume
    engineRef.current?.clearKeys()
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }

  async function endGame() {
    if (gameOverRef.current) return
    gameOverRef.current = true
    // Release keys immediately
    engineRef.current?.clearKeys()
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
        room ? deleteRoom(room.id).catch(() => {}) : Promise.resolve(),
      ])
    }
    setTimeout(onGameEnd, 3000)
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

        {/* Kick-off overlay — shown after a goal during the 1.5 s freeze */}
        {kickOff > 0 && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div
              className="px-8 py-4 rounded-2xl border-[4px] border-[#1A0808] bg-[#E8820C] text-white text-center"
              style={{ boxShadow: '0 6px 0 #1A0808' }}
            >
              <p className="text-3xl font-bold" style={{ textShadow: '0 3px 0 #1A0808' }}>
                {messageRef.current}
              </p>
              <p className="text-lg font-bold mt-1 text-[#FAD933]">
                KICK OFF IN {kickOff}…
              </p>
            </div>
          </div>
        )}

        {paused && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="card text-center flex flex-col items-center gap-3">
              <svg viewBox="0 0 24 24" className="w-10 h-10 fill-[#1A0808] mx-auto">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
              <p className="text-xl font-bold">PAUSED</p>
              <button className="btn" onClick={togglePause}>RESUME</button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => { if (window.confirm('End game and return to lobby?')) endGame() }}
              >END GAME</button>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="card text-center">
              <p className="text-2xl font-bold text-[#E8820C] mb-2">FINAL WHISTLE!</p>
              <p className="text-lg text-[#1A0808]">{TEAMS[0].name} {ls} — {rs} {TEAMS[1].name}</p>
              <p className="text-[#5C3317] text-sm mt-2">Returning to lobby…</p>
            </div>
          </div>
        )}
      </div>

      {/* Touch / on-screen controls */}
      <div className="flex items-center justify-between w-full px-6 py-2 gap-4">
        <div className="flex gap-3">
          <button
            className="btn btn-purple w-16 h-14 text-xl select-none touch-none"
            onPointerDown={() => setMyLeft(true)}
            onPointerUp={() => setMyLeft(false)}
            onPointerLeave={() => setMyLeft(false)}
            onPointerCancel={() => setMyLeft(false)}
          >◀</button>
          <button
            className="btn btn-purple w-16 h-14 text-xl select-none touch-none"
            onPointerDown={() => setMyRight(true)}
            onPointerUp={() => setMyRight(false)}
            onPointerLeave={() => setMyRight(false)}
            onPointerCancel={() => setMyRight(false)}
          >▶</button>
        </div>

        <button className="btn btn-purple btn-sm" onClick={togglePause}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>

        <button
          className="btn w-20 h-14 text-xl select-none touch-none"
          onPointerDown={() => setMyJump(true)}
          onPointerUp={() => setMyJump(false)}
          onPointerLeave={() => setMyJump(false)}
          onPointerCancel={() => setMyJump(false)}
        >▲</button>
      </div>
    </div>
  )
}
