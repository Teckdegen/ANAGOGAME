## Network.gd — WebRTC + free STUN/TURN (no port forwarding needed)
##
## Signaling flow (via Supabase `signals` table):
##   Host  → creates room → writes SDP offer to Supabase
##   Guest → reads offer  → writes SDP answer + ICE candidates
##   Host  → reads answer + ICE candidates → connection established
##
## STUN:  Google stun.l.google.com:19302  (free, no account)
## TURN:  openrelay.metered.ca            (free tier, no account)
extends Node

# ─── Signals ───────────────────────────────────────────────────────────────
signal game_ready
signal player_connected(peer_id)
signal player_disconnected(peer_id)
signal join_failed(reason)
signal connection_closed
signal ball_state_received(pos, vel, ang_vel)
signal slime_state_received(peer_id, pos, vel)
signal score_updated(left, right)
signal remote_goal_scored(side)

# ─── ICE server config — all free, no account needed ──────────────────────
const ICE_SERVERS := [
	# Google STUN (handles most NAT types)
	{"urls": ["stun:stun.l.google.com:19302"]},
	{"urls": ["stun:stun1.l.google.com:19302"]},
	{"urls": ["stun:stun2.l.google.com:19302"]},
	# Open Relay TURN — free tier, handles symmetric NAT
	{
		"urls":       ["turn:openrelay.metered.ca:80"],
		"username":   "openrelayproject",
		"credential": "openrelayproject"
	},
	{
		"urls":       ["turn:openrelay.metered.ca:443"],
		"username":   "openrelayproject",
		"credential": "openrelayproject"
	},
	{
		"urls":       ["turns:openrelay.metered.ca:443"],
		"username":   "openrelayproject",
		"credential": "openrelayproject"
	}
]

# ─── State ─────────────────────────────────────────────────────────────────
var is_server      := false
var my_peer_id     := 0
var remote_peer_id := 0

var _rtc_mp        : WebRTCMultiplayer    = null
var _rtc_peer      : WebRTCPeerConnection = null
var _room_id                              = null   # Supabase room id
var _signal_timer  : float               = 0.0
const SIGNAL_POLL  := 1.0   # poll Supabase for signals every 1 second

var _pending_candidates : Array = []   # ICE candidates queued before remote desc set
var _remote_desc_set    := false

# ─── Public API ────────────────────────────────────────────────────────────

## Called by Lobby after room is created in Supabase.
## Generates an SDP offer and stores it via SupabaseClient.
func host_room(room_id) -> void:
	_room_id  = room_id
	is_server = true
	my_peer_id = 1
	_setup_webrtc()
	# Create offer — result comes back via _on_session_description_created
	_rtc_peer.create_offer()

## Called by Lobby when guest taps a room card.
## Polls for the host's SDP offer, then answers it.
func join_room(room_id) -> void:
	_room_id  = room_id
	is_server = false
	_setup_webrtc()
	# Start polling for the host's offer
	_signal_timer = SIGNAL_POLL   # trigger immediately

func disconnect_from_room() -> void:
	_cleanup()
	emit_signal("connection_closed")

# ─── WebRTC setup ──────────────────────────────────────────────────────────

func _setup_webrtc() -> void:
	_cleanup()
	_rtc_mp   = WebRTCMultiplayer.new()
	_rtc_peer = WebRTCPeerConnection.new()

	var cfg := {}
	cfg["iceServers"] = ICE_SERVERS
	_rtc_peer.initialize(cfg)

	_rtc_peer.connect("session_description_created", self, "_on_session_description_created")
	_rtc_peer.connect("ice_candidate_created",       self, "_on_ice_candidate_created")

	# Peer id: host = 1, guest = 2
	var local_id  := 1 if is_server else 2
	var remote_id := 2 if is_server else 1
	my_peer_id     = local_id
	remote_peer_id = remote_id

	_rtc_mp.initialize(local_id, false)
	_rtc_mp.add_peer(_rtc_peer, remote_id)
	get_tree().network_peer = _rtc_mp

	get_tree().connect("network_peer_connected",    self, "_on_peer_connected")
	get_tree().connect("network_peer_disconnected", self, "_on_peer_disconnected")
	get_tree().connect("connected_to_server",       self, "_on_connected_to_server")
	get_tree().connect("connection_failed",         self, "_on_connection_failed")

func _process(delta: float) -> void:
	if _rtc_peer == null:
		return
	_rtc_peer.poll()

	if _room_id == null:
		return
	_signal_timer += delta
	if _signal_timer >= SIGNAL_POLL:
		_signal_timer = 0.0
		_poll_signals()

# ─── SDP / ICE callbacks ───────────────────────────────────────────────────

func _on_session_description_created(type: String, sdp: String) -> void:
	_rtc_peer.set_local_description(type, sdp)
	# Push our SDP to Supabase so the other side can read it
	SupabaseClient.push_signal(_room_id, Globals.player_id, type, sdp, "")

func _on_ice_candidate_created(media: String, index: int, name: String) -> void:
	# Push ICE candidate to Supabase
	SupabaseClient.push_signal(_room_id, Globals.player_id, "candidate",
		"%s\n%d\n%s" % [media, index, name], "")

# ─── Signal polling ────────────────────────────────────────────────────────

func _poll_signals() -> void:
	SupabaseClient.fetch_signals(_room_id, Globals.player_id)

## Called by SupabaseClient when signals arrive
func handle_incoming_signals(rows: Array) -> void:
	for row in rows:
		var sig_type : String = row.get("type", "")
		var payload  : String = row.get("payload", "")

		if sig_type == "offer" and not is_server:
			# Guest receives host's offer → set remote desc → create answer
			_rtc_peer.set_remote_description("offer", payload)
			_remote_desc_set = true
			_flush_pending_candidates()
			_rtc_peer.create_answer()

		elif sig_type == "answer" and is_server:
			# Host receives guest's answer
			_rtc_peer.set_remote_description("answer", payload)
			_remote_desc_set = true
			_flush_pending_candidates()

		elif sig_type == "candidate":
			# ICE candidate from the other side
			var parts := payload.split("\n")
			if parts.size() >= 3:
				var media := parts[0]
				var idx   := int(parts[1])
				var cname := parts[2]
				if _remote_desc_set:
					_rtc_peer.add_ice_candidate(media, idx, cname)
				else:
					_pending_candidates.append([media, idx, cname])

func _flush_pending_candidates() -> void:
	for c in _pending_candidates:
		_rtc_peer.add_ice_candidate(c[0], c[1], c[2])
	_pending_candidates.clear()

# ─── Multiplayer callbacks ─────────────────────────────────────────────────

func _on_peer_connected(id: int) -> void:
	emit_signal("player_connected", id)
	emit_signal("game_ready")

func _on_peer_disconnected(id: int) -> void:
	emit_signal("player_disconnected", id)
	emit_signal("connection_closed")

func _on_connected_to_server() -> void:
	emit_signal("game_ready")

func _on_connection_failed() -> void:
	emit_signal("join_failed", "WebRTC connection failed")

# ─── RPC helpers (called by Game.gd) ───────────────────────────────────────

func send_ball_state(pos: Vector2, vel: Vector2, ang_vel: float) -> void:
	if not is_server: return
	rpc_unreliable("_recv_ball_state", pos, vel, ang_vel)

func send_slime_state(pos: Vector2, vel: Vector2) -> void:
	rpc_unreliable("_recv_slime_state", get_tree().get_network_unique_id(), pos, vel)

func send_goal(side: String) -> void:
	rpc("_recv_goal", side)

func send_scores(left: int, right: int) -> void:
	rpc("_recv_scores", left, right)

remote func _recv_ball_state(pos: Vector2, vel: Vector2, ang_vel: float) -> void:
	emit_signal("ball_state_received", pos, vel, ang_vel)

remote func _recv_slime_state(peer_id: int, pos: Vector2, vel: Vector2) -> void:
	emit_signal("slime_state_received", peer_id, pos, vel)

remote func _recv_goal(side: String) -> void:
	emit_signal("remote_goal_scored", side)

remote func _recv_scores(left: int, right: int) -> void:
	emit_signal("score_updated", left, right)

# ─── Cleanup ───────────────────────────────────────────────────────────────

func _cleanup() -> void:
	_remote_desc_set = false
	_pending_candidates.clear()
	_room_id = null

	var sigs := {
		"network_peer_connected":    "_on_peer_connected",
		"network_peer_disconnected": "_on_peer_disconnected",
		"connected_to_server":       "_on_connected_to_server",
		"connection_failed":         "_on_connection_failed"
	}
	for sig in sigs:
		if get_tree().is_connected(sig, self, sigs[sig]):
			get_tree().disconnect(sig, self, sigs[sig])

	if get_tree().network_peer:
		get_tree().network_peer = null
	if _rtc_peer:
		_rtc_peer.close()
		_rtc_peer = null
	if _rtc_mp:
		_rtc_mp   = null

	is_server      = false
	my_peer_id     = 0
	remote_peer_id = 0
