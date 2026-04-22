// WebRTC peer-to-peer with Google STUN + Open Relay TURN
// Mirrors Network.gd logic exactly

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
  private dc:       RTCDataChannel   | null = null   // reliable channel
  private dcFast:   RTCDataChannel   | null = null   // unreliable channel
  private roomId:   number | null = null
  private playerId: string = ''
  private _isHost:  boolean = false
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private pendingCandidates: RTCIceCandidateInit[] = []
  private remoteDescSet = false

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

    // Reliable data channel (goals, scores)
    if (this._isHost) {
      this.dc     = this.pc.createDataChannel('reliable',   { ordered: true })
      this.dcFast = this.pc.createDataChannel('unreliable', { ordered: false, maxRetransmits: 0 })
      this._wireDataChannel(this.dc)
      this._wireDataChannel(this.dcFast)
    } else {
      this.pc.ondatachannel = (e) => {
        if (e.channel.label === 'reliable')   { this.dc     = e.channel; this._wireDataChannel(this.dc) }
        if (e.channel.label === 'unreliable') { this.dcFast = e.channel; this._wireDataChannel(this.dcFast) }
      }
    }

    this.pc.onicecandidate = async (e) => {
      if (e.candidate && this.roomId) {
        const c = e.candidate
        await pushSignal(this.roomId, this.playerId, 'candidate',
          `${c.sdpMid}\n${c.sdpMLineIndex}\n${c.candidate}`)
      }
    }

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'connected')    this.onEvent({ type: 'connected' })
      if (this.pc?.connectionState === 'disconnected') this.onEvent({ type: 'disconnected' })
      if (this.pc?.connectionState === 'failed')       this.onEvent({ type: 'failed', reason: 'WebRTC connection failed' })
    }
  }

  private _wireDataChannel(dc: RTCDataChannel) {
    dc.onmessage = (e) => this._handleMessage(e.data)
  }

  // ─── Signal polling ─────────────────────────────────────────────────────

  private _startPolling() {
    this.pollInterval = setInterval(() => this._poll(), 1000)
  }

  private async _poll() {
    if (!this.roomId) return
    const signals = await fetchSignals(this.roomId, this.playerId)
    for (const sig of signals) {
      if (sig.type === 'offer' && !this._isHost) {
        await this.pc!.setRemoteDescription({ type: 'offer', sdp: sig.payload })
        this.remoteDescSet = true
        await this._flushCandidates()
        const answer = await this.pc!.createAnswer()
        await this.pc!.setLocalDescription(answer)
        await pushSignal(this.roomId!, this.playerId, 'answer', answer.sdp!)
      } else if (sig.type === 'answer' && this._isHost) {
        await this.pc!.setRemoteDescription({ type: 'answer', sdp: sig.payload })
        this.remoteDescSet = true
        await this._flushCandidates()
      } else if (sig.type === 'candidate') {
        const parts = sig.payload.split('\n')
        if (parts.length >= 3) {
          const cand: RTCIceCandidateInit = { sdpMid: parts[0], sdpMLineIndex: parseInt(parts[1]), candidate: parts[2] }
          if (this.remoteDescSet) await this.pc!.addIceCandidate(cand)
          else this.pendingCandidates.push(cand)
        }
      }
    }
  }

  private async _flushCandidates() {
    for (const c of this.pendingCandidates) await this.pc!.addIceCandidate(c)
    this.pendingCandidates = []
  }

  // ─── Send helpers ────────────────────────────────────────────────────────

  sendBallState(pos: [number,number], vel: [number,number], angVel: number) {
    if (!this._isHost || !this.dcFast || this.dcFast.readyState !== 'open') return
    this.dcFast.send(JSON.stringify({ t: 'b', pos, vel, av: angVel }))
  }

  sendSlimeState(pos: [number,number]) {
    if (!this.dcFast || this.dcFast.readyState !== 'open') return
    this.dcFast.send(JSON.stringify({ t: 's', h: this._isHost, pos }))
  }

  sendGoal(side: 'left' | 'right') {
    if (!this.dc || this.dc.readyState !== 'open') return
    this.dc.send(JSON.stringify({ t: 'g', side }))
  }

  sendScores(left: number, right: number) {
    if (!this.dc || this.dc.readyState !== 'open') return
    this.dc.send(JSON.stringify({ t: 'sc', left, right }))
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
    this.dc?.close()
    this.dcFast?.close()
    this.pc?.close()
    this.pc = null
    this.dc = null
    this.dcFast = null
    this.roomId = null
    this.remoteDescSet = false
    this.pendingCandidates = []
  }
}
