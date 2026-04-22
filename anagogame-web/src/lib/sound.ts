// Procedural sound synthesis — Web Audio API port of SoundManager.gd

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playSamples(samples: Float32Array, volume = 1.0) {
  const c = getCtx()
  const buf = c.createBuffer(1, samples.length, 22050)
  buf.copyToChannel(samples, 0)
  const src = c.createBufferSource()
  src.buffer = buf
  const gain = c.createGain()
  gain.gain.value = volume * 0.85
  src.connect(gain)
  gain.connect(c.destination)
  src.start()
}

function sineEnv(rate: number, dur: number, freq: (t: number) => number, env: (t: number) => number): Float32Array {
  const n = Math.floor(rate * dur)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / rate
    out[i] = Math.sin(2 * Math.PI * freq(t) * t) * env(t)
  }
  return out
}

export const sound = {
  kick() {
    const s = sineEnv(22050, 0.12,
      (t) => 120 + 80 * Math.exp(-t * 60),
      (t) => Math.exp(-t * 40))
    playSamples(s, 0.55)
  },
  bounce() {
    const s = sineEnv(22050, 0.08, () => 280, (t) => Math.exp(-t * 60))
    playSamples(s, 0.35)
  },
  goal() {
    const rate = 22050
    const dur = 0.9
    const n = Math.floor(rate * dur)
    const notes = [523.25, 659.25, 783.99]
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / rate
      const note = notes[Math.min(Math.floor(t / 0.28), 2)]
      const env = Math.exp(-(t % 0.3) * 6)
      out[i] = (Math.sin(2 * Math.PI * note * t) * 0.7 + Math.sin(2 * Math.PI * note * 2 * t) * 0.2) * env
    }
    playSamples(out, 0.9)
  },
  whistle() {
    const rate = 22050
    const dur = 0.6
    const n = Math.floor(rate * dur)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / rate
      const env = Math.min(t * 8, 1) * Math.exp(-Math.max(t - 0.4, 0) * 8)
      const vib = Math.sin(2 * Math.PI * 6 * t) * 8
      out[i] = Math.sin(2 * Math.PI * (2800 + vib) * t) * env * 0.6
    }
    playSamples(out, 0.7)
  },
  click() {
    const s = sineEnv(22050, 0.04, () => 800, (t) => Math.exp(-t * 120))
    playSamples(s, 0.4)
  },
  confirm() {
    const rate = 22050
    const dur = 0.18
    const n = Math.floor(rate * dur)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / rate
      const freq = t < 0.09 ? 440 : 660
      const env = Math.exp(-(t % 0.09) * 20)
      out[i] = Math.sin(2 * Math.PI * freq * t) * env
    }
    playSamples(out, 0.5)
  },
  countdown() {
    const s = sineEnv(22050, 0.15, () => 660, (t) => Math.exp(-t * 25))
    playSamples(s, 0.6)
  },
}
