'use client'

import { useState } from 'react'
import { usePlayerStore } from '@/lib/store'
import { upsertPlayer } from '@/lib/supabase'
import { sound } from '@/lib/sound'

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { username, wallet, setPlayer } = usePlayerStore()
  const [name,  setName]  = useState(username)
  const [addr,  setAddr]  = useState(wallet)
  const [error, setError] = useState('')
  const [busy,  setBusy]  = useState(false)

  const isReturning = !!username

  async function handleSubmit() {
    sound.confirm()
    setError('')
    const u = name.trim()
    const w = addr.trim()
    if (!u || u.length < 2) { setError('Username must be at least 2 characters'); return }
    if (!w)                  { setError('Enter your wallet address'); return }
    setBusy(true)
    setPlayer(u, w)
    const id = usePlayerStore.getState().ensureId()
    await upsertPlayer(id, u, w).catch(() => {})
    setBusy(false)
    onDone()
  }

  return (
    <div className="screen flex items-center justify-center">
      {/* Accent bars */}
      <div className="accent-bar top-0" />
      <div className="accent-bar bottom-0" />

      {/* Decorative dots */}
      <div className="absolute top-8 left-8 w-5 h-5 rounded-full bg-[#FAD933] border-[2px] border-[#1A0808]" />
      <div className="absolute top-8 right-8 w-5 h-5 rounded-full bg-[#F4A0A0] border-[2px] border-[#1A0808]" />
      <div className="absolute bottom-8 left-8 w-5 h-5 rounded-full bg-[#F4A0A0] border-[2px] border-[#1A0808]" />
      <div className="absolute bottom-8 right-8 w-5 h-5 rounded-full bg-[#FAD933] border-[2px] border-[#1A0808]" />

      <div className="card w-full max-w-md mx-4">
        {/* Title */}
        <div className="flex items-center justify-center gap-3 mb-2">
          {/* Ball icon */}
          <div className="w-10 h-10 rounded-full bg-white border-[3px] border-[#1A0808] flex items-center justify-center"
               style={{ boxShadow: '0 3px 0 #1A0808' }}>
            <svg viewBox="0 0 24 24" className="w-7 h-7">
              <circle cx="12" cy="12" r="10" fill="#1A0808"/>
              <circle cx="12" cy="12" r="8" fill="white"/>
              <path fill="#1A0808" d="M12 4a8 8 0 1 0 0 16A8 8 0 0 0 12 4zm0 1.5c.9 0 1.8.2 2.6.55L12.8 9H11.2L9.4 6.05A6.5 6.5 0 0 1 12 5.5zm-3.4 1.3L10.2 9H7.5a6.52 6.52 0 0 1 1.1-2.2zm-2.1 3.7h3l1.5 2.3-1.1 3.4a6.5 6.5 0 0 1-3.4-5.7zm2.4 5.6L10 13h4l1.1 3.1A6.5 6.5 0 0 1 8.9 16.1zm6.7.6L14.5 13.5l1.5-2.3h3a6.5 6.5 0 0 1-3.4 5.5zm1.9-6.7h-3l-1.5-2.3 1.1-2.2a6.52 6.52 0 0 1 3.4 4.5z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[#1A0808]" style={{ textShadow: '0 2px 0 rgba(0,0,0,0.15)' }}>
            SLIME SOCCER
          </h1>
        </div>

        {/* Welcome / subtitle */}
        {isReturning ? (
          <div className="text-center mb-4">
            <span className="label-pill bg-[#7B5CE8]">Welcome back, {username}!</span>
          </div>
        ) : (
          <p className="text-center text-[#5C3317] font-bold text-sm mb-4">
            Enter your details to play
          </p>
        )}

        <div className="flex flex-col gap-3">
          {/* Username */}
          <div>
            <label className="block text-xs font-bold text-[#5C3317] mb-1 ml-1">USERNAME</label>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl border-[3px] border-[#1A0808] bg-[#7B5CE8] flex items-center justify-center shrink-0"
                   style={{ boxShadow: '0 3px 0 #1A0808' }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
              <input
                className="input flex-1"
                placeholder="Pick a username"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={20}
              />
            </div>
          </div>

          {/* Wallet */}
          <div>
            <label className="block text-xs font-bold text-[#5C3317] mb-1 ml-1">WALLET ADDRESS</label>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl border-[3px] border-[#1A0808] bg-[#E8820C] flex items-center justify-center shrink-0"
                   style={{ boxShadow: '0 3px 0 #1A0808' }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                  <path d="M21 7.28V5c0-1.1-.9-2-2-2H5C3.89 3 3 3.9 3 5v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-2.28A2 2 0 0 0 22 15v-4a2 2 0 0 0-1-1.72zM20 15h-5a2 2 0 0 1 0-4h5v4zM5 19V5h14v2h-6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6v2H5z"/>
                </svg>
              </div>
              <input
                className="input flex-1"
                placeholder="Your wallet (for rewards)"
                value={addr}
                onChange={e => setAddr(e.target.value)}
              />
            </div>
            <p className="text-[#8B5E3C] text-xs mt-1 ml-1">
              Your wallet address is used to send you prize rewards
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border-[2px] border-[#C0392B] bg-[#FFE8E8] px-3 py-2 text-[#C0392B] text-sm font-bold text-center">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            className="btn w-full text-lg mt-1"
            onClick={handleSubmit}
            disabled={busy}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M8 5v14l11-7z"/></svg>
            {busy ? 'LOADING...' : "LET'S PLAY!"}
          </button>
        </div>
      </div>
    </div>
  )
}
