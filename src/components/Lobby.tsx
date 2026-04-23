'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePlayerStore } from '@/lib/store'
import { fetchOpenRooms, createRoom, joinRoomRecord, leaveRoomRecord, deleteRoom, Room } from '@/lib/supabase'
import { GameNetwork } from '@/lib/network'
import { sound } from '@/lib/sound'

interface Props {
  // net is passed so GameScreen reuses the already-connected instance
  onStartGame:   (isHost: boolean, room: Room, net: GameNetwork) => void
  onStartSolo:   () => void
  onLeaderboard: () => void
  onDashboard:   () => void
}

type Panel = 'rooms' | 'waiting'

export default function Lobby({ onStartGame, onStartSolo, onLeaderboard, onDashboard }: Props) {
  const { username, ensureId } = usePlayerStore()
  const [panel,       setPanel]       = useState<Panel>('rooms')
  const [rooms,       setRooms]       = useState<Room[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [waitTitle,   setWaitTitle]   = useState('ROOM OPEN')
  const [waitStatus,  setWaitStatus]  = useState('Waiting for another player...')
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [ownsRoom,    setOwnsRoom]    = useState(false)

  const netRef     = useRef<GameNetwork | null>(null)
  const abandonRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(false)   // prevent double-fire of onStartGame
  const id         = ensureId()

  const refresh = useCallback(async () => {
    try {
      const data = await fetchOpenRooms()
      setRooms(data.filter(r => r.host_id !== id))
      setError('')
    } catch { setError('Could not load rooms. Check your internet / Supabase config.') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => {
    refresh()
    pollRef.current = setInterval(refresh, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [refresh])

  // ─── Create room ──────────────────────────────────────────────────────

  async function handleCreate() {
    sound.confirm()
    setError('')
    startedRef.current = false
    setPanel('waiting')
    setWaitTitle('ROOM OPEN')
    setWaitStatus('Waiting for another player...')

    try {
      const room = await createRoom(`${username}'s room`, id, username)
      setCurrentRoom(room)
      setOwnsRoom(true)

      // 30-second abandon timer — WebRTC can take time on mobile/TURN
      abandonRef.current = setTimeout(async () => {
        if (startedRef.current) return   // game already started, don't delete
        await deleteRoom(room.id).catch(() => {})
        setPanel('rooms')
        setError('Room closed — no one joined in 30 seconds')
      }, 30_000)

      const net = new GameNetwork()
      netRef.current = net

      net.onEvent = (e) => {
        if (e.type === 'connected' && !startedRef.current) {
          startedRef.current = true
          clearTimeout(abandonRef.current!)   // ← cancel abandon timer
          setWaitStatus('Connected! Starting...')
          setTimeout(() => onStartGame(true, room, net), 400)
        }
        if (e.type === 'failed') {
          clearTimeout(abandonRef.current!)
          setError(e.reason)
          setPanel('rooms')
          deleteRoom(room.id).catch(() => {})
        }
      }

      await net.hostRoom(room.id, id)
    } catch (err: any) {
      setError(err.message ?? 'Could not create room. Check your internet / Supabase config.')
      setPanel('rooms')
    }
  }

  // ─── Join room ────────────────────────────────────────────────────────

  async function handleJoin(room: Room) {
    sound.click()
    setError('')
    startedRef.current = false
    setCurrentRoom(room)
    setOwnsRoom(false)
    setPanel('waiting')
    setWaitTitle('JOINING...')
    setWaitStatus('Connecting to host...')

    await joinRoomRecord(room.id, id, username).catch(() => {})

    const net = new GameNetwork()
    netRef.current = net

    net.onEvent = (e) => {
      if (e.type === 'connected' && !startedRef.current) {
        startedRef.current = true
        setWaitStatus('Connected! Starting...')
        setTimeout(() => onStartGame(false, room, net), 400)
      }
      if (e.type === 'failed') {
        leaveRoomRecord(room.id, id).catch(() => {})
        setError(e.reason)
        setPanel('rooms')
      }
    }

    await net.joinRoom(room.id, id)
  }

  // ─── Cancel ───────────────────────────────────────────────────────────

  async function handleCancel() {
    sound.click()
    if (abandonRef.current) clearTimeout(abandonRef.current)
    netRef.current?.disconnect()
    netRef.current = null
    if (currentRoom) {
      if (ownsRoom) await deleteRoom(currentRoom.id).catch(() => {})
      else await leaveRoomRecord(currentRoom.id, id).catch(() => {})
    }
    setCurrentRoom(null)
    setOwnsRoom(false)
    setPanel('rooms')
    refresh()
  }

  async function handleQuickPlayPvp() {
    sound.confirm()
    setError('')
    setLoading(true)
    try {
      const data = await fetchOpenRooms()
      const open = data.filter(r => r.host_id !== id)
      if (open.length > 0) await handleJoin(open[0])
      else await handleCreate()
    } catch {
      setError('Could not start PvP')
    } finally {
      setLoading(false)
    }
  }

  // ─── Waiting panel ────────────────────────────────────────────────────

  if (panel === 'waiting') {
    return (
      <div className="screen flex items-center justify-center">
        <div className="accent-bar top-0" />
        <div className="accent-bar bottom-0" />
        <div className="card text-center flex flex-col items-center gap-5 min-w-[300px] max-w-sm w-full mx-4">
          <h2 className="text-2xl font-bold text-[#1A0808]">{waitTitle}</h2>
          <div className="w-16 h-16 rounded-2xl border-[3px] border-[#1A0808] bg-[#7B5CE8] flex items-center justify-center"
               style={{ boxShadow: '0 4px 0 #1A0808' }}>
            <svg viewBox="0 0 24 24" className="w-9 h-9 fill-white animate-pulse">
              <path d="M6 2v6l4 4-4 4v6h12v-6l-4-4 4-4V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5-4-4V4h8v3.5l-4 4z"/>
            </svg>
          </div>
          <p className="text-[#5C3317] font-bold">{waitStatus}</p>
          <button className="btn btn-danger btn-sm" onClick={handleCancel}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            CANCEL
          </button>
        </div>
      </div>
    )
  }

  // ─── Rooms panel ──────────────────────────────────────────────────────

  return (
    <div className="screen flex flex-col">
      <div className="accent-bar top-0" />

      <div className="flex items-center gap-2 px-4 pt-8 pb-2">
        <div className="w-9 h-9 rounded-full border-[3px] border-[#1A0808] bg-white flex items-center justify-center shrink-0"
             style={{ boxShadow: '0 3px 0 #1A0808' }}>
          <svg viewBox="0 0 24 24" className="w-6 h-6">
            <circle cx="12" cy="12" r="10" fill="#1A0808"/>
            <circle cx="12" cy="12" r="8" fill="white"/>
          </svg>
        </div>
        <span className="text-xl font-bold text-white flex-1" style={{ textShadow: '0 2px 0 #1A0808' }}>
          SLIME SOCCER
        </span>
        <div className="flex items-center gap-1 px-3 py-1 rounded-full border-[2px] border-[#1A0808] bg-[#FAD933]"
             style={{ boxShadow: '0 2px 0 #1A0808' }}>
          <span className="text-[#1A0808] text-xs font-bold truncate max-w-[100px]">{username}</span>
        </div>
        <button className="btn btn-purple btn-sm" onClick={() => { sound.click(); onDashboard() }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
          </svg>
        </button>
        <button className="btn btn-sm" onClick={() => { sound.click(); onLeaderboard() }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
            <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V18H8v2h8v-2h-3v-2.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-white font-bold text-lg flex-1" style={{ textShadow: '0 2px 0 #1A0808' }}>
          OPEN ROOMS
        </span>
        <button className="btn btn-purple btn-sm" onClick={() => { sound.click(); refresh() }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
            <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
        <button className="btn btn-purple btn-sm" onClick={handleQuickPlayPvp}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M8 5v14l11-7z"/></svg>
          PLAY PVP
        </button>
        <button className="btn text-sm" onClick={handleCreate}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          CREATE ROOM
        </button>
      </div>

      <div className="mx-4 h-[3px] rounded-full bg-[#E8820C] border-y border-[#1A0808] mb-2" />

      {/* Solo / AI play button */}
      <div className="px-4 mb-3">
        <button
          disabled
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-[3px] border-[#1A0808] bg-[#FAD933] font-bold text-[#1A0808] text-base opacity-50 pointer-events-none"
          style={{ boxShadow: '0 4px 0 #1A0808' }}
        >
          <div className="w-9 h-9 rounded-xl border-[2px] border-[#1A0808] bg-[#E8820C] flex items-center justify-center shrink-0"
               style={{ boxShadow: '0 2px 0 #1A0808' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-[#1A0808]">PLAY vs AI</p>
            <p className="text-xs text-[#5C3317] font-normal">Solo practice — no opponent needed</p>
          </div>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#1A0808]"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 mb-2">
        <span className="text-white font-bold text-sm" style={{ textShadow: '0 1px 0 #1A0808' }}>
          — OR JOIN A PVP ROOM —
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2">
        {loading && <p className="text-center text-white/70 font-bold mt-8">Looking for rooms...</p>}
        {!loading && rooms.length === 0 && (
          <div className="flex flex-col items-center gap-3 mt-8">
            <div className="w-16 h-16 rounded-2xl border-[3px] border-[#1A0808] bg-white flex items-center justify-center"
                 style={{ boxShadow: '0 4px 0 #1A0808' }}>
              <svg viewBox="0 0 24 24" className="w-9 h-9 fill-[#7B5CE8]">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </div>
            <p className="text-white font-bold text-center" style={{ textShadow: '0 1px 0 #1A0808' }}>
              No open rooms yet!<br/>
              <span className="text-[#FAD933]">Create one to start playing</span>
            </p>
          </div>
        )}
        {rooms.map(room => (
          <button key={room.id} className="room-card" onClick={() => handleJoin(room)}>
            <div className="w-9 h-9 rounded-xl border-[2px] border-[#1A0808] bg-[#7B5CE8] flex items-center justify-center shrink-0"
                 style={{ boxShadow: '0 2px 0 #1A0808' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><circle cx="12" cy="12" r="10"/></svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#1A0808]">{room.host_name}'s room</p>
              <p className="text-xs text-[#5C3317]">Tap to join</p>
            </div>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#7B5CE8]"><path d="M8 5v14l11-7z"/></svg>
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-xl border-[2px] border-[#C0392B] bg-[#FFE8E8] px-3 py-2 text-[#C0392B] text-sm font-bold text-center">
          {error}
        </div>
      )}
      <div className="accent-bar bottom-0" />
    </div>
  )
}
