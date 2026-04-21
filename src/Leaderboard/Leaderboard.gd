extends Control

signal back_pressed

onready var rows_container : VBoxContainer = $VBox/Scroll/RowsContainer
onready var loading_label  : Label         = $VBox/LoadingLabel
onready var error_label    : Label         = $VBox/ErrorLabel
onready var toast          : Label         = $Toast

const GOLD   := Color(0.98, 0.75, 0.10, 1)
const SILVER := Color(0.75, 0.75, 0.78, 1)
const BRONZE := Color(0.80, 0.50, 0.20, 1)
const WHITE  := Color(1, 1, 1, 1)

func _ready() -> void:
	SupabaseClient.connect("leaderboard_loaded", self, "_on_leaderboard_loaded")
	SupabaseClient.connect("leaderboard_error",  self, "_on_leaderboard_error")
	toast.hide()

func refresh() -> void:
	_clear()
	loading_label.text = "Loading..."
	loading_label.show()
	error_label.hide()
	SupabaseClient.fetch_leaderboard()

func _clear() -> void:
	for c in rows_container.get_children():
		c.queue_free()

# ─── Build rows ────────────────────────────────────────────────────────────

func _on_leaderboard_loaded(rows) -> void:
	loading_label.hide()
	_clear()
	if not rows is Array or rows.size() == 0:
		loading_label.text = "No scores yet — be the first!"
		loading_label.show()
		return
	for i in rows.size():
		_add_row(i + 1, rows[i])

func _add_row(rank: int, row: Dictionary) -> void:
	var hbox := HBoxContainer.new()
	hbox.rect_min_size = Vector2(0, 48)
	hbox.add_constant_override("separation", 0)

	var col := WHITE
	if   rank == 1: col = GOLD
	elif rank == 2: col = SILVER
	elif rank == 3: col = BRONZE

	# Alternating row tint
	var bg := ColorRect.new()
	bg.color = Color(1, 1, 1, 0.05) if rank % 2 == 0 else Color(0, 0, 0, 0)
	bg.set_anchors_and_margins_preset(Control.PRESET_WIDE)
	hbox.add_child(bg)

	var rank_str := ["1st", "2nd", "3rd"][rank - 1] if rank <= 3 else str(rank)

	var wallet_raw : String = row.get("wallet", "")
	var wallet_display := _short_wallet(wallet_raw)
	var username : String = row.get("username", "???")

	# Rank
	hbox.add_child(_lbl(rank_str, 52, 1, col))

	# Username — clickable button that copies to clipboard
	var name_btn := _copy_btn(username, col)
	hbox.add_child(name_btn)

	# Wallet — also copyable (copies full wallet)
	var wallet_btn := _copy_btn(wallet_display, Color(0.7, 0.9, 1, 1), wallet_raw)
	hbox.add_child(wallet_btn)

	hbox.add_child(_lbl(str(row.get("wins",         0)), 64, 1, col))
	hbox.add_child(_lbl(str(row.get("losses",        0)), 64, 1, col))
	hbox.add_child(_lbl(str(row.get("goals_scored",  0)), 72, 1, col))

	rows_container.add_child(hbox)

# ─── Widget helpers ────────────────────────────────────────────────────────

func _lbl(text: String, min_w: int, align: int, color: Color) -> Label:
	var l := Label.new()
	l.text  = text
	l.align = align
	l.valign = Label.VALIGN_CENTER
	l.rect_min_size = Vector2(min_w, 48)
	l.add_color_override("font_color", color)
	return l

# Creates a button that looks like a label but copies text on press.
# display_text is what's shown; copy_text is what gets copied (defaults to display_text).
func _copy_btn(display_text: String, color: Color, copy_text: String = "") -> Button:
	if copy_text.empty():
		copy_text = display_text

	var btn := Button.new()
	btn.text = display_text
	btn.flat = true                          # no button chrome — looks like a label
	btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn.rect_min_size = Vector2(0, 48)
	btn.align = Button.ALIGN_LEFT
	btn.add_color_override("font_color",         color)
	btn.add_color_override("font_color_hover",   Color(1, 1, 0.6, 1))
	btn.add_color_override("font_color_pressed", Color(1, 1, 1, 1))
	btn.connect("pressed", self, "_on_copy_pressed", [copy_text, display_text])
	return btn

func _on_copy_pressed(copy_text: String, display_text: String) -> void:
	OS.clipboard = copy_text
	_show_toast("Copied: %s" % display_text)

func _show_toast(msg: String) -> void:
	toast.text = msg
	toast.show()
	yield(get_tree().create_timer(1.8), "timeout")
	toast.hide()

func _short_wallet(w: String) -> String:
	if w.length() <= 12:
		return w
	return w.substr(0, 6) + "..." + w.substr(w.length() - 4, 4)

# ─── Signals ───────────────────────────────────────────────────────────────

func _on_leaderboard_error(msg: String) -> void:
	loading_label.hide()
	error_label.text = msg
	error_label.show()

func _on_BackBtn_pressed() -> void:
	emit_signal("back_pressed")
