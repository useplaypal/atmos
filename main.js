// ultra-minimal canvas loop: blue "UFO" dot follows your mouse at constant speed
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W = window.innerWidth, H = window.innerHeight;
canvas.width = W; canvas.height = H;

// world state
const ufo = { x: W/2, y: H/2, r: 12, speed: 260 }; // pixels per second
const pointer = { x: ufo.x, y: ufo.y };

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
}
window.addEventListener('resize', resize);

window.addEventListener('mousemove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
});
window.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (!t) return;
  pointer.x = t.clientX; pointer.y = t.clientY;
}, { passive: true });

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); // clamp to ~30fps delta
  last = now;

  // move toward pointer at constant speed
  let dx = pointer.x - ufo.x;
  let dy = pointer.y - ufo.y;
  const d2 = dx*dx + dy*dy;
  if (d2 > 1) {
    const d = Math.sqrt(d2);
    const nx = dx / d, ny = dy / d;
    ufo.x += nx * ufo.speed * dt;
    ufo.y += ny * ufo.speed * dt;
  }

  // draw
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, W, H);

  // glow
  ctx.beginPath();
  ctx.arc(ufo.x, ufo.y, ufo.r + 6, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(102,204,255,0.15)';
  ctx.fill();

  // body
  ctx.beginPath();
  ctx.arc(ufo.x, ufo.y, ufo.r, 0, Math.PI*2);
  ctx.fillStyle = '#66ccff';
  ctx.fill();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
