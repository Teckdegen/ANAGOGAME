// Canvas renderer — draws slimes, ball, pitch, goals
import { SlimeState, BallState, CANVAS_W, CANVAS_H, FLOOR_Y, WALL_L, WALL_R, GOAL_W, GOAL_H } from './gameEngine'

const SLIME_R = 52
const BALL_R  = 18

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  left: SlimeState,
  right: SlimeState,
  ball: BallState,
  leftWarn = false,
  rightWarn = false,
) {
  // Background — vivid purple matching the UI
  ctx.fillStyle = '#5B4AE8'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Pitch markings
  _drawPitch(ctx)

  // Goals (drawn behind floor so net doesn't overlap grass)
  _drawGoal(ctx, WALL_L, FLOOR_Y - GOAL_H, GOAL_W, GOAL_H, false)
  _drawGoal(ctx, WALL_R - GOAL_W, FLOOR_Y - GOAL_H, GOAL_W, GOAL_H, true)

  // Floor — bright green grass (drawn AFTER goals, BEFORE slimes+ball)
  ctx.fillStyle = '#2E8B2E'
  ctx.fillRect(0, FLOOR_Y, CANVAS_W, CANVAS_H - FLOOR_Y)
  // Floor stripe
  ctx.fillStyle = '#3AAA3A'
  ctx.fillRect(0, FLOOR_Y, CANVAS_W, 12)
  // Floor outline — orange like the UI accent
  ctx.strokeStyle = '#E8820C'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(0, FLOOR_Y)
  ctx.lineTo(CANVAS_W, FLOOR_Y)
  ctx.stroke()
  // Ink border under orange
  ctx.strokeStyle = '#1A0808'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, FLOOR_Y + 4)
  ctx.lineTo(CANVAS_W, FLOOR_Y + 4)
  ctx.stroke()

  // Goal post fronts — redraw on top of grass so posts are always visible
  _drawGoalPosts(ctx, WALL_L, FLOOR_Y - GOAL_H, GOAL_W, GOAL_H, false)
  _drawGoalPosts(ctx, WALL_R - GOAL_W, FLOOR_Y - GOAL_H, GOAL_W, GOAL_H, true)

  // Slimes
  _drawSlime(ctx, left,  false, leftWarn)
  _drawSlime(ctx, right, true,  rightWarn)

  // Ball — always drawn last so it's on top of everything
  _drawBall(ctx, ball)
}

function _drawPitch(ctx: CanvasRenderingContext2D) {
  // Centre line — white dashed
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 2.5
  ctx.setLineDash([10, 8])
  ctx.beginPath()
  ctx.moveTo(CANVAS_W / 2, 0)
  ctx.lineTo(CANVAS_W / 2, FLOOR_Y)
  ctx.stroke()
  ctx.setLineDash([])

  // Centre circle
  ctx.beginPath()
  ctx.arc(CANVAS_W / 2, FLOOR_Y - 90, 70, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Centre dot
  ctx.beginPath()
  ctx.arc(CANVAS_W / 2, FLOOR_Y - 90, 5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fill()
}

function _drawGoal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, flip: boolean) {
  ctx.save()
  if (flip) {
    ctx.translate(x + w, y)
    ctx.scale(-1, 1)
    x = 0; y = 0
  }

  // Net only (posts drawn separately on top of grass)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1
  for (let gx = 0; gx <= w; gx += 12) {
    ctx.beginPath(); ctx.moveTo(x + gx, y); ctx.lineTo(x + gx, y + h); ctx.stroke()
  }
  for (let gy = 0; gy <= h; gy += 12) {
    ctx.beginPath(); ctx.moveTo(x, y + gy); ctx.lineTo(x + w, y + gy); ctx.stroke()
  }

  ctx.restore()
}

function _drawGoalPosts(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, flip: boolean) {
  ctx.save()
  if (flip) {
    ctx.translate(x + w, y)
    ctx.scale(-1, 1)
    x = 0; y = 0
  }

  // Posts — drawn on top of grass so they're always visible
  ctx.strokeStyle = '#FAD933'
  ctx.lineWidth = 5
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h)
  ctx.stroke()

  // Post outline
  ctx.strokeStyle = '#1A0808'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h)
  ctx.stroke()

  ctx.restore()
}

function _drawSlime(ctx: CanvasRenderingContext2D, s: SlimeState, facingLeft: boolean, campWarn = false) {
  const { x, y } = s
  const bodyColor = '#' + s.team.body
  const decoColor = '#' + s.team.decoration

  ctx.save()
  ctx.translate(x, y)
  if (facingLeft) ctx.scale(-1, 1)

  // Shadow
  ctx.beginPath()
  ctx.ellipse(0, SLIME_R - 4, SLIME_R * 0.9, 10, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fill()

  // Camping warning — pulsing red ring
  if (campWarn) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 120)
    ctx.beginPath()
    ctx.arc(0, 0, SLIME_R + 8, Math.PI, 0)
    ctx.lineTo(SLIME_R + 8, SLIME_R - 4)
    ctx.lineTo(-(SLIME_R + 8), SLIME_R - 4)
    ctx.closePath()
    ctx.strokeStyle = `rgba(255,40,40,${0.6 + 0.4 * pulse})`
    ctx.lineWidth = 5
    ctx.stroke()
  }

  // Body (semicircle)
  ctx.beginPath()
  ctx.arc(0, 0, SLIME_R, Math.PI, 0)
  ctx.lineTo(SLIME_R, SLIME_R - 4)
  ctx.lineTo(-SLIME_R, SLIME_R - 4)
  ctx.closePath()
  ctx.fillStyle = bodyColor
  ctx.fill()
  ctx.strokeStyle = '#140A0A'
  ctx.lineWidth = 3
  ctx.stroke()

  // Decoration stripe
  ctx.beginPath()
  ctx.arc(0, 0, SLIME_R * 0.65, Math.PI, 0)
  ctx.strokeStyle = decoColor
  ctx.lineWidth = 6
  ctx.stroke()

  // Eye white
  const ex = 22, ey = -18
  ctx.beginPath()
  ctx.arc(ex, ey, 10, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.strokeStyle = '#140A0A'
  ctx.lineWidth = 2
  ctx.stroke()

  // Pupil (looks toward ball)
  const angle = facingLeft ? Math.PI - s.eyeAngle : s.eyeAngle
  const px = ex + Math.cos(angle) * 4
  const py = ey + Math.sin(angle) * 4
  ctx.beginPath()
  ctx.arc(px, py, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#140A0A'
  ctx.fill()

  // Smile
  if (s.smiling) {
    ctx.beginPath()
    ctx.arc(0, -5, 18, 0.2, Math.PI - 0.2)
    ctx.strokeStyle = '#140A0A'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  ctx.restore()
}

function _drawBall(ctx: CanvasRenderingContext2D, b: BallState) {
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(b.angle)

  // Shadow
  ctx.beginPath()
  ctx.ellipse(2, BALL_R - 2, BALL_R * 0.8, 6, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()

  // Ball body
  ctx.beginPath()
  ctx.arc(0, 0, BALL_R, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.strokeStyle = '#140A0A'
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Pentagon patches
  ctx.fillStyle = '#140A0A'
  const patches = [
    [0, 0], [BALL_R * 0.5, -BALL_R * 0.5],
    [-BALL_R * 0.5, -BALL_R * 0.5], [BALL_R * 0.5, BALL_R * 0.5],
    [-BALL_R * 0.5, BALL_R * 0.5],
  ]
  for (const [px, py] of patches) {
    ctx.beginPath()
    ctx.arc(px, py, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

// ─── HUD ─────────────────────────────────────────────────────────────────

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  leftTeam: string, leftScore: number,
  rightTeam: string, rightScore: number,
  timeLeft: number,
  message?: string,
  leftWarn = false,
  rightWarn = false,
) {
  // Score bar — white pill with ink border
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = '#1A0808'
  ctx.lineWidth = 3
  ctx.beginPath()
  _roundRect(ctx, CANVAS_W / 2 - 130, 6, 260, 42, 12)
  ctx.fill()
  ctx.stroke()

  // Timer — purple text
  const m  = Math.floor(timeLeft / 60)
  const s  = Math.floor(timeLeft % 60)
  ctx.fillStyle = '#5B4AE8'
  ctx.font = 'bold 22px "Fredoka One", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`, CANVAS_W / 2, 35)

  // Left score — ink text on left
  ctx.fillStyle = '#1A0808'
  ctx.font = 'bold 16px "Fredoka One", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`${leftTeam}  ${leftScore}`, 10, 28)

  // Right score
  ctx.textAlign = 'right'
  ctx.fillText(`${rightScore}  ${rightTeam}`, CANVAS_W - 10, 28)

  // Goal message — orange card
  if (message) {
    ctx.fillStyle = '#E8820C'
    ctx.strokeStyle = '#1A0808'
    ctx.lineWidth = 4
    ctx.beginPath()
    _roundRect(ctx, CANVAS_W / 2 - 210, CANVAS_H / 2 - 44, 420, 88, 20)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 30px "Fredoka One", sans-serif'
    ctx.textAlign = 'center'
    ctx.shadowColor = '#1A0808'
    ctx.shadowOffsetY = 3
    ctx.fillText(message, CANVAS_W / 2, CANVAS_H / 2 + 12)
    ctx.shadowOffsetY = 0
  }

  // Camping warnings — shown near each goal
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150)
  if (leftWarn) {
    ctx.fillStyle = `rgba(255,40,40,${0.75 + 0.25 * pulse})`
    ctx.font = 'bold 13px "Fredoka One", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('⚠ MOVE! 5s LIMIT', WALL_L + GOAL_W / 2 + 20, FLOOR_Y - GOAL_H - 10)
  }
  if (rightWarn) {
    ctx.fillStyle = `rgba(255,40,40,${0.75 + 0.25 * pulse})`
    ctx.font = 'bold 13px "Fredoka One", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('⚠ MOVE! 5s LIMIT', WALL_R - GOAL_W / 2 - 20, FLOOR_Y - GOAL_H - 10)
  }
}

function _roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
