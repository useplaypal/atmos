import { WORLD_SIZE } from './constants.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const nowMs = () => performance.now();

export function wrap01(v) {
  v = v % WORLD_SIZE;
  return v < 0 ? v + WORLD_SIZE : v;
}

export function mod(n, m) {
  return ((n % m) + m) % m;
}

export function wrapPos(o) {
  o.x = wrap01(o.x);
  o.y = wrap01(o.y);
}

export function toCents(d) {
  return Math.round(d * 100);
}

export const fmt$ = (c) => `$${(c / 100).toFixed(2)}`;

export const angleLerp = (a, b, t) => {
  const d = (b - a + Math.PI) % TAU - Math.PI;
  return a + d * t;
};

export function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function wrapDelta(d) {
  return mod(d + WORLD_SIZE / 2, WORLD_SIZE) - WORLD_SIZE / 2;
}

export function deltaWrap(ax, ay, bx, by) {
  return {
    dx: wrapDelta(bx - ax),
    dy: wrapDelta(by - ay),
  };
}

export function distWrap(ax, ay, bx, by) {
  const { dx, dy } = deltaWrap(ax, ay, bx, by);
  return Math.hypot(dx, dy);
}

export function angleTo(ax, ay, bx, by) {
  const { dx, dy } = deltaWrap(ax, ay, bx, by);
  return Math.atan2(dy, dx);
}
