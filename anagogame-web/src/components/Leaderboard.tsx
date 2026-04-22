'use client'

import { useEffect, useState } from 'react'
import { fetchLeaderboard, LeaderboardRow } from '@/lib/supabase'
import { sound } from '@/lib/sound'

const GOLD   = '#FAD933'
const SILVER = '#C0C0C8'
const BRONZE = '#CD7F32'

function rankColor(rank: number) {
  if (rank === 1) return GOLD
  if (rank === 2) return SILVER
  if (rank === 3) return BRONZE
  return '#FFFFFF'
}

function shortWallet(w: string) {
  if (!w || w.length <= 12) return w
  return `${w.slice(0, 6)}...${w.slice(-4)}`
}

export default function Leaderboard({ onBack }: { onBack: () => void }) {
  const [rows,    setRows]    = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [toast,   setToast]   = useState('')

  async function load() {
    setLoading(true)
    try {
      setRows(await fetchLeaderboard())
    } catch { setError('Could not load leaderboard') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setToast(`Copied: ${label}`)
      setTimeout(() => setToast(''), 1800)
    })
  }

  const rankLabel = (i: number) => ['1st', '2nd', '3rd'][i] ?? String(i + 1)

  return (
    <div className="flex flex-col w-screen h-screen bg-[#2E1E72] overflow-hidden">
      <div className="h-1.5 bg-[#E8820C]" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2">
        <button className="btn btn-purple btn-sm" onClick={() => { sound.click(); onBack() }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#FAD933]"><path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V18H8v2h8v-2h-3v-2.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z"/></svg>
        <h1 className="text-xl font-bold flex-1">LEADERBOARD</h1>
        <button className="btn btn-purple btn-sm" onClick={() => { sound.click(); load() }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
        </button>
      </div>

      <div className="divider mx-4" />

      {/* Column headers */}
      <div className="grid grid-cols-[48px_1fr_1fr_52px_52px_60px] gap-1 px-4 py-1 text-[#FAD933] text-xs font-bold">
        <span className="text-center">#</span>
        <span>PLAYER</span>
        <span className="text-[#7ACFFF]">WALLET</span>
        <span className="text-center">W</span>
        <span className="text-center">L</span>
        <span className="text-center flex items-center justify-center gap-1">
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><circle cx="12" cy="12" r="10"/></svg>
        </span>
      </div>
      <div className="h-px bg-white/15 mx-4" />

      {/* Rows */}
      <div className="flex-1 overflow-y-auto px-4 py-1">
        {loading && <p className="text-center text-[#B8A8E8] mt-8">Loading...</p>}
        {error   && <p className="text-center text-red-400 mt-8">{error}</p>}
        {!loading && rows.length === 0 && <p className="text-center text-[#B8A8E8] mt-8">No scores yet — be the first!</p>}
        {rows.map((row, i) => {
          const col = rankColor(i + 1)
          return (
            <div
              key={row.player_id}
              className={`grid grid-cols-[48px_1fr_1fr_52px_52px_60px] gap-1 py-2 items-center text-sm border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
            >
              <span className="text-center font-bold" style={{ color: col }}>{rankLabel(i)}</span>
              <button
                className="text-left font-bold truncate hover:text-[#FAD933] transition-colors"
                style={{ color: col }}
                onClick={() => copy(row.username, row.username)}
              >{row.username}</button>
              <button
                className="text-left text-[#7ACFFF] truncate hover:text-white transition-colors text-xs"
                onClick={() => copy(row.wallet, shortWallet(row.wallet))}
              >{shortWallet(row.wallet)}</button>
              <span className="text-center" style={{ color: col }}>{row.wins}</span>
              <span className="text-center" style={{ color: col }}>{row.losses}</span>
              <span className="text-center" style={{ color: col }}>{row.goals_scored}</span>
            </div>
          )
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#140A0A] border-2 border-[#FAD933] rounded-2xl px-5 py-2 text-sm font-bold">
          {toast}
        </div>
      )}

      <div className="h-1.5 bg-[#E8820C]" />
    </div>
  )
}
