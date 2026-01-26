// src/ui/overlays.js

export function drawGhostCountdown(ctx, W, H, player, nowT) {
  if (!player || !player.isGhost) return;

  const msLeft = Math.max(0, player.ghostUntil - nowT);
  const secLeft = Math.ceil(msLeft / 1000);

  ctx.save();

  // very light veil for readability
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#e9f5ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Number (moved UP so it doesn't sit on the ship)
  ctx.globalAlpha = 0.85;
  ctx.font = '84px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText(String(secLeft), W / 2, H / 2 - 110);

  // Subtitle (also moved up)
  ctx.globalAlpha = 0.65;
  ctx.font = '18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText('Joining match…', W / 2, H / 2 - 56);

  ctx.restore();
}
