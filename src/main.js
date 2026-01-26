// Toroid world, centered camera. Mouse-angle steering (smooth, no rocking).
// Boost with free budget. Crash on asteroid. Cash out in black hole.
// Per-life wallet + kill feed + receipts. "Last hit wins" kill credit window.
import { drawGhostCountdown } from './ui/overlays.js';

// ---------- Canvas ----------
const canvas = document.getElementById('game');
const ctx     = canvas.getContext('2d');
const hud     = document.getElementById('hud');
// IMPORTANT: don't grab #feed here; we create/style it later:
let feedEl = null;

let W = window.innerWidth, H = window.innerHeight;
canvas.width = W; canvas.height = H;
window.addEventListener('resize', () => {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
});


// ---------- Tunables (your latest) ----------
const WORLD_SIZE      = 6000;

// Sizes / counts
const UFO_R           = 22.5;    // player size
const ASTEROID_COUNT  = 85;
const AST_R_MIN       = 80, AST_R_MAX = 150;
const AST_SPEED_MIN   = 10, AST_SPEED_MAX = 50;

const BH_COUNT        = 2;
const BH_R            = 180;

// Steering feel
const SNAP_ANGLE_DEG  = 25;
const SMOOTH_MS       = 0.08;
const INNER_IGNORE_PX = 22;

// Boost
const BOOST_MULT         = 1.55;
// Free boost energy (seconds)
const FREE_CAP_SEC       = 3.0;            // total free-seconds available
const FREE_RECHARGE_SEC  = 3.0;            // time (sec) to fully recharge when NOT boosting
const FREE_REFILL_RATE   = FREE_CAP_SEC / FREE_RECHARGE_SEC; // sec per sec
// Backwards-compat alias so existing code using FREE_CAP keeps working
const FREE_CAP           = FREE_CAP_SEC;
// Billing cadence (how often $0.01 is charged during paid boost)
const TICK_SECONDS       = 0.15;           // 50% slower burn vs 0.10s


// Banks rotation + visuals
const BANK_ROTATE_SEC  = 45;
const BANK_PULSE_SEC   = 10;       // cash-out allowed entire pulse window
const BANK_SHRINK_SEC  = 5;        // last 5s of cycle shrink

// At the very end of the cycle, bank radius shrinks to this fraction
// of its original size (0.20 = 80% shrink, 20% of original radius).
const BANK_SHRINK_MIN_SCALE = 0.20;

// Bots (testing)
const BOT_COUNT        = 15;
const BOT_R            = UFO_R;
const BOT_SPEED        = 225;
const BOT_WANDER_SEC   = [0.8, 1.8];
const BOT_AVOID_AST_R  = 125;

// Bumps (springy)
const COLLISION_PAD            = 10;
const PLAYER_BUMP_BASE         = 400;
const PLAYER_BUMP_SPEED_SCALE  = 1.5;
const PLAYER_BUMP_ATTACKER_PCT = 0.50;
const BOOST_BUMP_MULT          = 1.8;
const BUMP_STUN_DEFENDER       = 0.35;
const BUMP_STUN_ATTACKER       = 0.10;
const KNOCKBACK_DAMP           = 4.0;

// Kill credit window
const KILL_CREDIT_WINDOW_SEC   = 2.5;

// Asteroid pinball
const BOUNCE_RESTITUTION = 1.25;
const SEPARATION_BIAS    = 1.15;
const MIN_IMPULSE        = 12;
const SPEED_FLOOR_AFTER  = 35;
const SPEED_CAP_AFTER    = 120;
const HIGH_SPEED_RELAX   = 2.2;
const NEAR_REPEL         = 20;

// Asteroid vs Black-hole (holes are rigid walls)
const BH_WALL_RESTITUTION = 1.25;

// Wallet (per life)
const START_STAKE        = 1.00; // dollars
// Boost spend floor (prevents burning the whole buy-in)
const BOOST_MIN_WALLET_FRAC  = 0.50;   // cannot burn below 50% of original stake
const BOOST_MIN_WALLET_CENTS = toCents(START_STAKE * BOOST_MIN_WALLET_FRAC);
// ---------- House / bonus pot ----------
const CASHOUT_FEE_PCT = 0.05;   // 5% to start (tunable)
const GHOST_MS    = 5000;
const GHOST_ALPHA = 0.35;
const ACCIDENT_CREDIT_WINDOW_MS = 2000; // 2s window for "you caused it"
const ACCIDENT_HOUSE_PCT = 0.75;       // 75% house, 25% bonus

let houseCents = 0;
let bonusPotCents = 0;

// (optional) last ~200 economy events for debugging
const econLog = [];
function logEcon(kind, data={}) {
  econLog.push({ t: Math.round(nowMs()), kind, ...data, houseCents, bonusPotCents });
  if (econLog.length > 200) econLog.shift();
}

// FX
const SHAKE_HIT   = 7;
const SHAKE_TIME  = 0.12;

// ---------- Helpers ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rnd   = (a, b) => a + Math.random() * (b - a);
const nowMs = () => performance.now();
function wrap01(v) {
  v = v % WORLD_SIZE;
  return v < 0 ? v + WORLD_SIZE : v;
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function wrapPos(o) {
  o.x = wrap01(o.x);
  o.y = wrap01(o.y);
}

function toCents(d) { return Math.round(d * 100); }
const fmt$      = c => `$${(c/100).toFixed(2)}`;
const angleLerp = (a, b, t) => {
  let d = (b - a + Math.PI) % (TAU) - Math.PI;
  return a + d * t;};

// Color helpers for boost bar
function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Map free-boost ratio (0..1) -> color (RGB array)
function boostColorForRatio(ratio) {
  ratio = clamp(ratio, 0, 1);

  const FULL  = [120, 190, 255]; // bright blue
  const MID   = [255, 210, 120]; // warm yellow
  const EMPTY = [255, 120, 120]; // red-ish

  if (ratio >= 0.7) {
    // 70%+: mostly full blue
    return FULL;
  } else if (ratio >= 0.3) {
    // 30–70%: fade from yellow -> blue
    const t = (ratio - 0.3) / 0.4; // 0 at 0.3, 1 at 0.7
    return lerpColor(MID, FULL, t);
  } else {
    // 0–30%: fade from red -> yellow (feels "danger zone")
    const t = ratio / 0.3; // 0 at 0, 1 at 0.3
    return lerpColor(EMPTY, MID, t);
  }
}

// ---------- Camera ----------
const camera = { x: 0, y: 0, shake: 0, shakeT: 0 };

function worldToScreen(wx, wy) {
  const { dx, dy } = deltaWrap(camera.x, camera.y, wx, wy); // camera -> world
  return { x: dx + W / 2, y: dy + H / 2 };
}

function screenToWorld(sx, sy) {
  return {
    x: mod(camera.x + (sx - W/2), WORLD_SIZE),
    y: mod(camera.y + (sy - H/2), WORLD_SIZE),
  };
}

// ---------- Entities ----------
let asteroids = [];
let holes     = [];   // banks / black holes
let bots      = [];
let entities  = [];   // convenience: [player, ...bots]

let bankTimer = 0;  // counts up to BANK_ROTATE_SEC, last BANK_PULSE_SEC is "pulse"
let receipt   = null;
let state     = 'play'; // 'play' | 'event'

// ---- Kill/Event feed + Boost bar (UI) ----
const FEED_MAX = 6;
let feed = [];
// feedEl declared near the canvas setup; reuse it here without redeclaring

// Boost bar DOM references
let boostBarEl   = null; // outer bar container
let boostFillEl  = null; // inner fill bar
let boostLabelEl = null; // text label above the bar

// Boost bar visual state
let lastBoostRatio   = 1;   // last 0..1 free-boost ratio (for detecting refill)
let boostFlashUntil  = 0;   // timestamp (ms) until which we keep the "full" flash


function ensureUI() {
  ensureFeedPanel();
  ensureBoostBar();
}


/* ---------- Feed panel ---------- */
function ensureFeedPanel() {
  if (feedEl) return;

  // reuse if it exists, otherwise create it
  feedEl = document.getElementById('feed');
  if (!feedEl) {
    feedEl = document.createElement('div');
    feedEl.id = 'feed';
    document.body.appendChild(feedEl);
  }
  Object.assign(feedEl.style, {
    position: 'fixed',
    right: '12px',
    top: '12px',
    width: '320px',
    font: '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    color: '#9db6c9',
    lineHeight: '1.35',
    textAlign: 'right',
    pointerEvents: 'none',
    zIndex: 10000,
  });
}

function pushFeed(html) {
  feed.unshift({ html, t: performance.now() });
  while (feed.length > FEED_MAX) feed.pop();
  renderFeed();
}

function renderFeed() {
  if (!feedEl) return;
  const lines = feed.map(f => `<div class="row">${f.html}</div>`).join('');
  feedEl.innerHTML = lines;
}

/* ---------- Boost bar ---------- */
/* ---------- Boost bar ---------- */
function ensureBoostBar() {
  if (boostBarEl) return;

  // Put the boost bar directly on <body>, independent of #hud text updates
  const parent = document.body;

  // Outer bar container (#boostbar)
  boostBarEl = document.getElementById('boostbar');
  if (!boostBarEl) {
    boostBarEl = document.createElement('div');
    boostBarEl.id = 'boostbar';
    parent.appendChild(boostBarEl);
  }
  Object.assign(boostBarEl.style, {
    position: 'fixed',          // fixed to viewport, not relative to #hud
    right: '12px',
    bottom: '12px',
    width: '240px',
    height: '12px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    boxShadow: '0 0 1px rgba(160,160,255,0.35) inset, 6px 18px rgba(0,0,0,0.35)',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 10000,              // on top of canvas
  });

  // Inner fill (#boostfill)
  boostFillEl = document.getElementById('boostfill');
  if (!boostFillEl) {
    boostFillEl = document.createElement('div');
    boostFillEl.id = 'boostfill';
    boostBarEl.appendChild(boostFillEl);
  }
  Object.assign(boostFillEl.style, {
  position: 'absolute',
  left: '0',
  top: '0',
  height: '100%',
  width: '100%', // initially full
  backgroundColor: 'rgba(120,190,255,0.95)', // will be updated dynamically
  boxShadow: '0 0 16px rgba(80,160,255,0.35)',
  transition: 'width 80ms linear, opacity 120ms linear, background-color 150ms linear, box-shadow 150ms linear',
});

  // Label (#boostlbl)
  boostLabelEl = document.getElementById('boostlbl');
  if (!boostLabelEl) {
    boostLabelEl = document.createElement('div');
    boostLabelEl.id = 'boostlbl';
    boostBarEl.appendChild(boostLabelEl);
  }
  Object.assign(boostLabelEl.style, {
    position: 'absolute',
    left: '12px',
    top: '-22px',
    font: '12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    color: '#9db6c9',
    textShadow: '0 1px 0 rgba(0,0,0,0.45)',
    pointerEvents: 'none',
  });

  boostLabelEl.textContent = 'Free boost: 100%';
}

//* ---------- Boost bar updater ---------- *//
function updateBoostBar(p) {
  if (!boostBarEl || !boostFillEl || !boostLabelEl) return;

  const now   = nowMs();
  const ratio = clamp(p.freeBudget / FREE_CAP_SEC, 0, 1);  // 0..1
  const pct   = Math.round(ratio * 100);

  // Detect "full recharge" flash:
  // if we were not full before, and we just reached (almost) full now
  if (lastBoostRatio < 0.999 && ratio >= 0.999) {
    boostFlashUntil = now + 300; // flash for 300ms
  }

  // Base glow strength
  let glow = 0.35;
  if (now < boostFlashUntil) {
    glow = 0.9; // stronger glow during flash
  }

  // Pick color based on ratio (fades from blue -> yellow -> red near empty)
  const [r, g, b] = boostColorForRatio(ratio);

  // Apply visuals
  boostFillEl.style.width        = pct + '%';
  boostFillEl.style.opacity      = ratio > 0 ? '1' : '0.25'; // faint when empty
  boostFillEl.style.backgroundColor = `rgba(${r},${g},${b},0.98)`;
  boostFillEl.style.boxShadow    = `0 0 18px rgba(${r},${g},${b},${glow})`;

  boostLabelEl.textContent = 'Free boost: ' + pct + '%';

  // Remember for next frame
  lastBoostRatio = ratio;
}


// ---------- Player / Wallet ----------
function makeWallet() {
  return {
    start: toCents(START_STAKE),
    wallet: toCents(START_STAKE),
    boosts: 0,     // cents spent on boosts
    kills: 0,      // cents won from kills
    rake: 0,       // (placeholder if you want per-kill rake later)
    jackpot: 0     // (placeholder, accidental deaths contribution etc.)
  };
}

function makePlayer(x, y, r, speed) {
  return {
    type: 'player',
    id: 'you',
    x, y, r, speed,
    heading: 0,
    targetAngle: 0,
    boostHeld: false,
    freeBudget: FREE_CAP,
    paidAccum: 0,
    velX: 0, velY: 0,           // knockback velocity
    stun: 0,
    lastHitBy: null,
    lastHitAt: -1,
    alive: true,
    wallet: makeWallet()
  };
}

function makeBot(i) {
  const x = rnd(0, WORLD_SIZE), y = rnd(0, WORLD_SIZE);
  return {
    type: 'bot',
    id: 'bot'+i,
    x, y, r: BOT_R, speed: BOT_SPEED,
    heading: rnd(0, TAU),
    targetAngle: rnd(0, TAU),
    nextWanderT: rnd(BOT_WANDER_SEC[0], BOT_WANDER_SEC[1]),
    boostHeld: false,
    freeBudget: FREE_CAP,
    paidAccum: 0,
    velX: 0, velY: 0,
    stun: 0,
    lastHitBy: null,
    lastHitAt: -1,
    alive: true,
    wallet: makeWallet()
  };
}

function makeAsteroid() {
  return {
    x: rnd(0, WORLD_SIZE),
    y: rnd(0, WORLD_SIZE),
    r: rnd(AST_R_MIN, AST_R_MAX),
    vx: rnd(AST_SPEED_MIN, AST_SPEED_MAX) * (Math.random() < .5 ? -1 : 1),
    vy: rnd(AST_SPEED_MIN, AST_SPEED_MAX) * (Math.random() < .5 ? -1 : 1)
  };
}

function makeHole() {
  return { x: rnd(0, WORLD_SIZE), y: rnd(0, WORLD_SIZE), r: BH_R };
}

// ---------- Input / steering ----------
const pointer = { x: W/2, y: H/2 };
window.addEventListener('mousemove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener('touchmove', e => {
  const t = e.touches[0]; if (!t) return;
  pointer.x = t.clientX; pointer.y = t.clientY;
}, { passive:true });

function startBoost(e) {
  if (player.isGhost) return;
  player.boostHeld = true;
}
function stopBoost(e)  { player.boostHeld = false; }
window.addEventListener('mousedown', startBoost);
window.addEventListener('mouseup', stopBoost);
window.addEventListener('touchstart', startBoost, { passive:true });
window.addEventListener('touchend', stopBoost);
window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
  e.preventDefault();
  if (!player.isGhost) player.boostHeld = true;
}
 if (state !== 'play' && (e.code === 'Enter' || e.code === 'Space')) respawn();
});
window.addEventListener('keyup', e => { if (e.code === 'Space') { e.preventDefault(); player.boostHeld = false; } });
canvas.addEventListener('click', () => { if (state !== 'play') respawn(); });

// ---------- Bump logic ----------
function angleTo(ax, ay, bx, by) {
  const { dx, dy } = deltaWrap(ax, ay, bx, by);
  return Math.atan2(dy, dx);
}

function distWrap(ax, ay, bx, by) {
  const { dx, dy } = deltaWrap(ax, ay, bx, by);
  return Math.hypot(dx, dy);
}

// Smallest wrapped delta from a -> b on a torus (WORLD_SIZE)
function wrapDelta(d) {
  // use mod() to avoid JS negative % issues
  return mod(d + WORLD_SIZE / 2, WORLD_SIZE) - WORLD_SIZE / 2;
}

function deltaWrap(ax, ay, bx, by) {
  // IMPORTANT: this is b - a (vector from A to B)
  return {
    dx: wrapDelta(bx - ax),
    dy: wrapDelta(by - ay),
  };
}

function applyBump(att, def) {
  const now = nowMs();

  // SAFE velocity extraction:
  // Prefer vx/vy if present; otherwise derive from heading/speed;
  // if missing, treat as 0.
  const avx = (att.vx !== undefined) ? att.vx : Math.cos(att.heading ?? 0) * (att.speed ?? 0);
  const avy = (att.vy !== undefined) ? att.vy : Math.sin(att.heading ?? 0) * (att.speed ?? 0);
  const dvx = (def.vx !== undefined) ? def.vx : Math.cos(def.heading ?? 0) * (def.speed ?? 0);
  const dvy = (def.vy !== undefined) ? def.vy : Math.sin(def.heading ?? 0) * (def.speed ?? 0);

  const rvx = avx - dvx;
  const rvy = avy - dvy;

  let rel = Math.hypot(rvx, rvy);
  rel = Math.max(rel, 1);

  let force = PLAYER_BUMP_BASE + PLAYER_BUMP_SPEED_SCALE * rel;
  if (att.boostHeld) force *= BOOST_BUMP_MULT;

  // ...keep the rest of your existing applyBump logic the same...

  const ang = angleTo(att.x, att.y, def.x, def.y);
  const fx = Math.cos(ang) * force, fy = Math.sin(ang) * force;

  // split impulse with some bias to defender
  const fAtt = PLAYER_BUMP_ATTACKER_PCT, fDef = 1 - fAtt;
  att.velX -= fx * fAtt; att.velY -= fy * fAtt;
  def.velX += fx * fDef; def.velY += fy * fDef;

  att.stun = Math.max(att.stun, BUMP_STUN_ATTACKER * 1000);
  def.stun = Math.max(def.stun, BUMP_STUN_DEFENDER * 1000);

  // credit window on defender
  def.lastHitBy = att.id;
  def.lastHitAt = now;

  // tiny camera shake if you are involved
  if (att.id === 'you' || def.id === 'you') {
    camera.shake = SHAKE_HIT; camera.shakeT = SHAKE_TIME * 1000;
  }
}

// ---------- Wallet / feed helpers ----------
function spendBoostCent(p) {
  if (p.wallet.wallet <= BOOST_MIN_WALLET_CENTS) return; // hard floor

  p.wallet.boosts += 1;
  p.wallet.wallet = Math.max(BOOST_MIN_WALLET_CENTS, p.wallet.wallet - 1);

  if (p.id === 'you') {
    const atFloor = (p.wallet.wallet === BOOST_MIN_WALLET_CENTS);
    pushFeed(`<b>Boost</b> <span class="neg">- $0.01</span>${atFloor ? ' <i>(floor)</i>' : ''}`);
  }
}
function awardKill(killer, victim) {
  const amount = victim.wallet.wallet;
  if (amount <= 0) return;
  killer.wallet.kills += amount;
  killer.wallet.wallet += amount;
  victim.wallet.wallet = 0;
  if (killer.id === 'you') {
    pushFeed(`Eliminated <b>${victim.id}</b> <span class="amt">+ ${fmt$(amount)}</span>`);
  } else if (victim.id === 'you') {
    pushFeed(`You were eliminated by <b>${killer.id}</b> <span class="neg">- ${fmt$(amount)}</span>`);
  }
}

// ---------- Banks / cash-out ----------

// next rotation time (absolute ms timestamp)
let holesMoveAt = BANK_ROTATE_SEC * 1000;

// spawn banks and schedule next rotation
function rotateHoles() {
  holes = Array.from({ length: BH_COUNT }, () => makeHole());
  holesMoveAt = nowMs() + BANK_ROTATE_SEC * 1000;
}

// are we in the pulse window? (last BANK_PULSE_SEC seconds)
function inPulse() {
  const tLeft = holesMoveAt - nowMs();
  return tLeft <= BANK_PULSE_SEC * 1000 && tLeft >= 0;
}

// fraction (0..1) through the pulse window
function pulseFrac() {
  const tLeft = holesMoveAt - nowMs();
  return clamp(1 - tLeft / (BANK_PULSE_SEC * 1000), 0, 1);
}

// 0..1: how far into the shrink window we are.
// 0 = no shrink (more than BANK_SHRINK_SEC left),
// 1 = fully shrunken (0s left).
function bankShrinkAlpha(nowT) {
  const tLeftSec = Math.max(0, (holesMoveAt - nowT) / 1000);
  const raw = (BANK_SHRINK_SEC - tLeftSec) / BANK_SHRINK_SEC;
  return clamp(raw, 0, 1);
}

// Current effective bank radius based on time to rotation.
function currentBankRadius(baseR, nowT) {
  const alpha = bankShrinkAlpha(nowT);
  // interpolate radius from 1.0 -> BANK_SHRINK_MIN_SCALE over shrink window
  const scale = 1 - alpha + alpha * BANK_SHRINK_MIN_SCALE;
  return baseR * scale;
}
// cash-out allowed the whole cycle (for now)
function canCashOut() {
  return true;
}

function tryCashOut(p) {
  if (!p || !p.alive) return false;
  if (p.isGhost) return false; // ghosts cannot cash out
  if (!canCashOut()) return false;

  const nowT = nowMs();

  for (const h of holes) {
    const d  = distWrap(p.x, p.y, h.x, h.y);
    const hr = currentBankRadius(h.r, nowT); // shrink-aware radius

    if (d <= hr - p.r) {
      const w = p.wallet;

      const gross = (w.wallet | 0);                      // cents
      const fee   = Math.floor(gross * CASHOUT_FEE_PCT);  // cents
      const net   = Math.max(0, gross - fee);             // cents

      houseCents += fee;
      w.wallet = 0; // prevent double cashout

      receipt = {
        kind:   'CASH_OUT',
        spend:  (w.boosts / 100),
        kills:  (w.kills  / 100),
        gross:  (gross / 100),
        fee:    (fee   / 100),
        payout: (net   / 100),
      };

      if (typeof logEcon === 'function') {
        logEcon('CASH_OUT', { player: p.id, gross, fee, net });
      }

      state = 'event';
      return true;
    }
  }

  return false;
}

// ---------- Death ----------
// ---------- Death ----------
function accidentalSplit(victim) {
  // Ghosts should not lose money from asteroid contact during join-protection.
  // (They CAN still die at ghost-end because tickGhostEnd clears isGhost first.)
  if (victim.isGhost) return;

  const amt = victim.wallet.wallet | 0;   // cents
  victim.wallet.wallet = 0;

  const houseTake = Math.floor(amt * ACCIDENT_HOUSE_PCT);
  const bonusTake = amt - houseTake;

  houseCents += houseTake;
  bonusPotCents += bonusTake;

  logEcon('ACCIDENT_SPLIT', { amt, houseTake, bonusTake, victim: victim.id });
}

function die(p, cause) {
  if (!p.alive) return;

  // Ignore asteroid deaths during ghost-protection.
  // (Still allows the "expire inside asteroid = die" rule because isGhost is cleared first.)
  if (p.isGhost && cause === 'ACCIDENT') return;

  p.alive = false;

  if (p.id === 'you') {
    const w = p.wallet;
    receipt = {
      kind: cause, // 'KILLED' | 'ACCIDENT'
      spend: (w.boosts/100),
      kills: (w.kills/100),
      payout: 0
    };
    state = 'event';
  }
}

// ---------- Setup ----------
let player;
function setup() {
  asteroids = Array.from({length: ASTEROID_COUNT}, () => makeAsteroid());
  rotateHoles();

  player = makePlayer(WORLD_SIZE/2, WORLD_SIZE/2, UFO_R, 260);
  startGhost(player);
  bots   = Array.from({length: BOT_COUNT}, (_,i)=> makeBot(i+1));
  entities = [player, ...bots];

    // Reset boost bar visual state each life
  lastBoostRatio  = 1;
  boostFlashUntil = 0;

  state = 'play';
  receipt = null;

  ensureUI();    // creates feed panel + boost bar
  feed.length = 0;
  renderFeed();

  bankTimer = 0;
}
setup();

// debug exports (safe: getters, no TDZ)
window.__atm = {
  get player(){ return player; },
  get bots(){ return bots; },
  get asteroids(){ return asteroids; },
  get holes(){ return holes; },
  get entities(){ return entities; },
};

function respawn() {
  setup();
}
// ---------- Ghost join protection ----------
function startGhost(p) {
  if (p.isGhost) return;              // IMPORTANT: prevents resetting forever
  p.isGhost = true;
  p.ghostUntil = nowMs() + GHOST_MS;

  p.boostHeld = false;
  p.velX = 0; p.velY = 0;
  p.stun = 0;
}

// Ghosts cannot enter banks (solid wall)
function resolveGhostBankWalls(p, nowT) {
  if (!p.isGhost) return;

  for (const h of holes) {
    const hr = currentBankRadius(h.r, nowT);

    const dx = wrapDelta(p.x - h.x);
    const dy = wrapDelta(p.y - h.y);
    const d  = Math.hypot(dx, dy) || 1e-6;

    const minD = hr + p.r;
    if (d < minD) {
      const nx = dx / d;
      const ny = dy / d;

      // snap to edge of bank
      p.x = (h.x + nx * minD + WORLD_SIZE) % WORLD_SIZE;
      p.y = (h.y + ny * minD + WORLD_SIZE) % WORLD_SIZE;

      p.velX = 0; p.velY = 0;
    }
  }
}

function tickGhostEnd(p) {
  if (!p.isGhost) return;
  if (nowMs() < p.ghostUntil) return;

  p.isGhost = false;
  p.ghostUntil = 0;

  // if ghost ends inside asteroid -> die (skill issue)
  for (const a of asteroids) {
    const d = distWrap(p.x, p.y, a.x, a.y);
    if (d < p.r + a.r) {
      if (p.isGhost) continue;
      accidentalSplit(p);
      die(p, 'ACCIDENT');
      break;
    }
  }
}


// ---------- Update ----------
let last = nowMs();
function step(dtMs) {
  // move banks if time elapsed
  if (nowMs() >= holesMoveAt) rotateHoles();
    const nowT = nowMs(); // <-- ADD THIS (shared timestamp for this tick)

  // camera follows player center, with shake
  camera.x = player.x; camera.y = player.y;
  if (camera.shakeT > 0) {
    const k = (camera.shakeT / (SHAKE_TIME*1000));
    camera.x += (Math.random()*2-1) * camera.shake * k;
    camera.y += (Math.random()*2-1) * camera.shake * k;
    camera.shakeT -= dtMs;
  }

  // steering for player
  if (player.alive) {
    const pw = screenToWorld(pointer.x, pointer.y);
    const dx = wrapDelta(pw.x - player.x);
    const dy = wrapDelta(pw.y - player.y);
    const d  = Math.hypot(dx, dy);
    if (d > INNER_IGNORE_PX) {
      const target = Math.atan2(dy, dx);
      const snap = SNAP_ANGLE_DEG * Math.PI/180;
      // snap aiming
      const diff = Math.atan2(Math.sin(target - player.targetAngle), Math.cos(target - player.targetAngle));
      if (Math.abs(diff) > snap) player.targetAngle = target;

    }
    // smooth toward target
    const t = clamp(dtMs / (SMOOTH_MS*1000), 0, 1);
    player.heading = angleLerp(player.heading, player.targetAngle, t);
  }

  // bots: wander + avoid asteroids a bit
  for (const b of bots) {
    if (!b.alive) continue;
    b.nextWanderT -= dtMs/1000;
    if (b.nextWanderT <= 0) {
      b.targetAngle = rnd(0, TAU);
      b.nextWanderT = rnd(BOT_WANDER_SEC[0], BOT_WANDER_SEC[1]);
      b.boostHeld = Math.random() < 0.15; // occasional bursts
    }
    // avoid nearest asteroid
    let nearest = null, nd = 1e9;
    for (const a of asteroids) {
      const d = distWrap(b.x, b.y, a.x, a.y);
      if (d < nd) { nd = d; nearest = a; }
    }
    if (nearest && nd < BOT_AVOID_AST_R + nearest.r) {
  const angAway = angleTo(nearest.x, nearest.y, b.x, b.y);
  // Weaken avoidance so they don't dodge perfectly every time
  if (Math.random() < 0.12) {
    // 12% of the time, ignore avoidance this tick (bots make mistakes)
  } else {
    b.targetAngle = angleLerp(b.targetAngle, angAway, 0.28);
  }
}

    // smooth rotate
    const t = clamp(dtMs / (SMOOTH_MS*1000), 0, 1);
    b.heading = angleLerp(b.heading, b.targetAngle, t);
  }

  // boost budgets + movement + knockback decay
  for (const p of entities) {
  if (!p.alive) continue;

  // ghosts still move & steer, but cannot boost
  if (p.isGhost) p.boostHeld = false;

    // speed with boost
    const hasFree   = p.freeBudget > 0;
    const canPay    = p.wallet.wallet > BOOST_MIN_WALLET_CENTS; // must stay above floor *after* paying
    const boostActive = p.boostHeld && (hasFree || canPay);

    let spd = p.speed * (boostActive ? BOOST_MULT : 1);


    // stun reduces control (but not knockback drift)
    if (p.stun > 0) p.stun -= dtMs;

    // base directional vel from heading
    const vx = Math.cos(p.heading) * spd;
    const vy = Math.sin(p.heading) * spd;

    // knockback decay
    p.velX = lerp(p.velX, 0, clamp(KNOCKBACK_DAMP*dtMs/1000, 0, 1));
    p.velY = lerp(p.velY, 0, clamp(KNOCKBACK_DAMP*dtMs/1000, 0, 1));

    p.x = (p.x + vx * dtMs/1000 + p.velX * dtMs/1000 + WORLD_SIZE) % WORLD_SIZE;
    p.y = (p.y + vy * dtMs/1000 + p.velY * dtMs/1000 + WORLD_SIZE) % WORLD_SIZE;
      
    // ----- ghost rules (must run AFTER movement) -----
  if (p.isGhost) p.boostHeld = false;   // hard-disable boost
  resolveGhostBankWalls(p, nowT);       // banks are walls for ghosts
  tickGhostEnd(p);                      // end ghost / kill if overlapping asteroid

    // boost budgets & billing
if (p.boostHeld) {
  const dt = dtMs/1000;

  // consume free energy first
  const freeUse = Math.min(p.freeBudget, dt);
  p.freeBudget -= freeUse;

  // any remainder is paid if we are above the spend floor
  const paid = dt - freeUse;
  if (paid > 0 && p.wallet.wallet > BOOST_MIN_WALLET_CENTS) {
    p.paidAccum += paid;
    while (p.paidAccum >= TICK_SECONDS && p.wallet.wallet > BOOST_MIN_WALLET_CENTS) {
      p.paidAccum -= TICK_SECONDS;
      spendBoostCent(p); // applies floor + feed (no-op for bots' feed)
    }
  }

  // prevent "stored" paid time bursting when we hit floor
  if (p.wallet.wallet <= BOOST_MIN_WALLET_CENTS) {
    p.paidAccum = 0;
  }
} else {
  // recharge only while NOT boosting
  p.freeBudget = Math.min(FREE_CAP_SEC, p.freeBudget + FREE_REFILL_RATE * dtMs/1000);
  p.paidAccum  = Math.max(0, p.paidAccum - dtMs/1000 * 0.5);
}
  }

  // asteroid movement (toroid)
  for (const a of asteroids) {
    a.x = (a.x + a.vx * dtMs/1000 + WORLD_SIZE) % WORLD_SIZE;
    a.y = (a.y + a.vy * dtMs/1000 + WORLD_SIZE) % WORLD_SIZE;
  }

  // asteroid-asteroid pinball
  for (let i=0;i<asteroids.length;i++) {
    for (let j=i+1;j<asteroids.length;j++) {
      const A = asteroids[i], B = asteroids[j];
      const dW = deltaWrap(A.x, A.y, B.x, B.y);
      let dx = dW.dx;
      let dy = dW.dy;

      const d = Math.hypot(dx, dy);
      const minD = A.r + B.r + NEAR_REPEL;
      if (d < minD) {
        const nx = dx/(d||1), ny = dy/(d||1);
        let imp = Math.max(MIN_IMPULSE, (minD - d) * SEPARATION_BIAS);
        A.x -= nx*imp*0.5; A.y -= ny*imp*0.5;
        B.x += nx*imp*0.5; B.y += ny*imp*0.5;
        wrapPos(A);
        wrapPos(B);

        // bounce velocities
        const rvx = B.vx - A.vx, rvy = B.vy - A.vy;
        const vn  = rvx*nx + rvy*ny;
        const jimp = -(1+BOUNCE_RESTITUTION) * vn / 2;
        const jx = jimp*nx, jy=jimp*ny;
        A.vx -= jx; A.vy -= jy;
        B.vx += jx; B.vy += jy;
        // clamp
        const clampV = (a)=> {
          const sp = Math.hypot(a.vx,a.vy);
          let ns = sp;
          if (sp < SPEED_FLOOR_AFTER) ns = SPEED_FLOOR_AFTER;
          if (sp > SPEED_CAP_AFTER)   ns = lerp(sp, SPEED_CAP_AFTER, 0.5*HIGH_SPEED_RELAX);
          if (ns !== sp) { const k = ns/(sp||1); a.vx*=k; a.vy*=k; }
        };
        clampV(A); clampV(B);
      }
    }
  }

    // asteroids vs black-holes (holes don't move; reflect asteroids)
  for (const a of asteroids) {
    for (const h of holes) {
      const d = distWrap(a.x, a.y, h.x, h.y);
      const hr = currentBankRadius(h.r, nowMs());
      const minD = a.r + hr - 6; // small cushion so visuals look good
      if (d < minD) {
  // Normal MUST point from hole -> asteroid (outward)
  const { dx, dy } = deltaWrap(h.x, h.y, a.x, a.y);

  const invD = 1 / (d || 1);
  const nx = dx * invD;
  const ny = dy * invD;

  // push out (along outward normal)
  const push = (minD - d) + 1;
  a.x = mod(a.x + nx * push, WORLD_SIZE);
  a.y = mod(a.y + ny * push, WORLD_SIZE);

  // reflect vel across the normal (outward)
  const vn = a.vx * nx + a.vy * ny;
  a.vx -= (1 + BH_WALL_RESTITUTION) * vn * nx;
  a.vy -= (1 + BH_WALL_RESTITUTION) * vn * ny;
      }
    }
  }
  
  // player/bot vs asteroid: die (credit window)
  for (const p of entities) {
    if (!p.alive) continue;

    for (const a of asteroids) {
      const d = distWrap(p.x, p.y, a.x, a.y);

      if (d < p.r + a.r) {
        // determine killer credit
        const recent = (nowMs() - (p.lastHitAt || -1)) <= ACCIDENT_CREDIT_WINDOW_MS;
        const killerId = recent ? p.lastHitBy : null;


        if (killerId) {
          const killer = entities.find(e => e.id === killerId);
          if (killer) awardKill(killer, p);
        } else {
          accidentalSplit(p);
          if (p.id === 'you') {
            pushFeed(`Accidental death <span class="neg">- your wallet</span>`);
          }
        }

        die(p, killerId ? 'KILLED' : 'ACCIDENT');
        break; // stop checking other asteroids for this p
      }
    }
  }

  // player-bot bumps
  function tryBump(a, b) {
    if (!a.alive || !b.alive) return;
    if (a.isGhost || b.isGhost) return; // ghosts do not bump
    const d = distWrap(a.x, a.y, b.x, b.y);
    if (d < a.r + b.r + COLLISION_PAD) applyBump(a, b);
  }

  // player with bots
  for (const b of bots) tryBump(player, b);

  // bot-bot
  for (let i = 0; i < bots.length; i++) {
    for (let j= i + 1; j < bots.length; j++) {
      tryBump(bots[i], bots[j]);
    }
  }

  // cash-out if inside hole during pulse and player clicks (auto-check)
if (player.alive) {
  tryCashOut(player);
}
}
// ---------- Draw ----------
function draw() {
  // bg
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, W, H);

  // --- Banks: shrink + countdown ring ---
  const pulsing = inPulse();
  const nowT = nowMs();
  const tLeftSecTotal = Math.max(0, (holesMoveAt - nowT) / 1000);
  const fracLeftTotal = clamp(tLeftSecTotal / BANK_ROTATE_SEC, 0, 1); // 1 at start, 0 at move

  for (const h of holes) {
    const s = worldToScreen(h.x, h.y);

    // shrink-aware radius (matches cash-out + collisions)
    const rr = currentBankRadius(h.r, nowT);

    // soft halo
    ctx.beginPath();
    ctx.arc(s.x, s.y, rr + 24, 0, TAU);
    ctx.fillStyle = 'rgba(30,50,90,0.35)';
    ctx.fill();

    // core
    ctx.beginPath();
    ctx.arc(s.x, s.y, rr, 0, TAU);
    ctx.fillStyle = 'rgba(10,16,28,0.9)';
    ctx.fill();

    // countdown ring (time until banks rotate)
    const phase = 1 - fracLeftTotal; // 0 at start of cycle, 1 near rotation
    const [cr, cg, cb] = lerpColor([120, 190, 255], [255, 130, 120], phase); // blue -> warm

    const ringR = rr + 32;
    const baseAlpha  = pulsing ? 0.9 : 0.45;
    const pulseAlpha = pulsing ? 0.25 * Math.sin(nowT / 160) : 0; // gentle throbbing in pulse
    const alpha      = clamp(baseAlpha + pulseAlpha, 0.1, 1);

    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.beginPath();
    ctx.arc(
      s.x,
      s.y,
      ringR,
      -Math.PI / 2,
      -Math.PI / 2 + fracLeftTotal * TAU, // arc shrinks as time runs out
      false
    );
    ctx.stroke();
    ctx.restore();

    // small numeric countdown above bank
    ctx.save();
    ctx.fillStyle = 'rgba(210,225,255,0.75)';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tLeftSecTotal.toFixed(1) + 's', s.x, s.y - ringR - 10);
    ctx.restore();
  }

  // --- Arrow to nearest bank if none are on screen ---
  const anyBankOnScreen = holes.some(h => {
    const s = worldToScreen(h.x, h.y);
    return s.x > 0 && s.x < W && s.y > 0 && s.y < H;
  });

  if (!anyBankOnScreen && holes.length > 0) {
    // pick nearest bank (toroid distance)
    let best = null;
    let bestDist = 1e9;
    for (const h of holes) {
      const d = distWrap(player.x, player.y, h.x, h.y);
      if (d < bestDist) {
        bestDist = d;
        best = h;
      }
    }

    if (best) {
      const ang = angleTo(player.x, player.y, best.x, best.y);
      const radius = Math.min(W, H) * 0.42;
      const px = W / 2 + Math.cos(ang) * radius;
      const py = H / 2 + Math.sin(ang) * radius;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(18, 0);
      ctx.lineTo(0, 10);
      ctx.closePath();
      ctx.fillStyle = '#9ec7ff';
      ctx.fill();
      ctx.restore();
    }
  }

  // --- Asteroids ---
  for (const a of asteroids) {
    const s = worldToScreen(a.x, a.y);
    ctx.beginPath(); ctx.arc(s.x, s.y, a.r + 6, 0, TAU);
    ctx.fillStyle = 'rgba(200,200,220,0.08)'; ctx.fill();
    ctx.beginPath(); ctx.arc(s.x, s.y, a.r, 0, TAU);
    ctx.fillStyle = '#8b8f9a'; ctx.fill();
  }

  // --- Entities (player + bots) ---
  function drawShip(p, color) {
  const s = worldToScreen(p.x, p.y);

  ctx.save();
  if (p.isGhost) ctx.globalAlpha = GHOST_ALPHA;

  // glow
  ctx.beginPath(); ctx.arc(s.x, s.y, p.r + 5, 0, TAU);
  ctx.fillStyle = 'rgba(90,170,255,0.25)'; ctx.fill();

  // boost trail
  if (p.boostHeld) {
    const bx = s.x - Math.cos(p.heading) * (p.r + 6);
    const by = s.y - Math.sin(p.heading) * (p.r + 6);

    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(
      bx - Math.cos(p.heading) * 22,
      by - Math.sin(p.heading) * 22
    );
    ctx.strokeStyle = 'rgba(150,200,255,0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      bx - Math.cos(p.heading) * 12,
      by - Math.sin(p.heading) * 12,
      4,
      0,
      TAU
    );
    ctx.fillStyle = 'rgba(160,220,255,0.35)';
    ctx.fill();
  }

  // core
  ctx.beginPath(); ctx.arc(s.x, s.y, p.r, 0, TAU);
  ctx.fillStyle = color; ctx.fill();

  ctx.restore();
}

drawGhostCountdown(ctx, W, H, player, nowT);

  if (player.alive) drawShip(player, '#4ab0ff');
  for (const b of bots) if (b.alive) drawShip(b, '#a6c2ff');

  // --- HUD baseline ---
  const tLeft = Math.max(0, (holesMoveAt - nowMs()) / 1000);
  const pulse = inPulse();
  const seamX = Math.min(player.x, WORLD_SIZE - player.x);
const seamY = Math.min(player.y, WORLD_SIZE - player.y);

const txt =
  `Boost spend: ${fmt$(player.wallet.boosts)} • Wallet: ${fmt$(player.wallet.wallet)} • Banks: ${pulse ? 'PULSE' : (tLeft.toFixed(1)+'s')}` +
  ` • x:${player.x.toFixed(1)} y:${player.y.toFixed(1)}` +
  ` • seamX:${seamX.toFixed(1)} seamY:${seamY.toFixed(1)}`;

hud.textContent = txt;

  // Update free–boost bar
  updateBoostBar(player);

  // --- Event overlay (receipt) ---
if (state !== 'play' && receipt) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#e9f5ff';
  ctx.font = '28px system-ui,Segoe UI,Roboto,sans-serif';
  ctx.textAlign = 'center';

  const y0 = H / 2 - 56;

  const title =
    receipt.kind === 'CASH_OUT'
      ? 'CASHED OUT'
      : (receipt.kind === 'KILLED' ? 'ELIMINATED' : 'ACCIDENT');

  ctx.fillText(title, W / 2, y0);

  ctx.font = '16px system-ui,Segoe UI,Roboto,sans-serif';
  ctx.fillText(
    `Boost spent: ${fmt$(Math.round(receipt.spend * 100))}  •  Kills won: ${fmt$(Math.round(receipt.kills * 100))}`,
    W / 2,
    y0 + 36
  );

  if (receipt.kind === 'CASH_OUT') {
    ctx.fillText(
      `Gross: ${fmt$(Math.round(receipt.gross * 100))}  •  Fee (${Math.round(CASHOUT_FEE_PCT * 100)}%): ${fmt$(Math.round(receipt.fee * 100))}`,
      W / 2,
      y0 + 60
    );
    ctx.fillText(
      `Payout to account: ${fmt$(Math.round(receipt.payout * 100))}`,
      W / 2,
      y0 + 84
    );
  } else {
    ctx.fillText('Payout to account: $0.00', W / 2, y0 + 60);
  }

  ctx.fillText('(Click / Enter / Space to respawn)', W / 2, y0 + 120);
  ctx.restore();

}
}
// ---------- Main loop ----------
function loop(t) {
  const dt = clamp(t - last, 5, 33); last = t;
  if (state === 'play') step(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);