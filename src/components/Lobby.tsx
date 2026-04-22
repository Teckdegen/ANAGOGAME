'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePlayerStore } from '@/lib/store'
import { fetchOpenRooms, createRoom, joinRoomRecord, deleteRoom, Room } from '@/lib/supabase'
import { GameNetwork } from '@/lib/network'
import { sound } from '@/lib/sound'

interface Props {
  onStartGame: (isHost: boolean, room: Room) => void
  onLeaderboard: () => void
  onDashboard:   () => void
}

type Panel = 'rooms' | 'waiting'

export default function Lobby({ onStartGame, onLeaderboard, onDashboard }: Props) {
  const { username, walletShort, playerId, ensureId } = usePlayerStore()
  const [panel,       setPanel]       = useState<Panel>('rooms')
  const [rooms,       setRooms]       = useState<Room[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [waitTitle,   setWaitTitle]   = useState('ROOM OPEN')
  const [waitStatus,  setWaitStatus]  = useState('Waiting for another player...')
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)

  const netRef        = useRef<GameNetwork | null>(null)
  const abandonRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const id            = ensureId()

  // ─── Room polling ────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const data = await fetchOpenRooms()
      setRooms(data.filter(r => r.host_id !== id))
    } catch { setError('Could not load rooms') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => {
    refresh()
    pollRef.current = setInterval(refresh, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [refresh])

  // ─── Create room ─────────────────────────────────────────────────────────

  async function handleCreate() {
    sound.confirm()
    setError('')
    setPanel('waiting')
    setWaitTitle('ROOM OPEN')
    setWaitStatus('Waiting for another player...')

    try {
      const room = await createRoom(`${username}'s room`, id, username)
      setCurrentRoom(room)

      // 10-second abandon timer
      abandonRef.current = setTimeout(async () => {
        await deleteRoom(room.id).catch(() => {})
        setPanel('rooms')
        setError('Room closed — no one joined in time')
      }, 10_000)

      // Start WebRTC as host
      const net = new GameNetwork()
      netRef.current = net
      net.onEvent = (e) => {
        if (e.type === 'connected') {
          clearTimeout(abandonRef.current!)
          setWaitStatus('Connected!')
        }
        if (e.type === 'failed') {
          setError(e.reason)
          setPanel('rooms')
          deleteRoom(room.id).catch(() => {})
        }
        if (e.type === 'connected') {
          // Small delay so both sides are ready
          setTimeout(() => onStartGame(true, room), 300)
        }
      }
      await net.hostRoom(room.id, id)
    } catch (err: any) {
      setError(err.message ?? 'Could not create room')
      setPanel('rooms')
    }
  }

  // ─── Join room ───────────────────────────────────────────────────────────

  async function handleJoin(room: Room) {
    sound.click()
    setError('')
    setCurrentRoom(room)
    setPanel('waiting')
    setWaitTitle('JOINING...')
    setWaitStatus('Waiting for another player...')

    await joinRoomRecord(room.id, id, username).catch(() => {})

    const net = new GameNetwork()
    netRef.current = net
    net.onEvent = (e) => {
      if (e.type === 'connected') {
        setWaitStatus('Connected!')
        setTimeout(() => onStartGame(false, room), 300)
      }
      if (e.type === 'failed') {
        setError(e.reason)
        setPanel('rooms')
      }
    }
    await net.joinRoom(room.id, id)
  }

  // ─── Cancel ──────────────────────────────────────────────────────────────

  async function handleCancel() {
    sound.click()
    clearTimeout(abandonRef.current!)
    netRef.current?.disconnect()
    netRef.current = null
    if (currentRoom) await deleteRoom(currentRoom.id).catch(() => {})
    setCurrentRoom(null)
    setPanel('rooms')
    refresh()
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (panel === 'waiting') {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-[#2E1E72]">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E8820C]" />
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#E8820C]" />
        <div className="card text-center flex flex-col items-center gap-5 min-w-[320px]">
          <h2 className="text-2xl font-bold">{waitTitle}</h2>
          <svg viewBox="0 0 24 24" className="w-12 h-12 fill-[#FAD933] animate-pulse">
            <path d="M6 2v6l4 4-4 4v6h12v-6l-4-4 4-4V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5-4-4V4h8v3.5l-4 4z"/>
          </svg>
          <p className="text-[#B8A8E8]">{waitStatus}</p>
          <button className="btn btn-danger btn-sm" onClick={handleCancel}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            CANCEL
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-[#2E1E72] overflow-hidden">
      <div className="h-1.5 bg-[#E8820C]" />

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b-2 border-[#E8820C]/50">
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white shrink-0"><circle cx="12" cy="12" r="10"/></svg>
        <span className="text-xl font-bold flex-1">SLIME SOCCER</span>
        <span className="text-[#FAD933] text-sm truncate max-w-[200px]">{username}  {walletShort()}</span>
        <button className="btn btn-purple btn-sm" onClick={() => { sound.click(); onDashboard() }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
        </button>
        <button className="btn btn-purple btn-sm" onClick={() => { sound.click(); onLeaderboard() }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V18H8v2h8v-2h-3v-2.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z"/></svg>
        </button>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-lg font-bold flex-1">OPEN ROOMS</span>
        <button className="btn btn-purple btn-sm" onClick={() => { sound.click(); refresh() }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
        </button>
        <button className="btn text-sm" onClick={handleCreate}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          CREATE ROOM
        </button>
      </div>

      <div className="divider mx-4" />

      {/* Room list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2">
        {loading && <p className="text-center text-[#B8A8E8] mt-8">Looking for rooms...</p>}
        {!loading && rooms.length === 0 && (
          <p className="text-center text-[#B8A8E8] mt-8">No open rooms — create one!</p>
        )}
        {rooms.map(room => (
          <button
            key={room.id}
            className="btn btn-purple w-full text-left justify-start text-base"
            onClick={() => handleJoin(room)}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0"><circle cx="12" cy="12" r="10"/></svg>
            {room.host_name}'s room
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm text-center px-4 pb-2">{error}</p>}
      <div className="h-1.5 bg-[#E8820C]" />
    </div>
  )
}
