extends Node

signal game_inited
signal game_started
signal game_ended
signal game_paused
signal game_unpaused

var duration      := 0
var elapsed       := 0
var online_mode   := false
var is_host       := false

# How often (seconds) to broadcast physics state when hosting
const SYNC_INTERVAL := 0.05
var _sync_timer     := 0.0

onready var GUI        : Gui  = $Gui
onready var ball              = $Ball
onready var slime_left        = $SlimeLeft
onready var slime_right       = $SlimeRight

func _ready() -> void:
	get_tree().paused = true
	emit_signal("game_inited")

	# Wire up network signals if Network autoload exists
	if has_node("/root/Network"):
		Network.connect("ball_state_received",  self, "_on_net_ball_state")
		Network.connect("slime_state_received", self, "_on_net_slime_state")
		Network.connect("remote_goal_scored",   self, "_on_net_goal")
		Network.connect("score_updated",        self, "_on_net_scores")
		Network.connect("connection_closed",    self, "_on_net_disconnected")

func _input(event: InputEvent) -> void:
	if Input.is_action_pressed("ui_cancel") and Globals.gameInProgress:
		toggle_pause()

func toggle_pause() -> void:
	if Globals.isPaused and get_tree().paused:
		get_tree().paused = false
		emit_signal("game_unpaused")
		Globals.isPaused = false
	elif not Globals.isPaused and not get_tree().paused:
		get_tree().paused = true
		emit_signal("game_paused")
		Globals.isPaused = true

# ─── Start / End ───────────────────────────────────────────────────────────

func new_game(d: int) -> void:
	get_tree().paused = false
	duration = d
	elapsed  = 0
	Globals.left_score  = 0
	Globals.right_score = 0
	Globals.gameInProgress = true
	$GameTimer.start()
	emit_signal("game_started")

func start_online_game(host: bool) -> void:
	online_mode = true
	is_host     = host
	GUI.set_online_mode(host)
	# In online mode the host picks duration; use 2 min default
	new_game(1200)

func end_game() -> void:
	$GameTimer.stop()
	get_tree().paused = true
	Globals.gameInProgress = false

	# Delete the room — game is over, no one needs it anymore
	if online_mode:
		RoomManager.delete_current_room()

	# Submit match result — wallet-based, no auth needed
	if online_mode and Globals.player_id != "":
		var my_score    := Globals.left_score  if is_host else Globals.right_score
		var their_score := Globals.right_score if is_host else Globals.left_score
		SupabaseClient.submit_match(my_score > their_score, my_score, their_score)

	emit_signal("game_ended")

func set_smiles() -> void:
	if Globals.left_score >= Globals.right_score + 3:
		slime_left.show_smile()
	elif Globals.right_score >= Globals.left_score + 3:
		slime_right.show_smile()
	else:
		slime_left.hide_smile()
		slime_right.hide_smile()

# ─── Physics sync (online) ─────────────────────────────────────────────────

func _process(delta: float) -> void:
	if not online_mode or get_tree().paused:
		return
	_sync_timer += delta
	if _sync_timer >= SYNC_INTERVAL:
		_sync_timer = 0.0
		if is_host:
			# Host owns ball + SlimeLeft; broadcast both
			Network.send_ball_state(
				ball.global_position,
				ball.linear_velocity,
				ball.angular_velocity
			)
		# Each player sends their own slime
		var my_slime = slime_left if is_host else slime_right
		Network.send_slime_state(my_slime.global_position, my_slime.velocity)

# ─── Network receive callbacks ─────────────────────────────────────────────

func _on_net_ball_state(pos: Vector2, vel: Vector2, ang_vel: float) -> void:
	if is_host: return   # host is authoritative, ignore echoes
	ball.global_position = pos
	ball.linear_velocity  = vel
	ball.angular_velocity = ang_vel

func _on_net_slime_state(peer_id: int, pos: Vector2, _vel: Vector2) -> void:
	# The remote player's slime
	var remote_slime = slime_right if is_host else slime_left
	if peer_id != Network.my_peer_id:
		remote_slime.global_position = pos

func _on_net_goal(side: String) -> void:
	if side == "left":
		Globals.right_score += 1
	else:
		Globals.left_score += 1
	set_smiles()

func _on_net_scores(left: int, right: int) -> void:
	Globals.left_score  = left
	Globals.right_score = right

func _on_net_disconnected() -> void:
	RoomManager.delete_current_room()
	end_game()

# ─── GUI signals ───────────────────────────────────────────────────────────

func _on_Gui_start_game(d: int) -> void:
	new_game(d)

func _on_GameTimer_timeout() -> void:
	elapsed += 1
	GUI.update_timer(duration - elapsed)
	if (duration - elapsed) <= 0:
		end_game()

# ─── Goal signals ──────────────────────────────────────────────────────────

func _on_GoalLeft_scored() -> void:
	Globals.right_score += 1
	if online_mode and is_host:
		Network.send_goal("left")
		Network.send_scores(Globals.left_score, Globals.right_score)

func _on_GoalRight_scored() -> void:
	Globals.left_score += 1
	if online_mode and is_host:
		Network.send_goal("right")
		Network.send_scores(Globals.left_score, Globals.right_score)

func _on_GoalLeft_goal_hanged() -> void:
	Globals.right_score += 1
	if online_mode and is_host:
		Network.send_scores(Globals.left_score, Globals.right_score)

func _on_GoalRight_goal_hanged() -> void:
	Globals.left_score += 1
	if online_mode and is_host:
		Network.send_scores(Globals.left_score, Globals.right_score)

func _on_Gui_message_completed() -> void:
	set_smiles()
