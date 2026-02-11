import {
  AST_R_MAX,
  AST_R_MIN,
  AST_SPEED_MAX,
  AST_SPEED_MIN,
  BH_R,
  BOT_R,
  BOT_SPEED,
  FREE_CAP,
  START_STAKE,
  WORLD_SIZE,
} from './constants.js';
import { rnd, TAU, toCents } from './utils.js';

export function makeWallet() {
  return {
    start: toCents(START_STAKE),
    wallet: toCents(START_STAKE),
    boosts: 0,
    kills: 0,
    rake: 0,
    jackpot: 0,
  };
}

export function makePlayer(x, y, r, speed) {
  return {
    type: 'player',
    id: 'you',
    x,
    y,
    r,
    speed,
    heading: 0,
    targetAngle: 0,
    boostHeld: false,
    freeBudget: FREE_CAP,
    paidAccum: 0,
    velX: 0,
    velY: 0,
    stun: 0,
    lastHitBy: null,
    lastHitAt: -1,
    alive: true,
    wallet: makeWallet(),
  };
}

export function makeBot(i, wanderSecRange) {
  const x = rnd(0, WORLD_SIZE);
  const y = rnd(0, WORLD_SIZE);
  return {
    type: 'bot',
    id: `bot${i}`,
    x,
    y,
    r: BOT_R,
    speed: BOT_SPEED,
    heading: rnd(0, TAU),
    targetAngle: rnd(0, TAU),
    nextWanderT: rnd(wanderSecRange[0], wanderSecRange[1]),
    boostHeld: false,
    freeBudget: FREE_CAP,
    paidAccum: 0,
    velX: 0,
    velY: 0,
    stun: 0,
    lastHitBy: null,
    lastHitAt: -1,
    alive: true,
    wallet: makeWallet(),
  };
}

export function makeAsteroid() {
  return {
    x: rnd(0, WORLD_SIZE),
    y: rnd(0, WORLD_SIZE),
    r: rnd(AST_R_MIN, AST_R_MAX),
    vx: rnd(AST_SPEED_MIN, AST_SPEED_MAX) * (Math.random() < 0.5 ? -1 : 1),
    vy: rnd(AST_SPEED_MIN, AST_SPEED_MAX) * (Math.random() < 0.5 ? -1 : 1),
  };
}

export function makeHole() {
  return { x: rnd(0, WORLD_SIZE), y: rnd(0, WORLD_SIZE), r: BH_R };
}
