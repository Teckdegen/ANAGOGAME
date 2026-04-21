extends Control

signal start_online_game(is_host, room)
signal open_leaderboard
signal open_dashboard

onready var rooms_panel   : Control       = $RoomsPanel
onready var waiting_panel : Control       = $WaitingPanel
onready var rooms_list    : VBoxContainer = $RoomsPanel/VBox/Scroll/RoomsList
onready var loading_label : Label         = $RoomsPanel/VBox/Scroll/LoadingLabel
onready var error_label   : Label         = $RoomsPanel/VBox/ErrorLabel
onready var user_label    : Label         = $RoomsPanel/TopBar/UserLabel
onready var wait_title    : Label         = $WaitingPanel/VBox/WaitTitle
onready var wait_status   : Label         = $WaitingPanel/VBox/StatusLabel
onready var create_btn    : Button        = $RoomsPanel/ActionRow/CreateRoomBtn

var _current_room : Dictionary = {}
var _poll_timer   : float      = 0.0
const POLL_INTERVAL := 3.0

func _ready() -> void:
	_show(rooms_panel)
	user_label.text = "%s   %s" % [Globals.player_username, Globals.wallet_short()]

	SupabaseClient.connect("rooms_loaded",    self, "_on_rooms_loaded")
	SupabaseClient.connect("rooms_error",     self, "_on_rooms_error")
	SupabaseClient.connect("room_created",    self, "_on_room_created")
	SupabaseClient.connect("room_joined",     self, "_on_room_joined_record")
	SupabaseClient.connect("room_error",      self, "_on_room_error")
	SupabaseClient.connect("signals_received",self, "_on_signals_received")

	Network.connect("game_ready",        self, "_on_game_ready")
	Network.connect("player_connected",  self, "_on_player_connected")
	Network.connect("join_failed",       self, "_on_net_join_failed")
	Network.connect("connection_closed", self, "_on_connection_closed")

	_refresh_rooms()

func _process(delta: float) -> void:
	if rooms_panel.visible:
		_poll_timer += delta
		if _poll_timer >= POLL_INTERVAL:
			_poll_timer = 0.0
			_refresh_rooms()

# ─── Rooms list ────────────────────────────────────────────────────────────

func _refresh_rooms() -> void:
	error_label.text = ""
	for c in rooms_list.get_children():
		c.queue_free()
	loading_label.text = "Looking for rooms..."
	loading_label.show()
	SupabaseClient.fetch_open_rooms()

func _on_rooms_loaded(rows) -> void:
	loading_label.hide()
	for c in rooms_list.get_children():
		c.queue_free()

	if not rows is Array or rows.size() == 0:
		loading_label.text = "No open rooms — create one!"
		loading_label.show()
		return

	var shown := 0
	for row in rows:
		if row.get("host_id", "") == Globals.player_id:
			continue   # skip your own room
		_add_room_card(row)
		shown += 1

	if shown == 0:
		loading_label.text = "No open rooms — create one!"
		loading_label.show()

func _add_room_card(room: Dictionary) -> void:
	var btn  := Button.new()
	var host := room.get("host_name", "???")
	btn.text = "%s's room" % host
	btn.rect_min_size = Vector2(0, 60)
	btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn.connect("pressed", self, "_on_room_card_pressed", [room])
	rooms_list.add_child(btn)

func _on_room_card_pressed(room: Dictionary) -> void:
	SoundManager.play_ui_click()
	error_label.text = ""
	_current_room    = room
	RoomManager.set_room(room.get("id"))

	# Mark room as full in Supabase
	SupabaseClient.join_room_record(room.get("id"))

	# Show waiting screen immediately
	_show(waiting_panel)
	wait_title.text  = "JOINING..."
	wait_status.text = "Waiting for another player..."

	# Start WebRTC as guest — will poll for host's SDP offer
	Network.join_room(room.get("id"))

func _on_rooms_error(msg: String) -> void:
	loading_label.hide()
	error_label.text = msg

func _on_room_error(msg: String) -> void:
	error_label.text = msg

# ─── Create room ───────────────────────────────────────────────────────────

func _on_CreateRoomBtn_pressed() -> void:
	SoundManager.play_ui_confirm()
	error_label.text    = ""
	create_btn.disabled = true

	_show(waiting_panel)
	wait_title.text  = "ROOM OPEN"
	wait_status.text = "Waiting for another player..."

	# Create Supabase room record first, then start WebRTC host
	var room_name := "%s's room" % Globals.player_username
	SupabaseClient.create_room(room_name)

func _on_room_created(room: Dictionary) -> void:
	_current_room = room
	RoomManager.set_room(room.get("id"))
	# Start 10-second abandon countdown — stops when opponent joins
	RoomManager.start_abandon_countdown()
	# Now start WebRTC as host — will generate SDP offer and push to Supabase
	Network.host_room(room.get("id"))

# ─── Waiting panel ─────────────────────────────────────────────────────────

func _on_room_joined_record(_room: Dictionary) -> void:
	pass   # Supabase confirmed — WebRTC is already connecting

func _on_signals_received(rows: Array) -> void:
	# Forward to Network which handles SDP/ICE processing
	Network.handle_incoming_signals(rows)

func _on_player_connected(_id: int) -> void:
	# Opponent joined — stop the abandon countdown
	RoomManager.stop_abandon_countdown()
	wait_status.text = "Connected!"

func _on_game_ready() -> void:
	# Game is starting — stop countdown, room stays alive during match
	RoomManager.stop_abandon_countdown()
	SoundManager.play_ui_confirm()
	emit_signal("start_online_game", Network.is_server, _current_room)

func _on_net_join_failed(reason: String) -> void:
	create_btn.disabled = false
	_cleanup_room()
	_show(rooms_panel)
	error_label.text = reason
	_refresh_rooms()

func _on_connection_closed() -> void:
	create_btn.disabled = false
	_show(rooms_panel)
	_refresh_rooms()

func _on_CancelBtn_pressed() -> void:
	SoundManager.play_ui_click()
	create_btn.disabled = false
	_cleanup_room()
	Network.disconnect_from_room()
	_show(rooms_panel)
	_refresh_rooms()

func _cleanup_room() -> void:
	if _current_room.has("id"):
		SupabaseClient.delete_room(_current_room.get("id"))
	_current_room = {}

# ─── Nav ───────────────────────────────────────────────────────────────────

func _on_LeaderboardBtn_pressed() -> void:
	SoundManager.play_ui_click()
	emit_signal("open_leaderboard")

func _on_DashboardBtn_pressed() -> void:
	SoundManager.play_ui_click()
	emit_signal("open_dashboard")

func _on_RefreshBtn_pressed() -> void:
	SoundManager.play_ui_click()
	_poll_timer = 0.0
	_refresh_rooms()

# ─── Helpers ──────────────────────────────────────────────────────────────

func _show(panel: Control) -> void:
	rooms_panel.visible   = (panel == rooms_panel)
	waiting_panel.visible = (panel == waiting_panel)
