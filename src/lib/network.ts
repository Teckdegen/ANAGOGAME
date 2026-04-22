// WebRTC peer-to-peer with Google STUN + Open Relay TURN

import { pushSignal, fetchSignals } from './supabase'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302'] },
  { urls: ['stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun2.l.google.com:19302'] },
  { urls: ['turn:openrelay.metered.ca:80'],   username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: ['turn:openrelay.metered.ca:443'],  username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: ['turns:openrelay.metered.ca:443'], username: 'openrelayproject', credential: 'openrelayproject' },
]

export type NetEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'failed'; reason: string }
  | { type: 'ball_state';  pos: [number,number]; vel: [number,number]; angVel: number }
  | { type: 'slime_state'; isHost: boolean; pos: [number,number] }
  | { type: 'goal';        side: 'left' | 'right' }
  | { type: 'scores';      left: number; right: number }

export class GameNetwork {
  private pc:       RTCPeerConnection | null = null
  private dc:       RTCDataChannel   | null = null   // reliable
  private dcFast:   RTCDataChannel   | null = null   // unreliable
  private roomId:   number | null = null
  private playerId: string = ''
  private _isHost:  boolean = false
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private pendingCandidates: RTCIceCandidateInit[] = []
  private remoteDescSet = false
  private _connectedFired = false   // guard: only fire 'connected' once

  public onEvent: (e: NetEvent) => void = () => {}

  get isHost() { return this._isHost }

  // ─── Host ───────────────────────────────────────────────────────────────

  async hostRoom(roomId: number, playerId: string) {
    this.roomId   = roomId
    this.playerId = playerId
    this._isHost  = true
    this._setup()
    const offer = await this.pc!.createOffer()
    await this.pc!.setLocalDescription(offer)
    await pushSignal(roomId, playerId, 'offer', offer.sdp!)
    this._startPolling()
  }

  // ─── Guest ──────────────────────────────────────────────────────────────

  async joinRoom(roomId: number, playerId: string) {
    this.roomId   = roomId
    this.playerId = playerId
    this._isHost  = false
    this._setup()
    this._startPolling()
  }

  // ─── Setup ──────────────────────────────────────────────────────────────

  private _setup() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    if (this._isHost) {
      // Host creates both channels
      this.dc     = this.pc.createDataChannel('reliable',   { ordered: true })
      this.dcFast = this.pc.createDataChannel('unreliable', { ordered: false, maxRetransmits: 0 })
      this._wireChannel(this.dc,     'reliable')
      this._wireChannel(this.dcFast, 'unreliable')
    } else {
      // Guest receives channels
      this.pc.ondatachannel = (e) => {
        if (e.channel.label === 'reliable') {
          this.dc = e.channel
          this._wireChannel(this.dc, 'reliable')
        }
        if (e.channel.label === 'unreliable') {
          this.dcFast = e.channel
          this._wireChannel(this.dcFast, 'unreliable')
        }
      }
    }

    this.pc.onicecandidate = async (e) => {
      if (e.candidate && this.roomId) {
        const c = e.candidate
        await pushSignal(this.roomId, this.playerId, 'candidate',
          `${c.sdpMid}\n${c.sdpMLineIndex}\n${c.candidate}`)
      }
    }

    // Only use connection state for disconnect/fail — NOT for 'connected'
    // because data channels may not be open yet when state becomes 'connected'
    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState
      if (s === 'disconnected' || s === 'closed') this.onEvent({ type: 'disconnected' })
      if (s === 'failed') this.onEvent({ type: 'failed', reason: 'WebRTC connection failed' })
    }
  }

  // Wire a data channel — fire 'connected' when the FIRST channel opens
  private _wireChannel(dc: RTCDataChannel, _label: string) {
    dc.onopen = () => {
      if (!this._connectedFired) {
        this._connectedFired = true
        // Stop polling — signaling is done
        if (this.pollInterval) {
          clearInterval(this.pollInterval)
          this.pollInterval = null
        }
        this.onEvent({ type: 'connected' })
      }
    }
    dc.onclose = () => {
      this.onEvent({ type: 'disconnected' })
    }
    dc.onmessage = (e) => this._handleMessage(e.data)
  }

  // ─── Signal polling ─────────────────────────────────────────────────────

  private _startPolling() {
    // Poll immediately, then every 800ms
    this._poll()
    this.pollInterval = setInterval(() => this._poll(), 800)
  }

  private async _poll() {
    if (!this.roomId || this._connectedFired) return
    try {
      const signals = await fetchSignals(this.roomId, this.playerId)
      for (const sig of signals) {
        await this._handleSignal(sig)
      }
    } catch {
      // Network error during signaling — ignore, will retry
    }
  }

  private async _handleSignal(sig: { type: string; payload: string }) {
    if (!this.pc) return

    if (sig.type === 'offer' && !this._isHost) {
      await this.pc.setRemoteDescription({ type: 'offer', sdp: sig.payload })
      this.remoteDescSet = true
      await this._flushCandidates()
      const answer = await this.pc.createAnswer()
      await this.pc.setLocalDescription(answer)
      await pushSignal(this.roomId!, this.playerId, 'answer', answer.sdp!)

    } else if (sig.type === 'answer' && this._isHost) {
      await this.pc.setRemoteDescription({ type: 'answer', sdp: sig.payload })
      this.remoteDescSet = true
      await this._flushCandidates()

    } else if (sig.type === 'candidate') {
      const parts = sig.payload.split('\n')
      if (parts.length >= 3) {
        const cand: RTCIceCandidateInit = {
          sdpMid:        parts[0],
          sdpMLineIndex: parseInt(parts[1]),
          candidate:     parts[2],
        }
        if (this.remoteDescSet) {
          await this.pc.addIceCandidate(cand).catch(() => {})
        } else {
          this.pendingCandidates.push(cand)
        }
      }
    }
  }

  private async _flushCandidates() {
    for (const c of this.pendingCandidates) {
      await this.pc!.addIceCandidate(c).catch(() => {})
    }
    this.pendingCandidates = []
  }

  // ─── Send helpers ────────────────────────────────────────────────────────

  sendBallState(pos: [number,number], vel: [number,number], angVel: number) {
    if (!this._isHost) return
    this._sendFast(JSON.stringify({ t: 'b', pos, vel, av: angVel }))
  }

  sendSlimeState(pos: [number,number]) {
    this._sendFast(JSON.stringify({ t: 's', h: this._isHost, pos }))
  }

  sendGoal(side: 'left' | 'right') {
    this._sendReliable(JSON.stringify({ t: 'g', side }))
  }

  sendScores(left: number, right: number) {
    this._sendReliable(JSON.stringify({ t: 'sc', left, right }))
  }

  private _sendFast(data: string) {
    const ch = this.dcFast ?? this.dc
    if (ch?.readyState === 'open') ch.send(data)
  }

  private _sendReliable(data: string) {
    if (this.dc?.readyState === 'open') this.dc.send(data)
  }

  // ─── Receive ─────────────────────────────────────────────────────────────

  private _handleMessage(raw: string) {
    try {
      const msg = JSON.parse(raw)
      switch (msg.t) {
        case 'b':  this.onEvent({ type: 'ball_state',  pos: msg.pos, vel: msg.vel, angVel: msg.av }); break
        case 's':  this.onEvent({ type: 'slime_state', isHost: msg.h, pos: msg.pos }); break
        case 'g':  this.onEvent({ type: 'goal',        side: msg.side }); break
        case 'sc': this.onEvent({ type: 'scores',      left: msg.left, right: msg.right }); break
      }
    } catch {}
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  disconnect() {
    if (this.pollInterval) clearInterval(this.pollInterval)
    this.pollInterval = null
    this.dc?.close()
    this.dcFast?.close()
    this.pc?.close()
    this.pc = null
    this.dc = null
    this.dcFast = null
    this.roomId = null
    this.remoteDescSet = false
    this.pendingCandidates = []
    this._connectedFired = false
  }
}
