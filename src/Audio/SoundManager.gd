## SoundManager — procedural audio, no audio files needed.
## All sounds are synthesized via AudioStreamGenerator.
## Add as autoload: SoundManager = res://src/Audio/SoundManager.gd
extends Node

# ─── Volume ────────────────────────────────────────────────────────────────
var master_volume := 0.85   # 0.0 – 1.0

# ─── One-shot player pool ──────────────────────────────────────────────────
# We keep a small pool so overlapping sounds don't cut each other off.
const POOL_SIZE := 8
var _pool       : Array = []
var _pool_index : int   = 0

func _ready() -> void:
	for _i in range(POOL_SIZE):
		var player := AudioStreamPlayer.new()
		player.bus = "Master"
		add_child(player)
		_pool.append(player)

# ─── Public API ────────────────────────────────────────────────────────────

func play_kick()       -> void: _synth(_kick_wave(),       0.55)
func play_bounce()     -> void: _synth(_bounce_wave(),     0.35)
func play_goal()       -> void: _synth(_goal_wave(),       0.9)
func play_whistle()    -> void: _synth(_whistle_wave(),    0.7)
func play_ui_click()   -> void: _synth(_click_wave(),      0.4)
func play_ui_confirm() -> void: _synth(_confirm_wave(),    0.5)
func play_countdown()  -> void: _synth(_countdown_wave(),  0.6)

# ─── Synth engine ──────────────────────────────────────────────────────────

func _synth(samples: PoolRealArray, volume: float) -> void:
	var stream := AudioStreamSample.new()
	stream.format      = AudioStreamSample.FORMAT_16_BITS
	stream.stereo      = false
	stream.mix_rate    = 22050

	# Convert float samples [-1,1] to int16
	var data := PoolByteArray()
	data.resize(samples.size() * 2)
	for i in samples.size():
		var s := int(clamp(samples[i] * master_volume * volume, -1.0, 1.0) * 32767.0)
		data[i * 2]     = s & 0xFF
		data[i * 2 + 1] = (s >> 8) & 0xFF
	stream.data = data

	var player : AudioStreamPlayer = _pool[_pool_index]
	_pool_index = (_pool_index + 1) % POOL_SIZE
	player.stream = stream
	player.play()

# ─── Waveform generators ───────────────────────────────────────────────────

# Ball kick — short thud: low sine burst with fast decay
func _kick_wave() -> PoolRealArray:
	var rate   := 22050
	var dur    := 0.12
	var n      := int(rate * dur)
	var out    := PoolRealArray()
	out.resize(n)
	for i in n:
		var t    := float(i) / rate
		var env  := exp(-t * 40.0)
		var freq := 120.0 + 80.0 * exp(-t * 60.0)   # pitch drops fast
		out[i] = sin(TAU * freq * t) * env
	return out

# Ball bounce off wall/floor — higher pitched thud
func _bounce_wave() -> PoolRealArray:
	var rate := 22050
	var dur  := 0.08
	var n    := int(rate * dur)
	var out  := PoolRealArray()
	out.resize(n)
	for i in n:
		var t   := float(i) / rate
		var env := exp(-t * 60.0)
		out[i] = sin(TAU * 280.0 * t) * env
	return out

# Goal scored — triumphant ascending arpeggio
func _goal_wave() -> PoolRealArray:
	var rate  := 22050
	var dur   := 0.9
	var n     := int(rate * dur)
	var out   := PoolRealArray()
	out.resize(n)
	# Three notes: C5, E5, G5
	var notes := [523.25, 659.25, 783.99]
	for i in n:
		var t     := float(i) / rate
		var note  := notes[min(int(t / 0.28), 2)]
		var env   := exp(-fmod(t, 0.3) * 6.0)
		var wave  := sin(TAU * note * t) * 0.7
		wave     += sin(TAU * note * 2.0 * t) * 0.2   # harmonic
		out[i] = wave * env
	return out

# Referee whistle — high sine with vibrato
func _whistle_wave() -> PoolRealArray:
	var rate := 22050
	var dur  := 0.6
	var n    := int(rate * dur)
	var out  := PoolRealArray()
	out.resize(n)
	for i in n:
		var t   := float(i) / rate
		var env := min(t * 8.0, 1.0) * exp(-max(t - 0.4, 0.0) * 8.0)
		var vib := sin(TAU * 6.0 * t) * 8.0
		out[i] = sin(TAU * (2800.0 + vib) * t) * env * 0.6
	return out

# UI click — short tick
func _click_wave() -> PoolRealArray:
	var rate := 22050
	var dur  := 0.04
	var n    := int(rate * dur)
	var out  := PoolRealArray()
	out.resize(n)
	for i in n:
		var t   := float(i) / rate
		var env := exp(-t * 120.0)
		out[i] = sin(TAU * 800.0 * t) * env
	return out

# UI confirm — two-tone up
func _confirm_wave() -> PoolRealArray:
	var rate := 22050
	var dur  := 0.18
	var n    := int(rate * dur)
	var out  := PoolRealArray()
	out.resize(n)
	for i in n:
		var t    := float(i) / rate
		var freq := 440.0 if t < 0.09 else 660.0
		var env  := exp(-fmod(t, 0.09) * 20.0)
		out[i] = sin(TAU * freq * t) * env
	return out

# Countdown beep — short mid beep
func _countdown_wave() -> PoolRealArray:
	var rate := 22050
	var dur  := 0.15
	var n    := int(rate * dur)
	var out  := PoolRealArray()
	out.resize(n)
	for i in n:
		var t   := float(i) / rate
		var env := exp(-t * 25.0)
		out[i] = sin(TAU * 660.0 * t) * env
	return out
