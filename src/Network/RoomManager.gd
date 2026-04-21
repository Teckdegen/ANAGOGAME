## RoomManager — owns the full lifecycle of the current room.
##
## Deletion triggers:
##   1. Game ends normally          → delete immediately
##   2. Opponent disconnects        → delete immediately
##   3. Host alone in lobby > 10s   → delete (abandoned)
##   4. App closes / node exits     → delete (best-effort)
##   5. Stale rooms on fetch        → server-side SQL filter (schema.sql)
extends Node

const ABANDON_TIMEOUT := 10.0   # seconds before an empty room self-destructs

var current_room_id = null       # set when we create or join a room
var _abandon_timer  : float = 0.0
var _counting_down  : bool  = false

# ─── Public API ────────────────────────────────────────────────────────────

func set_room(room_id) -> void:
	current_room_id = room_id
	_abandon_timer  = 0.0
	_counting_down  = false

func clear_room() -> void:
	current_room_id = null
	_abandon_timer  = 0.0
	_counting_down  = false

## Call when the game ends or a player disconnects — deletes immediately.
func delete_current_room() -> void:
	if current_room_id == null:
		return
	SupabaseClient.delete_room(current_room_id)
	# Also wipe all signals for this room
	SupabaseClient.delete_signals_for_room(current_room_id)
	clear_room()

## Start the 10-second abandon countdown (host waiting alone in lobby).
func start_abandon_countdown() -> void:
	if current_room_id == null:
		return
	_counting_down = true
	_abandon_timer = 0.0

## Stop the countdown (opponent joined — no longer abandoned).
func stop_abandon_countdown() -> void:
	_counting_down = false
	_abandon_timer = 0.0

# ─── Countdown tick ────────────────────────────────────────────────────────

func _process(delta: float) -> void:
	if not _counting_down or current_room_id == null:
		return
	_abandon_timer += delta
	if _abandon_timer >= ABANDON_TIMEOUT:
		_counting_down = false
		delete_current_room()

# ─── Cleanup on exit ───────────────────────────────────────────────────────

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_QUIT_REQUEST or what == NOTIFICATION_EXIT_TREE:
		if current_room_id != null:
			# Best-effort synchronous-ish delete before the app closes
			SupabaseClient.delete_room(current_room_id)
			SupabaseClient.delete_signals_for_room(current_room_id)
