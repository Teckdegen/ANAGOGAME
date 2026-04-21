extends Node

onready var onboarding  : Control = $Onboarding
onready var lobby       : Control = $Lobby
onready var game        : Node    = $Game
onready var leaderboard : Control = $Leaderboard
onready var dashboard   : Control = $Dashboard

func _ready() -> void:
	_show(onboarding)

func _show(node: Node) -> void:
	for n in [onboarding, lobby, game, leaderboard, dashboard]:
		n.visible = (n == node)

# ─── Onboarding ────────────────────────────────────────────────────────────

func _on_Onboarding_auth_done() -> void:
	_show(lobby)

# ─── Lobby ─────────────────────────────────────────────────────────────────

func _on_Lobby_start_online_game(host: bool, room: Dictionary) -> void:
	_show(game)
	game.start_online_game(host)

func _on_Lobby_open_leaderboard() -> void:
	_show(leaderboard)
	leaderboard.refresh()

func _on_Lobby_open_dashboard() -> void:
	_show(dashboard)
	dashboard.refresh()

# ─── Game ──────────────────────────────────────────────────────────────────

func _on_Game_game_ended() -> void:
	_show(lobby)

# ─── Back buttons ──────────────────────────────────────────────────────────

func _on_Leaderboard_back_pressed() -> void:
	_show(lobby)

func _on_Dashboard_back_pressed() -> void:
	_show(lobby)
