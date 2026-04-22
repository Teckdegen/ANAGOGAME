'use client'

import { useEffect, useState } from 'react'
import { fetchLeaderboard, LeaderboardRow } from '@/lib/supabase'
import { sound } from '@/lib/sound'

function rankColor(rank: number) {
  if (rank === 1) return '#E8820C'   // gold-orange
  if (rank === 2) return '#7B5CE8'   // purple
  if (rank === 3) return '#5C3317'   // brown
  return '#1A0808'
}

function rankBg(rank: number) {
  if (rank === 1) return 'bg-[#FAD933] border-[#E8820C]'
  if (rank === 2) return 'bg-[#E8E0FF] border-[#7B5CE8]'
  if (rank === 3) return 'bg-[#F5E6D8] border-[#5C3317]'
  return 'bg-white border-[#1A0808]/20'
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
    try { setRows(await fetchLeaderboard()) }
    catch { setError('Could not load leaderboard') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setToast(`Copied: ${label}`)
      setTimeout(() => setToast(''), 1800)
    })
  }

  const rankLabel = (i: number) => ['1ST', '2ND', '3RD'][i] ?? String(i + 1)

  return (
    <div className="screen flex flex-col overflow-hidden">
      <div className="accent-bar top-0" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-2">
        <button className="btn btn-purple btn-sm" onClick={() => { sound.click(); onBack() }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <div className="w-8 h-8 rounded-xl border-[2px] border-[#1A0808] bg-[#FAD933] flex items-center justify-center"
             style={{ boxShadow: '0 2px 0 #1A0808' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#1A0808]">
            <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V18H8v2h8v-2h-3v-2.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white flex-1" style={{ textShadow: '0 2px 0 #1A0808' }}>
          LEADERBOARD
        </h1>
        <button className="btn btn-sm" onClick={() => { sound.click(); load() }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
            <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      </div>

      {/* Column headers */}
      <div className="mx-4 rounded-xl border-[2px] border-[#1A0808] bg-[#1A0808] px-3 py-2 mb-2">
        <div className="grid grid-cols-[44px_1fr_1fr_44px_44px_52px] gap-1 text-[#FAD933] text-xs font-bold">
          <span className="text-center">#</span>
          <span>PLAYER</span>
          <span className="text-[#7ACFFF]">WALLET</span>
          <span className="text-center">W</span>
          <span className="text-center">L</span>
          <span className="text-center">GOALS</span>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-1.5">
        {loading && <p className="text-center text-white/70 font-bold mt-8">Loading...</p>}
        {error   && <p className="text-center text-red-300 font-bold mt-8">{error}</p>}
        {!loading && rows.length === 0 && (
          <p className="text-center text-white/70 font-bold mt-8">No scores yet — be the first!</p>
        )}
        {rows.map((row, i) => {
          const rank = i + 1
          const col  = rankColor(rank)
          const bg   = rankBg(rank)
          return (
            <div
              key={row.player_id}
              className={`grid grid-cols-[44px_1fr_1fr_44px_44px_52px] gap-1 items-center px-3 py-2 rounded-xl border-[2px] ${bg}`}
              style={{ boxShadow: rank <= 3 ? '0 3px 0 #1A0808' : 'none' }}
            >
              <span className="text-center text-xs font-bold" style={{ color: col }}>
                {rankLabel(i)}
              </span>
              <button
                className="text-left font-bold truncate text-sm hover:underline"
                style={{ color: col }}
                onClick={() => copy(row.username, row.username)}
                title="Click to copy"
              >
                {row.username}
              </button>
              <button
                className="text-left truncate text-xs font-bold text-[#7B5CE8] hover:underline"
                onClick={() => copy(row.wallet, shortWallet(row.wallet))}
                title="Click to copy full wallet"
              >
                {shortWallet(row.wallet)}
              </button>
              <span className="text-center text-sm font-bold" style={{ color: col }}>{row.wins}</span>
              <span className="text-center text-sm font-bold" style={{ color: col }}>{row.losses}</span>
              <span className="text-center text-sm font-bold" style={{ color: col }}>{row.goals_scored}</span>
            </div>
          )
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-2xl border-[3px] border-[#1A0808] bg-[#FAD933] px-5 py-2 text-sm font-bold text-[#1A0808]"
             style={{ boxShadow: '0 4px 0 #1A0808' }}>
          {toast}
        </div>
      )}

      <div className="accent-bar bottom-0" />
    </div>
  )
}
