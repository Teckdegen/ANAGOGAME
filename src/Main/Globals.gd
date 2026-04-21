# Global state + local player identity (no auth — wallet + username only)
extends Node

# ─── Game state ────────────────────────────────────────────────────────────
var gameInProgress := false
var isPaused       := false
var left_score     := 0
var right_score    := 0

# ─── Player identity (persisted locally) ───────────────────────────────────
var player_username := ""
var player_wallet   := ""
var player_id       := ""   # random UUID generated once, stored locally

const SAVE_PATH := "user://player.cfg"

func save_player() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("player", "username", player_username)
	cfg.set_value("player", "wallet",   player_wallet)
	cfg.set_value("player", "id",       player_id)
	cfg.save(SAVE_PATH)

func load_player() -> bool:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		return false
	player_username = cfg.get_value("player", "username", "")
	player_wallet   = cfg.get_value("player", "wallet",   "")
	player_id       = cfg.get_value("player", "id",       "")
	return player_username != "" and player_wallet != ""

func ensure_player_id() -> void:
	if player_id == "":
		player_id = _gen_uuid()
		save_player()

func wallet_short() -> String:
	if player_wallet.length() <= 12:
		return player_wallet
	return player_wallet.substr(0, 6) + "..." + player_wallet.substr(player_wallet.length() - 4, 4)

func _gen_uuid() -> String:
	randomize()
	var s := ""
	for _i in range(32):
		s += "%x" % (randi() % 16)
	return "%s-%s-%s-%s-%s" % [s.substr(0,8), s.substr(8,4), s.substr(12,4), s.substr(16,4), s.substr(20,12)]

func reset() -> void:
	gameInProgress = false
	isPaused       = false
	left_score     = 0
	right_score    = 0

const teams = [
	{'name': 'Argentina',   'body': '0AFDFF', 'decoration': 'FFFFFF'},
	{'name': 'Spain',       'body': 'CF0000', 'decoration': '05008B'},
	{'name': 'Italy',       'body': '817CFF', 'decoration': 'FFFFFF'},
	{'name': 'Japan',       'body': '06008B', 'decoration': 'FFFFFF'},
	{'name': 'Senegal',     'body': 'FFFFFF', 'decoration': 'FF7900'},
	{'name': 'South Korea', 'body': 'FF0000', 'decoration': 'FFFFFF'},
	{'name': 'Australia',   'body': '00CC44', 'decoration': 'FFFFFF'},
	{'name': 'China',       'body': 'FFFFFF', 'decoration': 'FF0000'},
	{'name': 'Cameroon',    'body': '008700', 'decoration': 'FF0000'},
	{'name': 'Germany',     'body': 'FFFFFF', 'decoration': '111111'},
	{'name': 'France',      'body': '1200FF', 'decoration': 'FFFFFF'},
	{'name': 'Brazil',      'body': 'FDFF00', 'decoration': '008700'},
	{'name': 'Portugal',    'body': '7E2405', 'decoration': '008700'},
	{'name': 'England',     'body': 'E6E7E7', 'decoration': 'FF0000'},
	{'name': 'Mexico',      'body': '006400', 'decoration': 'FFFFFF'},
	{'name': 'Uruguay',     'body': '00B9B6', 'decoration': 'FFFFFF'},
]
