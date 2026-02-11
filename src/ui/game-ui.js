import { FEED_MAX, FREE_CAP_SEC } from '../game/constants.js';
import { clamp, lerpColor, nowMs } from '../game/utils.js';

function boostColorForRatio(ratio) {
  ratio = clamp(ratio, 0, 1);

  const full = [120, 190, 255];
  const mid = [255, 210, 120];
  const empty = [255, 120, 120];

  if (ratio >= 0.7) return full;
  if (ratio >= 0.3) {
    const t = (ratio - 0.3) / 0.4;
    return lerpColor(mid, full, t);
  }
  const t = ratio / 0.3;
  return lerpColor(empty, mid, t);
}

export function createGameUI() {
  let feedEl = null;
  let feed = [];

  let boostBarEl = null;
  let boostFillEl = null;
  let boostLabelEl = null;

  let lastBoostRatio = 1;
  let boostFlashUntil = 0;

  function ensureFeedPanel() {
    if (feedEl) return;

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

  function renderFeed() {
    if (!feedEl) return;
    const lines = feed.map((f) => `<div class="row">${f.html}</div>`).join('');
    feedEl.innerHTML = lines;
  }

  function pushFeed(html) {
    feed.unshift({ html, t: performance.now() });
    while (feed.length > FEED_MAX) feed.pop();
    renderFeed();
  }

  function ensureBoostBar() {
    if (boostBarEl) return;

    const parent = document.body;

    boostBarEl = document.getElementById('boostbar');
    if (!boostBarEl) {
      boostBarEl = document.createElement('div');
      boostBarEl.id = 'boostbar';
      parent.appendChild(boostBarEl);
    }
    Object.assign(boostBarEl.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
      width: '240px',
      height: '12px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.08)',
      boxShadow: '0 0 1px rgba(160,160,255,0.35) inset, 6px 18px rgba(0,0,0,0.35)',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 10000,
    });

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
      width: '100%',
      backgroundColor: 'rgba(120,190,255,0.95)',
      boxShadow: '0 0 16px rgba(80,160,255,0.35)',
      transition:
        'width 80ms linear, opacity 120ms linear, background-color 150ms linear, box-shadow 150ms linear',
    });

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

  function ensureUI() {
    ensureFeedPanel();
    ensureBoostBar();
  }

  function updateBoostBar(player) {
    if (!boostBarEl || !boostFillEl || !boostLabelEl) return;

    const now = nowMs();
    const ratio = clamp(player.freeBudget / FREE_CAP_SEC, 0, 1);
    const pct = Math.round(ratio * 100);

    if (lastBoostRatio < 0.999 && ratio >= 0.999) {
      boostFlashUntil = now + 300;
    }

    let glow = 0.35;
    if (now < boostFlashUntil) {
      glow = 0.9;
    }

    const [r, g, b] = boostColorForRatio(ratio);

    boostFillEl.style.width = `${pct}%`;
    boostFillEl.style.opacity = ratio > 0 ? '1' : '0.25';
    boostFillEl.style.backgroundColor = `rgba(${r},${g},${b},0.98)`;
    boostFillEl.style.boxShadow = `0 0 18px rgba(${r},${g},${b},${glow})`;

    boostLabelEl.textContent = `Free boost: ${pct}%`;
    lastBoostRatio = ratio;
  }

  function resetRoundUI() {
    feed = [];
    renderFeed();
    lastBoostRatio = 1;
    boostFlashUntil = 0;
  }

  return {
    ensureUI,
    pushFeed,
    renderFeed,
    updateBoostBar,
    resetRoundUI,
  };
}
