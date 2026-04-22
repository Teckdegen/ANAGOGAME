'use client'

import { useEffect, useState } from 'react'
import { usePlayerStore } from '@/lib/store'
import { fetchLeaderboard, upsertPlayer, LeaderboardRow } from '@/lib/supabase'
import { sound } from '@/lib/sound'

export default function Dashboard({ onBack }: { onBack: () => void }) {
  const { username, wallet, walletShort, setPlayer, ensureId } = usePlayerStore()
  const [stats,     setStats]     = useState<LeaderboardRow | null>(null)
  const [editing,   setEditing]   = useState(false)
  const [newName,   setNewName]   = useState(username)
  const [newWallet, setNewWallet] = useState(wallet)
  const [status,    setStatus]    = useState('')

  useEffect(() => {
    fetchLeaderboard().then(rows => {
      const id = ensureId()
      setStats(rows.find(r => r.player_id === id) ?? null)
    }).catch(() => {})
  }, [ensureId])

  async function handleSave() {
    const u = newName.trim()
    const w = newWallet.trim()
    if (!u || !w) { setStatus("Fields can't be empty"); return }
    setPlayer(u, w)
    const id = ensureId()
    await upsertPlayer(id, u, w).catch(() => {})
    setEditing(false)
    setStatus('Saved!')
    setTimeout(() => setStatus(''), 2000)
  }

  return (
    <div className="screen flex items-center justify-center">
      <div className="accent-bar top-0" />
      <div className="accent-bar bottom-0" />

      {/* Decorative dots */}
      <div className="absolute top-8 left-8 w-4 h-4 rounded-full bg-[#FAD933] border-[2px] border-[#1A0808]" />
      <div className="absolute top-8 right-8 w-4 h-4 rounded-full bg-[#F4A0A0] border-[2px] border-[#1A0808]" />

      <div className="card w-full max-w-lg mx-4">
        {/* Title */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl border-[3px] border-[#1A0808] bg-[#7B5CE8] flex items-center justify-center"
               style={{ boxShadow: '0 3px 0 #1A0808' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#1A0808]">MY DASHBOARD</h1>
        </div>

        <div className="divider" />

        {/* Identity */}
        <div className="card-section mb-3">
          <div className="flex items-center gap-3 mb-2">
            <span className="label-pill bg-[#7B5CE8] text-white">USERNAME</span>
            <span className="font-bold text-[#1A0808]">{username}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="label-pill bg-[#E8820C] text-white">WALLET</span>
            <span className="font-mono text-sm text-[#5C3317] font-bold">{walletShort()}</span>
          </div>
        </div>

        {/* Stats */}
        <p className="text-center text-xs font-bold text-[#5C3317] mb-2">STATS</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'WINS',   value: stats?.wins ?? 0,         bg: 'bg-[#D4F5D4]', border: 'border-[#2E7D32]', col: '#2E7D32' },
            { label: 'LOSSES', value: stats?.losses ?? 0,       bg: 'bg-[#FFE0E0]', border: 'border-[#C0392B]', col: '#C0392B' },
            { label: 'GOALS',  value: stats?.goals_scored ?? 0, bg: 'bg-[#E0EEFF]', border: 'border-[#1565C0]', col: '#1565C0' },
          ].map(s => (
            <div key={s.label}
                 className={`rounded-2xl border-[3px] ${s.border} ${s.bg} p-3 text-center`}
                 style={{ boxShadow: `0 3px 0 ${s.border.replace('border-[','').replace(']','')}` }}>
              <p className="text-xs font-bold" style={{ color: s.col }}>{s.label}</p>
              <p className="text-3xl font-bold" style={{ color: s.col }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Edit fields */}
        {editing && (
          <div className="flex flex-col gap-2 mb-3">
            <input className="input" placeholder="New username" value={newName}   onChange={e => setNewName(e.target.value)} />
            <input className="input" placeholder="New wallet"   value={newWallet} onChange={e => setNewWallet(e.target.value)} />
          </div>
        )}

        {status && (
          <p className="text-center text-sm font-bold text-[#2E7D32] mb-2">{status}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-center">
          {editing ? (
            <button className="btn" onClick={handleSave}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
              </svg>
              SAVE
            </button>
          ) : (
            <button className="btn btn-purple" onClick={() => { sound.click(); setEditing(true) }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              EDIT PROFILE
            </button>
          )}
          <button className="btn btn-brown" onClick={() => { sound.click(); onBack() }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            BACK
          </button>
        </div>
      </div>
    </div>
  )
}
