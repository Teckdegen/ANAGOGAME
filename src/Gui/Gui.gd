extends Control
class_name Gui

signal start_game(duration)
signal message_completed

var online_mode := false
var is_host     := false

# Countdown state
var _countdown_ticks := 0

func _ready() -> void:
	$TimerLabel.hide()
	$PausedOverlay.hide()
	$Message.hide()

func set_online_mode(host: bool) -> void:
	online_mode = true
	is_host     = host

# ─── Labels ────────────────────────────────────────────────────────────────

func update_left_label() -> void:
	var team_name = $"../SlimeLeft".team["name"]
	$LeftTeamLabel.text = "%s  %s" % [team_name, Globals.left_score]

func update_right_label() -> void:
	var team_name = $"../SlimeRight".team["name"]
	$RightTeamLabel.text = "%s  %s" % [Globals.right_score, team_name]

func update_left_goal_hanging_progress_bar() -> void:
	var sb       := StyleBoxFlat.new()
	sb.bg_color  = Color($"../SlimeLeft".team["decoration"])
	sb.corner_radius_top_left    = 4
	sb.corner_radius_top_right   = 4
	sb.corner_radius_bottom_right = 4
	sb.corner_radius_bottom_left  = 4
	$LeftGoalHangingProgressBar.add_stylebox_override("fg", sb)

func update_right_goal_hanging_progress_bar() -> void:
	var sb       := StyleBoxFlat.new()
	sb.bg_color  = Color($"../SlimeRight".team["decoration"])
	sb.corner_radius_top_left    = 4
	sb.corner_radius_top_right   = 4
	sb.corner_radius_bottom_right = 4
	sb.corner_radius_bottom_left  = 4
	$RightGoalHangingProgressBar.add_stylebox_override("fg", sb)

func update_timer(ticks: int) -> void:
	var ms := ticks % 10
	var s  := (ticks / 10) % 60
	var m  := ticks / 600
	$TimerLabel.set_text("%02d:%02d:%02d" % [m, s, ms])

	# Countdown beeps for last 5 seconds (ticks are 0.1s each → 50 ticks)
	if ticks <= 50 and ticks > 0 and ticks % 10 == 0:
		SoundManager.play_countdown()

func display_message(message: String) -> void:
	get_tree().paused = true
	$Message.text = message
	$Message.show()
	yield(get_tree().create_timer(2.0), "timeout")
	$Message.text = ""
	$Message.hide()
	if not Globals.isPaused:
		get_tree().paused = false
	emit_signal("message_completed")

# ─── Duration buttons (in-game splash) ────────────────────────────────────

func _on_1Min_button_up()  -> void:
	SoundManager.play_ui_confirm()
	emit_signal("start_game", 600)

func _on_2Min_button_down() -> void:
	SoundManager.play_ui_confirm()
	emit_signal("start_game", 1200)

func _on_4Min_button_up()  -> void:
	SoundManager.play_ui_confirm()
	emit_signal("start_game", 2400)

func _on_8Min_button_up()  -> void:
	SoundManager.play_ui_confirm()
	emit_signal("start_game", 4800)

# ─── Team change ───────────────────────────────────────────────────────────

func _on_SlimeLeft_change_team() -> void:
	SoundManager.play_ui_click()
	update_left_goal_hanging_progress_bar()
	update_left_label()

func _on_SlimeRight_change_team() -> void:
	SoundManager.play_ui_click()
	update_right_goal_hanging_progress_bar()
	update_right_label()

# ─── Goal events ───────────────────────────────────────────────────────────

func _on_GoalLeft_scored() -> void:
	SoundManager.play_goal()
	display_message("%s SCORES!" % $"../SlimeRight".team["name"].to_upper())
	update_right_label()

func _on_GoalRight_scored() -> void:
	SoundManager.play_goal()
	display_message("%s SCORES!" % $"../SlimeLeft".team["name"].to_upper())
	update_left_label()

func _on_GoalLeft_goal_hanged() -> void:
	SoundManager.play_goal()
	display_message("%s GOAL HANGED!" % $"../SlimeLeft".team["name"].to_upper())
	update_right_label()

func _on_GoalRight_goal_hanged() -> void:
	SoundManager.play_goal()
	display_message("%s GOAL HANGED!" % $"../SlimeRight".team["name"].to_upper())
	update_right_label()

# ─── Game state ────────────────────────────────────────────────────────────

func _on_Game_game_started() -> void:
	SoundManager.play_whistle()
	$Message.hide()
	$Splash.hide()
	$TimerLabel.show()
	update_left_label()
	update_right_label()

func _on_Game_game_ended() -> void:
	SoundManager.play_whistle()
	$Splash.show()
	$TimerLabel.hide()
	var msg := "FINAL WHISTLE!\n\n%s  %s  —  %s  %s" % [
		$"../SlimeLeft".team["name"],  Globals.left_score,
		Globals.right_score,           $"../SlimeRight".team["name"]
	]
	$Message.text = msg
	$Message.show()

func _on_Game_game_paused() -> void:
	$PausedOverlay.show()

func _on_Game_game_unpaused() -> void:
	$PausedOverlay.hide()

# ─── Progress bars ─────────────────────────────────────────────────────────

func _on_GoalLeft_goal_hanging_value_changed(value) -> void:
	$LeftGoalHangingProgressBar.value = value

func _on_GoalRight_goal_hanging_value_changed(value) -> void:
	$RightGoalHangingProgressBar.value = value
