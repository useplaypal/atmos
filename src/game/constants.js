export const WORLD_SIZE = 6000;

// Sizes / counts
export const UFO_R = 22.5;
export const ASTEROID_COUNT = 85;
export const AST_R_MIN = 80;
export const AST_R_MAX = 150;
export const AST_SPEED_MIN = 10;
export const AST_SPEED_MAX = 50;

export const BH_COUNT = 2;
export const BH_R = 180;

// Steering feel
export const SNAP_ANGLE_DEG = 25;
export const SMOOTH_MS = 0.08;
export const INNER_IGNORE_PX = 22;

// Boost
export const BOOST_MULT = 1.55;
export const FREE_CAP_SEC = 3.0;
export const FREE_RECHARGE_SEC = 3.0;
export const FREE_REFILL_RATE = FREE_CAP_SEC / FREE_RECHARGE_SEC;
export const FREE_CAP = FREE_CAP_SEC;
export const TICK_SECONDS = 0.15;

// Banks rotation + visuals
export const BANK_ROTATE_SEC = 45;
export const BANK_PULSE_SEC = 10;
export const BANK_SHRINK_SEC = 5;
export const BANK_SHRINK_MIN_SCALE = 0.2;

// Bots
export const BOT_COUNT = 15;
export const BOT_R = UFO_R;
export const BOT_SPEED = 225;
export const BOT_WANDER_SEC = [0.8, 1.8];
export const BOT_AVOID_AST_R = 125;

// Bumps
export const COLLISION_PAD = 10;
export const PLAYER_BUMP_BASE = 400;
export const PLAYER_BUMP_SPEED_SCALE = 1.5;
export const PLAYER_BUMP_ATTACKER_PCT = 0.5;
export const BOOST_BUMP_MULT = 1.8;
export const BUMP_STUN_DEFENDER = 0.35;
export const BUMP_STUN_ATTACKER = 0.1;
export const KNOCKBACK_DAMP = 4.0;

export const KILL_CREDIT_WINDOW_SEC = 2.5;

// Asteroid pinball
export const BOUNCE_RESTITUTION = 1.25;
export const SEPARATION_BIAS = 1.15;
export const MIN_IMPULSE = 12;
export const SPEED_FLOOR_AFTER = 35;
export const SPEED_CAP_AFTER = 120;
export const HIGH_SPEED_RELAX = 2.2;
export const NEAR_REPEL = 20;

// Asteroid vs Black-hole
export const BH_WALL_RESTITUTION = 1.25;

// Wallet
export const START_STAKE = 1.0;
export const BOOST_MIN_WALLET_FRAC = 0.5;
export const BOOST_MIN_WALLET_CENTS = Math.round(START_STAKE * BOOST_MIN_WALLET_FRAC * 100);

// House / bonus pot
export const CASHOUT_FEE_PCT = 0.05;
export const GHOST_MS = 5000;
export const GHOST_ALPHA = 0.35;
export const ACCIDENT_CREDIT_WINDOW_MS = 2000;
export const ACCIDENT_HOUSE_PCT = 0.75;

// FX
export const SHAKE_HIT = 7;
export const SHAKE_TIME = 0.12;

export const FEED_MAX = 6;
