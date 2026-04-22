'use client'

import { useState } from 'react'
import { usePlayerStore } from '@/lib/store'
import { upsertPlayer }   from '@/lib/supabase'
import { sound }          from '@/lib/sound'

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { username, wallet, setPlayer } = usePlayerStore()
  const [name,   setName]   = useState(username)
  const [addr,   setAddr]   = useState(wallet)
  const [error,  setError]  = useState('')

  async function handleSubmit() {
    sound.confirm()
    setError('')
    const u = name.trim()
    const w = addr.trim()
    if (!u || u.length < 2) { setError('Username must be at least 2 characters'); return }
    if (!w)                  { setError('Enter your wallet address'); return }
    setPlayer(u, w)
    const id = usePlayerStore.getState().ensureId()
    await upsertPlayer(id, u, w).catch(() => {})
    onDone()
  }

  const isReturning = !!username

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-[#2E1E72]">
      {/* Orange accent stripes */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-[#E8820C]" />
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#E8820C]" />

      <div className="card w-full max-w-lg mx-4">
        {/* Title */}
        <div className="flex items-center justify-center gap-3 mb-1">
          <svg viewBox="0 0 24 24" className="w-9 h-9 fill-white"><circle cx="12" cy="12" r="10"/><path fill="#333" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 2c1.2 0 2.4.27 3.5.74L13 8H11L8.5 4.74A8 8 0 0 1 12 4zm-4.5 1.74L9.5 9H6.27A8.02 8.02 0 0 1 7.5 5.74zM4.26 11H8l2 3-1.5 4.5A8.01 8.01 0 0 1 4.26 11zm3.24 7.26L9 14h6l1.5 4.26A8 8 0 0 1 7.5 18.26zm9 .74L15 14.5l2-3h3.74a8.01 8.01 0 0 1-4.24 7.5zM19.74 11H16l-2-3 1.5-3.26A8.02 8.02 0 0 1 19.74 11z"/></svg>
          <h1 className="text-3xl font-bold">SLIME SOCCER</h1>
        </div>

        {isReturning && (
          <p className="text-center text-[#FAD933] mb-3">Welcome back, {username}!</p>
        )}
        <p className="text-center text-[#B8A8E8] text-sm mb-5">Enter your details to play</p>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#8878CC] shrink-0"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
            <input className="input" placeholder="Username" value={name} onChange={e => setName(e.target.value)} maxLength={20} />
          </div>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#8878CC] shrink-0"><path d="M21 7.28V5c0-1.1-.9-2-2-2H5C3.89 3 3 3.9 3 5v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-2.28A2 2 0 0 0 22 15v-4a2 2 0 0 0-1-1.72zM20 15h-5a2 2 0 0 1 0-4h5v4zM5 19V5h14v2h-6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6v2H5z"/></svg>
            <input className="input" placeholder="Wallet address (for rewards)" value={addr} onChange={e => setAddr(e.target.value)} />
          </div>
          <p className="text-[#8878CC] text-xs text-center">Your wallet is used to send you prize rewards</p>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button className="btn w-full text-lg mt-2" onClick={handleSubmit}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M8 5v14l11-7z"/></svg>
            LET'S PLAY
          </button>
        </div>
      </div>
    </div>
  )
}
