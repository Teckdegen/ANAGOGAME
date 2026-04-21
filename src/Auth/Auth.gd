## Onboarding — username + wallet only, no password.
## Saves to local ConfigFile. Auto-fills if returning user.
extends Control

signal auth_done

onready var username_input : LineEdit = $Card/VBox/UsernameInput
onready var wallet_input   : LineEdit = $Card/VBox/WalletInput
onready var error_label    : Label    = $Card/VBox/ErrorLabel
onready var enter_btn      : Button   = $Card/VBox/EnterBtn
onready var welcome_label  : Label    = $Card/VBox/WelcomeLabel

func _ready() -> void:
	# Try to load saved identity
	if Globals.load_player():
		username_input.text = Globals.player_username
		wallet_input.text   = Globals.player_wallet
		welcome_label.text  = "Welcome back, %s!" % Globals.player_username
		welcome_label.show()
	else:
		welcome_label.hide()

func _on_EnterBtn_pressed() -> void:
	SoundManager.play_ui_confirm()
	error_label.text = ""
	var uname  := username_input.text.strip_edges()
	var wallet := wallet_input.text.strip_edges()

	if uname.empty():
		error_label.text = "Pick a username!"
		return
	if uname.length() < 2:
		error_label.text = "Username too short (min 2 chars)"
		return
	if wallet.empty():
		error_label.text = "Enter your wallet address!"
		return

	Globals.player_username = uname
	Globals.player_wallet   = wallet
	Globals.ensure_player_id()
	Globals.save_player()

	# Sync to Supabase (fire and forget)
	SupabaseClient.upsert_profile()

	emit_signal("auth_done")
