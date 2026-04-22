'use client'

import { useEffect, useState } from 'react'
import { usePlayerStore } from '@/lib/store'
import { fetchLeaderboard, upsertPlayer, LeaderboardRow } from '@/lib/supabase'
import { sound } from '@/lib/sound'

export default function Dashboard({ onBack }: { onBack: () => void }) {
  const { username, wallet, playerId, walletShort, setPlayer, ensureId } = usePlayerStore()
  const [stats,    setStats]    = useState<LeaderboardRow | null>(null)
  const [editing,  setEditing]  = useState(false)
  const [newName,  setNewName]  = useState(username)
  const [newWallet,setNewWallet]= useState(wallet)
  const [status,   setStatus]   = useState('')

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
    <div className="flex items-center justify-center w-screen h-screen bg-[#2E1E72]">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E8820C]" />
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#E8820C]" />

      <div className="card w-full max-w-xl mx-4">
        {/* Title */}
        <div className="flex items-center gap-2 mb-3">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
          <h1 className="text-xl font-bold">MY DASHBOARD</h1>
        </div>
        <div className="divider" />

        {/* Identity */}
        <div className="flex flex-col gap-2 my-3">
          <div className="flex items-center gap-3">
            <span className="text-[#FAD933] text-sm w-24 shrink-0">USERNAME</span>
            <span className="font-bold">{username}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#FAD933] text-sm w-24 shrink-0">WALLET</span>
            <span className="font-mono text-sm text-[#7ACFFF]">{walletShort()}</span>
          </div>
        </div>

        <div className="h-px bg-white/15 my-2" />

        {/* Stats */}
        <p className="text-[#FAD933] text-sm font-bold text-center mb-2">STATS</p>
        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          <div>
            <p className="text-[#7AE87A] text-xs font-bold">WINS</p>
            <p className="text-2xl font-bold">{stats?.wins ?? 0}</p>
          </div>
          <div>
            <p className="text-[#E87A7A] text-xs font-bold">LOSSES</p>
            <p className="text-2xl font-bold">{stats?.losses ?? 0}</p>
          </div>
          <div>
            <p className="text-[#7ACFFF] text-xs font-bold">GOALS</p>
            <p className="text-2xl font-bold">{stats?.goals_scored ?? 0}</p>
          </div>
        </div>

        {/* Edit */}
        {editing && (
          <div className="flex flex-col gap-2 mb-3">
            <input className="input" placeholder="New username" value={newName}   onChange={e => setNewName(e.target.value)} />
            <input className="input" placeholder="New wallet"   value={newWallet} onChange={e => setNewWallet(e.target.value)} />
          </div>
        )}
        {status && <p className="text-green-400 text-sm text-center mb-2">{status}</p>}

        {/* Buttons */}
        <div className="flex gap-3 justify-center">
          {editing ? (
            <button className="btn" onClick={handleSave}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
              SAVE
            </button>
          ) : (
            <button className="btn btn-purple" onClick={() => { sound.click(); setEditing(true) }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              EDIT PROFILE
            </button>
          )}
          <button className="btn btn-purple" onClick={() => { sound.click(); onBack() }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            BACK
          </button>
        </div>
      </div>
    </div>
  )
}
