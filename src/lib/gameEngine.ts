// Game physics engine — Matter.js port of the Godot game
// Canvas size: 1024 × 576 (landscape)

import Matter from 'matter-js'
import { TEAMS, Team } from './store'
import { sound } from './sound'

export const CANVAS_W = 1024
export const CANVAS_H = 576

const GRAVITY    = 2.5
const SPEED      = 8
const JUMP_VEL   = -22
const BALL_R     = 18
export const SLIME_R    = 52
export const FLOOR_Y    = 530
export const WALL_L     = 20
export const WALL_R     = CANVAS_W - 20
export const GOAL_W     = 80
export const GOAL_H     = 120
const GOAL_L_X   = WALL_L + GOAL_W / 2
const GOAL_R_X   = WALL_R - GOAL_W / 2

export interface SlimeState {
  x: number; y: number
  vx: number; vy: number
  onGround: boolean
  team: Team
  smiling: boolean
  eyeAngle: number   // radians, points toward ball
}

export interface BallState {
  x: number; y: number
  vx: number; vy: number
  angle: number
}

export type GoalCallback = (side: 'left' | 'right') => void

export class GameEngine {
  private engine: Matter.Engine
  private runner: Matter.Runner | null = null

  // Bodies
  private ballBody!:   Matter.Body
  private leftBody!:   Matter.Body
  private rightBody!:  Matter.Body
  private floor!:      Matter.Body
  private wallLeft!:   Matter.Body
  private wallRight!:  Matter.Body
  private goalPostLL!: Matter.Body
  private goalPostLR!: Matter.Body
  private goalPostRL!: Matter.Body
  private goalPostRR!: Matter.Body

  // State
  public  left:  SlimeState
  public  right: SlimeState
  public  ball:  BallState

  // Input keys — each side has its own
  private leftKeys  = { left: false, right: false, up: false }
  private rightKeys = { left: false, right: false, up: false }

  private leftOnGround  = true
  private rightOnGround = true

  // AI state
  private aiEnabled = false
  private aiJumpCooldown = 0

  // Goal-camping timers (seconds × 60fps ticks)
  private leftGoalTicks  = 0
  private rightGoalTicks = 0
  // Warning flash state (exposed for renderer)
  public leftCampWarning  = false
  public rightCampWarning = false

  public onGoal: GoalCallback = () => {}

  constructor(leftTeamIdx = 0, rightTeamIdx = 1) {
    this.engine = Matter.Engine.create({ gravity: { y: GRAVITY } })

    this.left  = { x: 256, y: FLOOR_Y - SLIME_R, vx: 0, vy: 0, onGround: true, team: TEAMS[leftTeamIdx],  smiling: false, eyeAngle: 0 }
    this.right = { x: 768, y: FLOOR_Y - SLIME_R, vx: 0, vy: 0, onGround: true, team: TEAMS[rightTeamIdx], smiling: false, eyeAngle: 0 }
    this.ball  = { x: CANVAS_W / 2, y: 200, vx: 0, vy: 0, angle: 0 }

    this._buildWorld()
    this._setupCollisions()
  }

  enableAI() {
    this.aiEnabled = true
  }

  private _buildWorld() {
    const { Bodies, World } = Matter

    // Floor — extra thick to prevent ball tunneling
    this.floor = Bodies.rectangle(CANVAS_W / 2, FLOOR_Y + 200, CANVAS_W, 400, { isStatic: true, label: 'floor' })

    // Walls — extra thick to prevent ball tunneling
    this.wallLeft  = Bodies.rectangle(WALL_L - 100, CANVAS_H / 2, 200, CANVAS_H * 2, { isStatic: true, label: 'wall' })
    this.wallRight = Bodies.rectangle(WALL_R + 100, CANVAS_H / 2, 200, CANVAS_H * 2, { isStatic: true, label: 'wall' })

    // Goal posts (thin static rectangles)
    const gp = (x: number, y: number) => Bodies.rectangle(x, y, 10, 10, { isStatic: true, label: 'goalpost', restitution: 0.3 })
    this.goalPostLL = gp(WALL_L,            FLOOR_Y - GOAL_H)
    this.goalPostLR = gp(WALL_L + GOAL_W,   FLOOR_Y - GOAL_H)
    this.goalPostRL = gp(WALL_R - GOAL_W,   FLOOR_Y - GOAL_H)
    this.goalPostRR = gp(WALL_R,            FLOOR_Y - GOAL_H)

    // Ball
    this.ballBody = Bodies.circle(CANVAS_W / 2, 200, BALL_R, {
      restitution: 0.6, friction: 0.01, frictionAir: 0.005, label: 'ball', density: 0.002,
    })

    // Slimes (semicircle approximated as circle)
    this.leftBody = Bodies.circle(256, FLOOR_Y - SLIME_R, SLIME_R, {
      restitution: 0.1, friction: 0.5, frictionAir: 0.05, label: 'slime_left', isStatic: false,
      collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 },
    })
    this.rightBody = Bodies.circle(768, FLOOR_Y - SLIME_R, SLIME_R, {
      restitution: 0.1, friction: 0.5, frictionAir: 0.05, label: 'slime_right', isStatic: false,
      collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 },
    })

    // Ball collision category
    Matter.Body.set(this.ballBody, 'collisionFilter', { category: 0x0002, mask: 0x0001 | 0x0004 })
    // Floor/walls category
    Matter.Body.set(this.floor,     'collisionFilter', { category: 0x0004, mask: 0x0001 | 0x0002 })
    Matter.Body.set(this.wallLeft,  'collisionFilter', { category: 0x0004, mask: 0x0001 | 0x0002 })
    Matter.Body.set(this.wallRight, 'collisionFilter', { category: 0x0004, mask: 0x0001 | 0x0002 })

    World.add(this.engine.world, [
      this.floor, this.wallLeft, this.wallRight,
      this.goalPostLL, this.goalPostLR, this.goalPostRL, this.goalPostRR,
      this.ballBody, this.leftBody, this.rightBody,
    ])
  }

  private _setupCollisions() {
    Matter.Events.on(this.engine, 'collisionStart', (e) => {
      for (const pair of e.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label]

        // Ground detection
        if (labels.includes('floor')) {
          if (labels.includes('slime_left'))  this.leftOnGround  = true
          if (labels.includes('slime_right')) this.rightOnGround = true
        }

        // Ball hit sound
        if (labels.includes('ball')) {
          const speed = Matter.Vector.magnitude(this.ballBody.velocity)
          if (speed > 2) {
            if (labels.includes('slime_left') || labels.includes('slime_right')) sound.kick()
            else sound.bounce()
          }
        }
      }
    })
  }

  // ─── Input ───────────────────────────────────────────────────────────────

  setLeftKeys(keys: Partial<typeof this.leftKeys>)  { Object.assign(this.leftKeys,  keys) }
  setRightKeys(keys: Partial<typeof this.rightKeys>) { Object.assign(this.rightKeys, keys) }

  // ─── AI logic (controls right slime) ─────────────────────────────────────

  private _tickAI() {
    if (!this.aiEnabled) return

    const bx = this.ball.x
    const by = this.ball.y
    const bvx = this.ball.vx
    const rx = this.right.x
    const ry = this.right.y

    // Predict where ball will be in ~0.4s
    const predictX = bx + bvx * 12

    // Target: get under the ball if it's on our side, else defend goal
    const targetX = bx > CANVAS_W / 2 - 50
      ? Math.min(predictX, WALL_R - SLIME_R)
      : WALL_R - 120  // defend near goal

    const dx = targetX - rx
    const keys = { left: false, right: false, up: false }

    if (Math.abs(dx) > 15) {
      keys.left  = dx < 0
      keys.right = dx > 0
    }

    // Jump: ball is above and close horizontally
    this.aiJumpCooldown = Math.max(0, this.aiJumpCooldown - 1)
    const ballClose = Math.abs(bx - rx) < SLIME_R * 2.5
    const ballAbove = by < ry - 20
    if (ballClose && ballAbove && this.rightOnGround && this.aiJumpCooldown === 0) {
      keys.up = true
      this.aiJumpCooldown = 30
    }

    this.rightKeys = keys
  }

  // ─── Step (called every animation frame) ─────────────────────────────────

  step(dt: number) {
    if (this.aiEnabled) this._tickAI()

    this._applyInput(this.leftBody,  this.leftKeys,  this.leftOnGround,  'left')
    this._applyInput(this.rightBody, this.rightKeys, this.rightOnGround, 'right')

    // Prevent slimes from rotating
    Matter.Body.setAngle(this.leftBody,  0)
    Matter.Body.setAngle(this.rightBody, 0)
    Matter.Body.setAngularVelocity(this.leftBody,  0)
    Matter.Body.setAngularVelocity(this.rightBody, 0)

    Matter.Engine.update(this.engine, dt)
    this._clampBall()
    this._checkCamping()

    this._syncState()
    this._checkGoals()
  }

  // ─── Goal-camping enforcement ─────────────────────────────────────────────
  // If a slime stays inside the OPPONENT's goal zone for >5 seconds, boot them
  // back to their own half. Left slime must not camp the LEFT goal (their own
  // net is on the left, so camping = blocking). Actually in Slime Soccer the
  // left player defends the left goal — camping the OPPONENT's goal (right) is
  // the exploit. We penalise any slime that stays inside either goal zone.

  private _checkCamping() {
    const TICKS_LIMIT = 5 * 60  // 5 seconds at ~60fps
    const WARN_TICKS  = 3 * 60  // show warning after 3 seconds

    const lx = this.leftBody.position.x
    const ly = this.leftBody.position.y
    const rx = this.rightBody.position.x
    const ry = this.rightBody.position.y

    // Left slime in left goal zone (camping own goal — blocking)
    const leftInLeftGoal  = lx < WALL_L + GOAL_W + SLIME_R && ly > FLOOR_Y - GOAL_H - SLIME_R
    // Left slime in right goal zone (camping opponent goal)
    const leftInRightGoal = lx > WALL_R - GOAL_W - SLIME_R && ly > FLOOR_Y - GOAL_H - SLIME_R

    // Right slime in right goal zone
    const rightInRightGoal = rx > WALL_R - GOAL_W - SLIME_R && ry > FLOOR_Y - GOAL_H - SLIME_R
    // Right slime in left goal zone
    const rightInLeftGoal  = rx < WALL_L + GOAL_W + SLIME_R && ry > FLOOR_Y - GOAL_H - SLIME_R

    const leftCamping  = leftInLeftGoal  || leftInRightGoal
    const rightCamping = rightInRightGoal || rightInLeftGoal

    if (leftCamping) {
      this.leftGoalTicks++
      this.leftCampWarning = this.leftGoalTicks >= WARN_TICKS
      if (this.leftGoalTicks >= TICKS_LIMIT) {
        // Boot left slime to their own half
        Matter.Body.setPosition(this.leftBody, { x: 256, y: FLOOR_Y - SLIME_R })
        Matter.Body.setVelocity(this.leftBody, { x: 0, y: -8 })
        this.leftGoalTicks = 0
        this.leftCampWarning = false
      }
    } else {
      this.leftGoalTicks = 0
      this.leftCampWarning = false
    }

    if (rightCamping) {
      this.rightGoalTicks++
      this.rightCampWarning = this.rightGoalTicks >= WARN_TICKS
      if (this.rightGoalTicks >= TICKS_LIMIT) {
        // Boot right slime to their own half
        Matter.Body.setPosition(this.rightBody, { x: 768, y: FLOOR_Y - SLIME_R })
        Matter.Body.setVelocity(this.rightBody, { x: 0, y: -8 })
        this.rightGoalTicks = 0
        this.rightCampWarning = false
      }
    } else {
      this.rightGoalTicks = 0
      this.rightCampWarning = false
    }
  }

  private _applyInput(body: Matter.Body, keys: typeof this.leftKeys, onGround: boolean, side: 'left' | 'right') {
    const vx = keys.right ? SPEED : keys.left ? -SPEED : 0
    Matter.Body.setVelocity(body, { x: vx, y: body.velocity.y })
    if (keys.up && onGround) {
      Matter.Body.setVelocity(body, { x: vx, y: JUMP_VEL })
      if (side === 'left')  this.leftOnGround  = false
      if (side === 'right') this.rightOnGround = false
    }
  }

  private _clampBall() {
    const b = this.ballBody
    const r = BALL_R
    let x = b.position.x
    let y = b.position.y
    let vx = b.velocity.x
    let vy = b.velocity.y

    if (y > FLOOR_Y - r) {
      y = FLOOR_Y - r
      vy = Math.min(vy, 0)
    }
    if (x < r) {
      x = r
      vx = Math.max(vx, 0)
    }
    if (x > CANVAS_W - r) {
      x = CANVAS_W - r
      vx = Math.min(vx, 0)
    }
    Matter.Body.setPosition(b, { x, y })
    Matter.Body.setVelocity(b, { x: vx, y: vy })
  }

  private _syncState() {
    const b = this.ballBody
    this.ball = { x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y, angle: b.angle }

    const l = this.leftBody
    this.left.x = l.position.x; this.left.y = l.position.y
    this.left.vx = l.velocity.x; this.left.vy = l.velocity.y
    this.left.onGround = this.leftOnGround
    this.left.eyeAngle = Math.atan2(this.ball.y - this.left.y, this.ball.x - this.left.x)

    const r = this.rightBody
    this.right.x = r.position.x; this.right.y = r.position.y
    this.right.vx = r.velocity.x; this.right.vy = r.velocity.y
    this.right.onGround = this.rightOnGround
    this.right.eyeAngle = Math.atan2(this.ball.y - this.right.y, this.ball.x - this.right.x)

    // Smile logic
    this.left.smiling  = this.left.x  > this.right.x + 3 * SLIME_R
    this.right.smiling = this.right.x < this.left.x  - 3 * SLIME_R
  }

  private _checkGoals() {
    const bx = this.ball.x
    const by = this.ball.y

    // Ball in left goal (right player scores)
    if (bx < WALL_L + GOAL_W && by > FLOOR_Y - GOAL_H) {
      this.onGoal('left')
      this._resetBall()
    }
    // Ball in right goal (left player scores)
    if (bx > WALL_R - GOAL_W && by > FLOOR_Y - GOAL_H) {
      this.onGoal('right')
      this._resetBall()
    }
  }

  private _resetBall() {
    Matter.Body.setPosition(this.ballBody, { x: CANVAS_W / 2, y: 200 })
    Matter.Body.setVelocity(this.ballBody, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(this.ballBody, 0)
  }

  resetSlimes() {
    Matter.Body.setPosition(this.leftBody,  { x: 256, y: FLOOR_Y - SLIME_R })
    Matter.Body.setPosition(this.rightBody, { x: 768, y: FLOOR_Y - SLIME_R })
    Matter.Body.setVelocity(this.leftBody,  { x: 0, y: 0 })
    Matter.Body.setVelocity(this.rightBody, { x: 0, y: 0 })
    this.leftOnGround  = true
    this.rightOnGround = true
  }

  // Apply remote slime position (PvP: opponent's slime)
  // isHost=true means the HOST's slime data is arriving (left slime)
  // isHost=false means the GUEST's slime data is arriving (right slime)
  applyRemoteSlime(isHost: boolean, pos: [number, number]) {
    const body = isHost ? this.leftBody : this.rightBody
    Matter.Body.setPosition(body, { x: pos[0], y: pos[1] })
  }

  applyRemoteBall(pos: [number,number], vel: [number,number], angVel: number) {
    Matter.Body.setPosition(this.ballBody, { x: pos[0], y: pos[1] })
    Matter.Body.setVelocity(this.ballBody, { x: vel[0], y: vel[1] })
    Matter.Body.setAngularVelocity(this.ballBody, angVel)
  }

  destroy() {
    Matter.World.clear(this.engine.world, false)
    Matter.Engine.clear(this.engine)
  }
}
