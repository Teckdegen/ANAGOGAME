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
const SLIME_R    = 52
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

  private leftKeys  = { left: false, right: false, up: false }
  private rightKeys = { left: false, right: false, up: false }

  private leftOnGround  = true
  private rightOnGround = true

  public onGoal: GoalCallback = () => {}

  constructor(leftTeamIdx = 0, rightTeamIdx = 1) {
    this.engine = Matter.Engine.create({ gravity: { y: GRAVITY } })

    this.left  = { x: 256, y: FLOOR_Y - SLIME_R, vx: 0, vy: 0, onGround: true, team: TEAMS[leftTeamIdx],  smiling: false, eyeAngle: 0 }
    this.right = { x: 768, y: FLOOR_Y - SLIME_R, vx: 0, vy: 0, onGround: true, team: TEAMS[rightTeamIdx], smiling: false, eyeAngle: 0 }
    this.ball  = { x: CANVAS_W / 2, y: 200, vx: 0, vy: 0, angle: 0 }

    this._buildWorld()
    this._setupCollisions()
  }

  private _buildWorld() {
    const { Bodies, World } = Matter

    // Floor
    this.floor = Bodies.rectangle(CANVAS_W / 2, FLOOR_Y + 25, CANVAS_W, 50, { isStatic: true, label: 'floor' })

    // Walls
    this.wallLeft  = Bodies.rectangle(WALL_L - 10, CANVAS_H / 2, 20, CANVAS_H, { isStatic: true, label: 'wall' })
    this.wallRight = Bodies.rectangle(WALL_R + 10, CANVAS_H / 2, 20, CANVAS_H, { isStatic: true, label: 'wall' })

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

  // ─── Step (called every animation frame) ─────────────────────────────────

  step(dt: number) {
    this._applyInput(this.leftBody,  this.leftKeys,  this.leftOnGround,  'left')
    this._applyInput(this.rightBody, this.rightKeys, this.rightOnGround, 'right')

    // Prevent slimes from rotating
    Matter.Body.setAngle(this.leftBody,  0)
    Matter.Body.setAngle(this.rightBody, 0)
    Matter.Body.setAngularVelocity(this.leftBody,  0)
    Matter.Body.setAngularVelocity(this.rightBody, 0)

    Matter.Engine.update(this.engine, dt)

    // Sync state
    this._syncState()
    this._checkGoals()
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

  // Apply remote state (for the opponent's slime)
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
