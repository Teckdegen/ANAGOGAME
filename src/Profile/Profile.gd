## Dashboard — shows username, wallet, stats. No auth needed.
extends Control

signal back_pressed

onready var username_lbl : Label    = $Card/VBox/UsernameRow/UsernameLabel
onready var wallet_lbl   : Label    = $Card/VBox/WalletRow/WalletLabel
onready var wins_lbl     : Label    = $Card/VBox/StatsGrid/WinsVal
onready var losses_lbl   : Label    = $Card/VBox/StatsGrid/LossesVal
onready var goals_lbl    : Label    = $Card/VBox/StatsGrid/GoalsVal
onready var edit_name    : LineEdit = $Card/VBox/EditRow/EditNameInput
onready var edit_wallet  : LineEdit = $Card/VBox/EditRow/EditWalletInput
onready var edit_row     : HBoxContainer = $Card/VBox/EditRow
onready var save_btn     : Button   = $Card/VBox/EditRow/SaveBtn
onready var status_lbl   : Label    = $Card/VBox/StatusLabel

var _editing := false

func _ready() -> void:
	SupabaseClient.connect("leaderboard_loaded", self, "_on_stats_loaded")

func refresh() -> void:
	username_lbl.text = Globals.player_username
	wallet_lbl.text   = Globals.wallet_short()
	edit_row.hide()
	status_lbl.text   = ""
	# Fetch personal stats from leaderboard view
	SupabaseClient.fetch_leaderboard()

func _on_stats_loaded(rows) -> void:
	if not rows is Array:
		return
	for row in rows:
		if row.get("player_id", "") == Globals.player_id:
			wins_lbl.text   = str(row.get("wins",         0))
			losses_lbl.text = str(row.get("losses",       0))
			goals_lbl.text  = str(row.get("goals_scored", 0))
			return

func _on_EditBtn_pressed() -> void:
	edit_name.text   = Globals.player_username
	edit_wallet.text = Globals.player_wallet
	edit_row.show()

func _on_SaveBtn_pressed() -> void:
	var uname  := edit_name.text.strip_edges()
	var wallet := edit_wallet.text.strip_edges()
	if uname.empty() or wallet.empty():
		status_lbl.text = "Fields can't be empty"
		return
	Globals.player_username = uname
	Globals.player_wallet   = wallet
	Globals.save_player()
	SupabaseClient.upsert_profile()
	username_lbl.text = uname
	wallet_lbl.text   = Globals.wallet_short()
	edit_row.hide()
	status_lbl.text   = "Saved ✓"

func _on_BackBtn_pressed() -> void:
	emit_signal("back_pressed")
