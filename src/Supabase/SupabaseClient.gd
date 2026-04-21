## SupabaseClient — no-auth wallet-based Supabase wrapper for Godot 3
## All identity is local (username + wallet). Supabase stores rooms + stats.
extends Node

# ─── CONFIG ────────────────────────────────────────────────────────────────
const SUPABASE_URL      := "https://YOUR_PROJECT_ID.supabase.co"
const SUPABASE_ANON_KEY := "YOUR_ANON_KEY"
# ───────────────────────────────────────────────────────────────────────────

signal rooms_loaded(rows)
signal rooms_error(msg)
signal room_created(room)
signal room_joined(room)
signal room_error(msg)
signal signals_received(rows)
signal leaderboard_loaded(rows)
signal leaderboard_error(msg)
signal stats_saved
signal stats_error(msg)
signal profile_synced(profile)

# ─── Rooms ─────────────────────────────────────────────────────────────────

func fetch_open_rooms() -> void:
	# Filter: open rooms created in the last 10 minutes only
	# This catches any rooms where the host crashed without deleting
	_get("/rest/v1/rooms?status=eq.open&select=*&order=created_at.desc&limit=20&created_at=gte." + _ten_minutes_ago(),
		"_on_rooms_loaded")

func _ten_minutes_ago() -> String:
	# Returns an ISO 8601 timestamp 10 minutes in the past
	# Godot 3 doesn't have a built-in datetime formatter so we use OS.get_unix_time()
	var t := OS.get_unix_time() - 600
	var dt := OS.get_datetime_from_unix_time(t)
	return "%04d-%02d-%02dT%02d:%02d:%02dZ" % [
		dt["year"], dt["month"], dt["day"],
		dt["hour"], dt["minute"], dt["second"]
	]

func create_room(room_name: String) -> void:
	var body := JSON.print({
		"name":         room_name,
		"host_id":      Globals.player_id,
		"host_name":    Globals.player_username,
		"status":       "open",
		"player_count": 1
	})
	_post("/rest/v1/rooms", body, "_on_room_created")

func join_room_record(room_id) -> void:
	# Mark room as full
	var body := JSON.print({
		"status":       "full",
		"player_count": 2,
		"guest_id":     Globals.player_id,
		"guest_name":   Globals.player_username
	})
	_patch("/rest/v1/rooms?id=eq.%s" % str(room_id), body, "_on_room_joined_patch")

func delete_room(room_id) -> void:
	_delete("/rest/v1/rooms?id=eq.%s" % str(room_id))

func delete_signals_for_room(room_id) -> void:
	_delete("/rest/v1/signals?room_id=eq.%s" % str(room_id))

# ─── WebRTC Signaling ──────────────────────────────────────────────────────

## Push an SDP offer/answer or ICE candidate to the signals table.
func push_signal(room_id, sender_id: String, sig_type: String, payload: String, _extra: String) -> void:
	var body := JSON.print({
		"room_id":   str(room_id),
		"sender_id": sender_id,
		"type":      sig_type,
		"payload":   payload
	})
	_post("/rest/v1/signals", body, "_on_signal_pushed")

## Fetch signals sent by the OTHER player in this room.
func fetch_signals(room_id, my_player_id: String) -> void:
	_get("/rest/v1/signals?room_id=eq.%s&sender_id=neq.%s&select=*&order=created_at.asc" % [str(room_id), my_player_id],
		"_on_signals_fetched")

# ─── Stats / Profile ───────────────────────────────────────────────────────

func upsert_profile() -> void:
	var body := JSON.print({
		"player_id": Globals.player_id,
		"username":  Globals.player_username,
		"wallet":    Globals.player_wallet
	})
	# Use upsert so returning players update their row instead of erroring
	var req := HTTPRequest.new()
	add_child(req)
	req.connect("request_completed", self, "_on_profile_synced", [req])
	var headers := PoolStringArray([
		"Content-Type: application/json",
		"apikey: " + SUPABASE_ANON_KEY,
		"Prefer: resolution=merge-duplicates,return=representation"
	])
	req.request(SUPABASE_URL + "/rest/v1/players", headers, true, HTTPClient.METHOD_POST, body)

func submit_match(won: bool, goals_for: int, goals_against: int) -> void:
	var body := JSON.print({
		"player_id":      Globals.player_id,
		"username":       Globals.player_username,
		"wallet":         Globals.player_wallet,
		"won":            won,
		"goals_scored":   goals_for,
		"goals_conceded": goals_against
	})
	_post("/rest/v1/match_results", body, "_on_stats_saved")

func fetch_leaderboard() -> void:
	_get("/rest/v1/leaderboard?select=*&order=wins.desc,goals_scored.desc&limit=20",
		"_on_leaderboard_loaded")

# ─── HTTP helpers ──────────────────────────────────────────────────────────

func _headers() -> PoolStringArray:
	return PoolStringArray([
		"Content-Type: application/json",
		"apikey: " + SUPABASE_ANON_KEY,
		"Prefer: return=representation"
	])

func _post(path: String, body: String, callback: String) -> void:
	var req := HTTPRequest.new()
	add_child(req)
	req.connect("request_completed", self, callback, [req])
	req.request(SUPABASE_URL + path, _headers(), true, HTTPClient.METHOD_POST, body)

func _get(path: String, callback: String) -> void:
	var req := HTTPRequest.new()
	add_child(req)
	req.connect("request_completed", self, callback, [req])
	req.request(SUPABASE_URL + path, _headers(), true, HTTPClient.METHOD_GET)

func _patch(path: String, body: String, callback: String) -> void:
	var req := HTTPRequest.new()
	add_child(req)
	req.connect("request_completed", self, callback, [req])
	req.request(SUPABASE_URL + path, _headers(), true, HTTPClient.METHOD_PATCH, body)

func _delete(path: String) -> void:
	var req := HTTPRequest.new()
	add_child(req)
	req.request(SUPABASE_URL + path, _headers(), true, HTTPClient.METHOD_DELETE)

func _free_req(req: HTTPRequest) -> void:
	req.queue_free()

# ─── Callbacks ─────────────────────────────────────────────────────────────

func _on_rooms_loaded(_r, code, _h, body, req) -> void:
	_free_req(req)
	var j := JSON.parse(body.get_string_from_utf8())
	if j.error != OK or code >= 400:
		emit_signal("rooms_error", "Could not load rooms")
		return
	emit_signal("rooms_loaded", j.result)

func _on_room_created(_r, code, _h, body, req) -> void:
	_free_req(req)
	var j := JSON.parse(body.get_string_from_utf8())
	if j.error != OK or code >= 400:
		emit_signal("room_error", "Could not create room")
		return
	var rows = j.result
	if rows is Array and rows.size() > 0:
		emit_signal("room_created", rows[0])
	else:
		emit_signal("room_error", "No room data returned")

func _on_room_joined_patch(_r, code, _h, body, req) -> void:
	_free_req(req)
	var j := JSON.parse(body.get_string_from_utf8())
	if j.error != OK or code >= 400:
		emit_signal("room_error", "Could not join room")
		return
	var rows = j.result
	if rows is Array and rows.size() > 0:
		emit_signal("room_joined", rows[0])
	else:
		emit_signal("room_error", "Room not found")

func _on_profile_synced(_r, _code, _h, _body, req) -> void:
	_free_req(req)

func _on_stats_saved(_r, code, _h, _body, req) -> void:
	_free_req(req)
	if code < 400:
		emit_signal("stats_saved")
	else:
		emit_signal("stats_error", "Could not save stats")

func _on_leaderboard_loaded(_r, code, _h, body, req) -> void:
	_free_req(req)
	var j := JSON.parse(body.get_string_from_utf8())
	if j.error != OK or code >= 400:
		emit_signal("leaderboard_error", "Could not load leaderboard")
		return
	emit_signal("leaderboard_loaded", j.result)

func _on_signal_pushed(_r, _code, _h, _body, req) -> void:
	_free_req(req)

func _on_signals_fetched(_r, code, _h, body, req) -> void:
	_free_req(req)
	var j := JSON.parse(body.get_string_from_utf8())
	if j.error != OK or code >= 400:
		return
	if j.result is Array and j.result.size() > 0:
		emit_signal("signals_received", j.result)
		# Delete processed signals so we don't re-process them
		# (fire and forget — no callback needed)
		for row in j.result:
			var rid = row.get("id", "")
			if rid != "":
				_delete("/rest/v1/signals?id=eq.%s" % str(rid))
