// ============================================================
// Battleship — game logic
// ============================================================
// Architecture
//   * Phase machine:  "setup" -> "battle" -> "over"
//   * Two boards, each a 10x10 grid of cells { ship, hit }.
//   * Ships rendered as SVG sprites in an overlay layer on top
//     of the grid (so they span multiple cells as one image).
//   * Setup phase: player picks a ship, hovers to preview, clicks
//     to place. Rotate with R or the button. Auto-Place randomizes.
//   * Battle phase: click enemy cells to fire. AI uses a
//     hunt-and-target strategy with parity-biased hunting.
//   * Enemy "captain" sends chat messages on game events.
// ============================================================

const SIZE = 10;
const CELL = 34;
const GAP = 2;
const STRIDE = CELL + GAP;          // 36px per cell
const COLS = ["A","B","C","D","E","F","G","H","I","J"];
const coord = (r, c) => `${COLS[c]}${r + 1}`;

const SHIPS = [
  { name: "Carrier",    length: 5 },
  { name: "Battleship", length: 4 },
  { name: "Cruiser",    length: 3 },
  { name: "Submarine",  length: 3 },
  { name: "Destroyer",  length: 2 },
];

// ============================================================
// SVG ship sprites (horizontal orientation, viewBox: 0 0 W 34)
// ============================================================
function shipSvg(name, length) {
  const W = length * STRIDE;
  switch (name) {
    case "Carrier":    return carrierSvg(W);
    case "Battleship": return battleshipSvg(W);
    case "Cruiser":    return cruiserSvg(W);
    case "Submarine":  return submarineSvg(W);
    case "Destroyer":  return destroyerSvg(W);
  }
  return "";
}

function hullDefs(id) {
  // Multi-stop gradients fake directional lighting: bright specular highlight
  // near the top, mid steel band, dropping into deep shadow at the waterline.
  return `<defs>
    <linearGradient id="hull-${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0"    stop-color="#dbe3ee"/>
      <stop offset="0.08" stop-color="#a3b1c4"/>
      <stop offset="0.35" stop-color="#5a6b85"/>
      <stop offset="0.65" stop-color="#334155"/>
      <stop offset="0.88" stop-color="#1a2536"/>
      <stop offset="1"    stop-color="#0a1220"/>
    </linearGradient>
    <linearGradient id="deck-${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0"    stop-color="#cbd5e1"/>
      <stop offset="0.25" stop-color="#94a3b8"/>
      <stop offset="0.7"  stop-color="#4b5b73"/>
      <stop offset="1"    stop-color="#1e293b"/>
    </linearGradient>
    <!-- Soft cast shadow ellipse beneath the hull -->
    <radialGradient id="shadow-${id}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0"   stop-color="rgba(0,0,0,0.55)"/>
      <stop offset="0.6" stop-color="rgba(0,0,0,0.20)"/>
      <stop offset="1"   stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>`;
}

function carrierSvg(W) {
  const id = "c";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 34" preserveAspectRatio="none">
    ${hullDefs(id)}
    <!-- hull -->
    <path d="M 4 24 L ${W-14} 24 L ${W-4} 17 L ${W-14} 10 L 4 10 Q -2 17 4 24 Z"
          fill="url(#hull-${id})" stroke="#0f172a" stroke-width="1"/>
    <!-- flight deck -->
    <rect x="8" y="6" width="${W-24}" height="22" rx="3"
          fill="url(#deck-${id})" stroke="#1e293b" stroke-width="0.8"/>
    <!-- deck centerline -->
    <line x1="14" y1="17" x2="${W-28}" y2="17" stroke="#cbd5e1" stroke-width="0.6" stroke-dasharray="3,3" opacity="0.7"/>
    <!-- island / tower -->
    <rect x="${W*0.6}" y="2" width="14" height="9" rx="1.5" fill="#334155" stroke="#0f172a" stroke-width="0.8"/>
    <rect x="${W*0.6 + 4}" y="-1" width="2" height="4" fill="#94a3b8"/>
  </svg>`;
}

function battleshipSvg(W) {
  const id = "b";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 34" preserveAspectRatio="none">
    ${hullDefs(id)}
    <path d="M 6 26 L ${W-12} 26 L ${W-2} 17 L ${W-12} 8 L 6 8 Q 0 17 6 26 Z"
          fill="url(#hull-${id})" stroke="#0f172a" stroke-width="1"/>
    <!-- main deck -->
    <rect x="12" y="11" width="${W-28}" height="12" rx="2" fill="#475569" stroke="#1e293b" stroke-width="0.6"/>
    <!-- bridge / superstructure -->
    <rect x="${W*0.4}" y="5" width="${W*0.2}" height="9" rx="1.5" fill="#334155" stroke="#0f172a" stroke-width="0.6"/>
    <rect x="${W*0.46}" y="2" width="4" height="6" fill="#1e293b"/>
    <!-- fore turret -->
    <circle cx="${W*0.18}" cy="17" r="5" fill="#1e293b"/>
    <rect x="${W*0.18 - 2}" y="9" width="4" height="9" fill="#334155"/>
    <!-- aft turret -->
    <circle cx="${W*0.78}" cy="17" r="5" fill="#1e293b"/>
    <rect x="${W*0.78 - 2}" y="16" width="4" height="9" fill="#334155"/>
  </svg>`;
}

function cruiserSvg(W) {
  const id = "cr";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 34" preserveAspectRatio="none">
    ${hullDefs(id)}
    <path d="M 5 25 L ${W-10} 25 L ${W-2} 17 L ${W-10} 9 L 5 9 Q -1 17 5 25 Z"
          fill="url(#hull-${id})" stroke="#0f172a" stroke-width="1"/>
    <rect x="10" y="12" width="${W-22}" height="10" rx="2" fill="#475569" stroke="#1e293b" stroke-width="0.6"/>
    <!-- bridge -->
    <rect x="${W*0.45}" y="6" width="${W*0.18}" height="8" rx="1.5" fill="#334155" stroke="#0f172a" stroke-width="0.6"/>
    <rect x="${W*0.5}" y="2" width="3" height="5" fill="#1e293b"/>
    <!-- turret -->
    <circle cx="${W*0.22}" cy="17" r="4.5" fill="#1e293b"/>
    <rect x="${W*0.22 - 1.5}" y="10" width="3" height="7" fill="#334155"/>
    <!-- stack -->
    <rect x="${W*0.7}" y="6" width="5" height="7" rx="1" fill="#1e293b"/>
  </svg>`;
}

function submarineSvg(W) {
  const id = "s";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 34" preserveAspectRatio="none">
    <defs>
      <linearGradient id="sub-${id}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#64748b"/>
        <stop offset="0.5" stop-color="#334155"/>
        <stop offset="1" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <!-- cigar hull -->
    <ellipse cx="${W/2}" cy="20" rx="${W/2 - 3}" ry="7" fill="url(#sub-${id})" stroke="#0f172a" stroke-width="1"/>
    <!-- highlight stripe -->
    <ellipse cx="${W/2}" cy="17" rx="${W/2 - 8}" ry="1.5" fill="#94a3b8" opacity="0.5"/>
    <!-- conning tower -->
    <path d="M ${W*0.4} 15 L ${W*0.4} 8 Q ${W*0.45} 5 ${W*0.55} 5 Q ${W*0.6} 5 ${W*0.6} 8 L ${W*0.6} 15 Z"
          fill="#1e293b" stroke="#0f172a" stroke-width="0.6"/>
    <!-- periscope -->
    <line x1="${W*0.5}" y1="5" x2="${W*0.5}" y2="0" stroke="#94a3b8" stroke-width="1.2"/>
    <circle cx="${W*0.5}" cy="0.5" r="1.2" fill="#94a3b8"/>
  </svg>`;
}

function destroyerSvg(W) {
  const id = "d";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 34" preserveAspectRatio="none">
    ${hullDefs(id)}
    <path d="M 4 24 L ${W-9} 24 L ${W-2} 17 L ${W-9} 10 L 4 10 Q -1 17 4 24 Z"
          fill="url(#hull-${id})" stroke="#0f172a" stroke-width="1"/>
    <rect x="8" y="12" width="${W-18}" height="10" rx="2" fill="#475569" stroke="#1e293b" stroke-width="0.6"/>
    <!-- bridge -->
    <rect x="${W*0.3}" y="7" width="${W*0.25}" height="7" rx="1.2" fill="#334155" stroke="#0f172a" stroke-width="0.6"/>
    <!-- smokestack -->
    <rect x="${W*0.62}" y="5" width="5" height="9" rx="1" fill="#1e293b"/>
    <ellipse cx="${W*0.645}" cy="5" rx="2.5" ry="1" fill="#475569"/>
  </svg>`;
}

// Smaller version for ship picker chips (always horizontal, scaled)
function chipSvg(name, length) {
  return shipSvg(name, length);
}

// ============================================================
// Captain avatar (inline SVG portrait of a grizzled sailor)
// ============================================================
const CAPTAIN_SVG = `
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="capBg" cx="0.5" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#3b5a82"/>
      <stop offset="1" stop-color="#0a1628"/>
    </radialGradient>
    <linearGradient id="capSkin" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#e6b88a"/>
      <stop offset="1" stop-color="#a87850"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" fill="url(#capBg)"/>
  <!-- neck / collar (navy uniform) -->
  <path d="M 10 38 Q 20 32 30 38 L 30 40 L 10 40 Z" fill="#0c1d33"/>
  <path d="M 16 36 L 20 40 L 24 36 Z" fill="#f4f4f5"/>
  <!-- face -->
  <ellipse cx="20" cy="22" rx="10" ry="11" fill="url(#capSkin)"/>
  <!-- ears -->
  <ellipse cx="10.5" cy="22" rx="1.6" ry="2.4" fill="#a87850"/>
  <ellipse cx="29.5" cy="22" rx="1.6" ry="2.4" fill="#a87850"/>
  <!-- beard -->
  <path d="M 11 22 Q 12 31 16 33 Q 20 35 24 33 Q 28 31 29 22
           Q 27 27 24 28 Q 20 29 16 28 Q 13 27 11 22 Z"
        fill="#2a1810"/>
  <!-- mustache -->
  <path d="M 13.5 22 Q 15 24 17.5 23 Q 19 23.5 20 23.2
           Q 21 23.5 22.5 23 Q 25 24 26.5 22
           Q 25 25 22.5 24.5 Q 20.5 24.2 20 24.2
           Q 19.5 24.2 17.5 24.5 Q 15 25 13.5 22 Z"
        fill="#3a2418"/>
  <!-- nose -->
  <path d="M 20 20 L 19 24 L 21 24 Z" fill="#946a45" opacity="0.55"/>
  <!-- eye patch on left eye -->
  <path d="M 11 17 L 18 16 L 18 20 L 11 19 Z" fill="#0a0a0a"/>
  <path d="M 11 17 L 7 14 M 18 17 L 22 14" stroke="#0a0a0a" stroke-width="0.7" fill="none"/>
  <!-- right eye -->
  <circle cx="24" cy="18.5" r="1.3" fill="#0a1628"/>
  <circle cx="24.4" cy="18.2" r="0.4" fill="#fff"/>
  <!-- right eyebrow -->
  <path d="M 22 16 Q 24 15 26 16.2" stroke="#2a1810" stroke-width="1.1" fill="none" stroke-linecap="round"/>
  <!-- scar on cheek -->
  <path d="M 27 21 L 28.5 25" stroke="#a85a3c" stroke-width="0.8" fill="none" stroke-linecap="round"/>
  <!-- captain cap -->
  <path d="M 7 14 Q 7 8 12 7 Q 20 4 28 7 Q 33 8 33 14 Z" fill="#0a1628" stroke="#020611" stroke-width="0.5"/>
  <!-- cap band -->
  <rect x="6" y="13" width="28" height="3" fill="#020611"/>
  <!-- cap brim shadow -->
  <ellipse cx="20" cy="16" rx="14" ry="1.3" fill="#000" opacity="0.5"/>
  <!-- gold anchor emblem -->
  <g transform="translate(20 10)" stroke="#fbbf24" stroke-width="0.8" fill="none" stroke-linecap="round">
    <circle r="0.8" fill="#fbbf24" stroke="none"/>
    <line x1="0" y1="0.5" x2="0" y2="4"/>
    <path d="M -2.2 3.5 Q 0 5 2.2 3.5"/>
    <line x1="-1.5" y1="1.5" x2="1.5" y2="1.5"/>
  </g>
</svg>`;

// ============================================================
// Audio engine (procedural — no external files needed)
// ============================================================
const audio = {
  ctx: null,
  muted: false,
  ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) this.ctx = new C();
    }
    // Browsers suspend the context until a user gesture; resume on demand
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  // Filtered white-noise burst — "water splash" for misses
  splash() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const dur = 0.45;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(2200, ctx.currentTime);
    lp.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    src.connect(lp).connect(g).connect(ctx.destination);
    src.start();
  },
  // Low-frequency boom + noise crack — "hit"
  hit() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t0 = ctx.currentTime;
    // Sub-bass thump
    const osc = ctx.createOscillator(); osc.type = "sine";
    osc.frequency.setValueAtTime(160, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.35);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
    osc.connect(og).connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + 0.42);
    // Noise crack on top
    const dur = 0.25;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.value = 1200; bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(bp).connect(ng).connect(ctx.destination);
    src.start(t0);
  },
  // Bigger explosion — ship sunk
  sunk() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    this.hit();
    const t0 = ctx.currentTime + 0.08;
    const osc = ctx.createOscillator(); osc.type = "triangle";
    osc.frequency.setValueAtTime(90, t0);
    osc.frequency.exponentialRampToValueAtTime(25, t0 + 0.7);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.55, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
    osc.connect(og).connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + 0.82);
  },
  // Soft confirmation blip — used on ship placement
  click() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = "square";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.1);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + 0.12);
  },
  // Triumphant chord — victory
  fanfare() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t0 = ctx.currentTime;
    const notes = [261.6, 329.6, 392.0, 523.2]; // C E G C
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "triangle";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + i * 0.12);
      g.gain.linearRampToValueAtTime(0.14, t0 + i * 0.12 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * 0.12); o.stop(t0 + 1.5);
    });
  },
  // Descending dirge — defeat
  dirge() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t0 = ctx.currentTime;
    const notes = [392, 329.6, 261.6, 196];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + i * 0.18);
      g.gain.linearRampToValueAtTime(0.1, t0 + i * 0.18 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.18 + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * 0.18); o.stop(t0 + i * 0.18 + 0.7);
    });
  },
};

// ============================================================
// Visual FX: projectiles + impacts
// ============================================================
const fx = {
  layer: null,
  init() { this.layer = document.getElementById("fxLayer"); },

  // Animate an arcing cannonball from one screen point to another.
  // Resolves on impact. Spawns a trail along the way.
  fire(fromX, fromY, toX, toY, { duration = 700 } = {}) {
    // Mark the document so CSS can show wait-state cursors and lock the
    // enemy board while a shell is in flight.
    document.body.classList.add("firing");
    return new Promise(resolve => {
      // Muzzle flash at origin
      const flash = document.createElement("div");
      flash.className = "muzzle-flash";
      flash.style.left = fromX + "px";
      flash.style.top  = fromY + "px";
      this.layer.appendChild(flash);
      setTimeout(() => flash.remove(), 320);

      // Projectile
      const proj = document.createElement("div");
      proj.className = "projectile";
      proj.style.left = "0px";
      proj.style.top  = "0px";
      this.layer.appendChild(proj);

      const dx = toX - fromX;
      const dy = toY - fromY;
      // Peak arc height scales with horizontal distance (always upward)
      const peakY = -Math.max(120, Math.min(260, Math.abs(dx) * 0.35));

      const start = performance.now();
      let lastTrailAt = 0;

      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        // Quadratic Bezier: P0=from, P1=(midX, fromY+peakY), P2=to
        const oneMinus = 1 - t;
        const midX = fromX + dx / 2;
        const midY = fromY + peakY;
        const x = oneMinus * oneMinus * fromX + 2 * oneMinus * t * midX + t * t * toX;
        const y = oneMinus * oneMinus * fromY + 2 * oneMinus * t * midY + t * t * toY;
        proj.style.transform = `translate(${x}px, ${y}px)`;

        // Drop a trail dot every ~25ms
        if (now - lastTrailAt > 25) {
          const trail = document.createElement("div");
          trail.className = "projectile-trail";
          trail.style.left = x + "px";
          trail.style.top  = y + "px";
          this.layer.appendChild(trail);
          setTimeout(() => trail.remove(), 560);
          lastTrailAt = now;
        }

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          proj.remove();
          document.body.classList.remove("firing");
          resolve({ x: toX, y: toY });
        }
      };
      requestAnimationFrame(step);
    });
  },

  splash(x, y) {
    const el = document.createElement("div");
    el.className = "impact-splash";
    el.style.left = x + "px";
    el.style.top  = y + "px";
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  },

  explosion(x, y) {
    const el = document.createElement("div");
    el.className = "impact-explosion";
    el.style.left = x + "px";
    el.style.top  = y + "px";
    // Core + shockwave + 8 sparks radiating outward
    el.innerHTML = `<div class="core"></div><div class="shock"></div>` +
      Array.from({length: 8}, (_, i) =>
        `<div class="spark" style="transform: translate(-50%,-50%) rotate(${i * 45}deg)"></div>`
      ).join("");
    this.layer.appendChild(el);
    // Screen shake on big hits
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 450);
    setTimeout(() => el.remove(), 900);
  },
};

// Resolve the screen-space center of a cell element
function cellCenter(boardId, r, c) {
  const board = document.getElementById(boardId);
  const cell = board.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  const rect = cell.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Resolve a firing-origin point: top edge of the firer's board, centered
function boardOrigin(boardId, side /* "left" | "right" */) {
  const board = document.getElementById(boardId);
  const rect = board.getBoundingClientRect();
  const y = rect.top + rect.height * 0.15;
  const x = side === "left" ? rect.right - 20 : rect.left + 20;
  return { x, y };
}

// ============================================================
// Screen state machine
// ============================================================
function setScreen(name) {
  document.body.classList.remove("screen-title", "screen-setup", "screen-battle");
  document.body.classList.add("screen-" + name);
}

// ============================================================
// State
// ============================================================
let phase = "setup";          // "setup" | "battle" | "over"
let busy = false;             // true while a projectile is in flight
let playerState, computerState;
let playerTurn = true;
let gameOver = false;
let stats = { shots: 0, hits: 0 };
let ai;
let lastPlayerShot = null;
let lastComputerShot = null;

// Setup state
let setupOrientation = "h";   // "h" | "v"
let selectedShipIdx = null;   // index into SHIPS not yet placed
let placedShipNames = new Set();

// ============================================================
// Board helpers
// ============================================================
function makeEmptyBoard() {
  const grid = [];
  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) row.push({ ship: null, hit: false });
    grid.push(row);
  }
  return grid;
}

function canPlace(grid, r, c, length, horizontal) {
  if (horizontal && c + length > SIZE) return false;
  if (!horizontal && r + length > SIZE) return false;
  for (let i = 0; i < length; i++) {
    const rr = horizontal ? r : r + i;
    const cc = horizontal ? c + i : c;
    if (grid[rr][cc].ship) return false;
  }
  return true;
}

function placeShip(grid, ships, def, r, c, horizontal) {
  const ship = {
    name: def.name, length: def.length, hits: 0,
    cells: [], horizontal, anchor: [r, c],
  };
  for (let i = 0; i < def.length; i++) {
    const rr = horizontal ? r : r + i;
    const cc = horizontal ? c + i : c;
    grid[rr][cc].ship = ship;
    ship.cells.push([rr, cc]);
  }
  ships.push(ship);
}

function placeShipsRandomly(grid) {
  const ships = [];
  for (const def of SHIPS) {
    for (let attempts = 0; attempts < 1000; attempts++) {
      const horizontal = Math.random() < 0.5;
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      if (canPlace(grid, r, c, def.length, horizontal)) {
        placeShip(grid, ships, def, r, c, horizontal);
        break;
      }
    }
  }
  return ships;
}

function makeRandomState() {
  const grid = makeEmptyBoard();
  const ships = placeShipsRandomly(grid);
  return { grid, ships };
}

// ============================================================
// Ship sprite rendering
// ============================================================
function renderShipLayer(layerId, state, { reveal }) {
  const layer = document.getElementById(layerId);
  layer.innerHTML = "";
  for (const ship of state.ships) {
    const sunk = ship.hits >= ship.length;
    // Hide enemy ships until sunk (unless reveal=true)
    if (!reveal && !sunk) continue;

    const sprite = makeShipSprite(ship);
    if (sunk) sprite.classList.add("sunk");
    layer.appendChild(sprite);
  }
}

function makeShipSprite(ship) {
  const [r, c] = ship.anchor;
  const L = ship.length;
  const horizontal = ship.horizontal;
  const div = document.createElement("div");
  div.className = "ship-sprite " + (horizontal ? "horizontal" : "vertical");

  const longPx = L * STRIDE - GAP;
  if (horizontal) {
    div.style.left = `${c * STRIDE}px`;
    div.style.top = `${r * STRIDE}px`;
    div.style.width = `${longPx}px`;
    div.style.height = `${CELL}px`;
    div.innerHTML = shipSvg(ship.name, L);
  } else {
    // container vertical bounding box
    div.style.left = `${c * STRIDE}px`;
    div.style.top = `${r * STRIDE}px`;
    div.style.width = `${CELL}px`;
    div.style.height = `${longPx}px`;
    // inner SVG sized horizontal, rotated 90deg
    const svg = `<div style="
      position:absolute;
      width:${longPx}px;
      height:${CELL}px;
      top:50%; left:50%;
      transform: translate(-50%,-50%) rotate(90deg);
    ">${shipSvg(ship.name, L)}</div>`;
    div.innerHTML = svg;
  }
  return div;
}

// Preview ghost used during setup
function renderPreview(r, c, length, horizontal, valid) {
  const layer = document.getElementById("playerPreview");
  layer.innerHTML = "";
  if (r == null) return;
  // Clamp so it stays in bounds for visual
  const fakeShip = {
    name: SHIPS[selectedShipIdx].name,
    length, horizontal, anchor: [r, c], cells: [], hits: 0,
  };
  const sprite = makeShipSprite(fakeShip);
  sprite.classList.add("preview", valid ? "valid" : "invalid");
  layer.appendChild(sprite);
}

function clearPreview() {
  const layer = document.getElementById("playerPreview");
  if (layer) layer.innerHTML = "";
}

// ============================================================
// Board / cell rendering
// ============================================================
function renderBoards() {
  renderBoard("playerBoard", playerState, { reveal: true, lastShot: lastComputerShot });
  renderBoard("computerBoard", computerState, { reveal: false, lastShot: lastPlayerShot });
  renderShipLayer("playerShipLayer", playerState, { reveal: true });
  renderShipLayer("computerShipLayer", computerState, { reveal: phase === "over" });
  renderRoster("playerRoster", playerState);
  renderRoster("computerRoster", computerState);
  document.getElementById("playerRemaining").textContent =
    `${playerState.ships.filter(s => s.hits < s.length).length} / ${playerState.ships.length} afloat`;
  document.getElementById("computerRemaining").textContent =
    `${computerState.ships.filter(s => s.hits < s.length).length} / ${computerState.ships.length} afloat`;
}

function renderBoard(elId, state, { reveal, lastShot }) {
  const el = document.getElementById(elId);
  el.innerHTML = "";
  el.classList.toggle(
    "disabled",
    elId === "computerBoard" && (phase !== "battle" || !playerTurn)
  );
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = state.grid[r][c];
      const div = document.createElement("div");
      div.className = "cell";
      div.dataset.r = r;
      div.dataset.c = c;

      if (cell.hit && cell.ship) {
        div.classList.add(cell.ship.hits >= cell.ship.length ? "sunk" : "hit");
      } else if (cell.hit) {
        div.classList.add("miss");
      }
      if (lastShot && lastShot[0] === r && lastShot[1] === c) {
        div.classList.add("last");
      }
      el.appendChild(div);
    }
  }
}

function renderRoster(elId, state) {
  const el = document.getElementById(elId);
  el.innerHTML = "";
  for (const ship of state.ships) {
    const row = document.createElement("div");
    row.className = "ship-row" + (ship.hits >= ship.length ? " sunk" : "");
    const name = document.createElement("span");
    name.className = "ship-name";
    name.textContent = `${ship.name} (${ship.length})`;
    const pips = document.createElement("span");
    pips.className = "ship-pips";
    for (let i = 0; i < ship.length; i++) {
      const p = document.createElement("span");
      p.className = "pip" + (i < ship.hits ? " gone" : "");
      pips.appendChild(p);
    }
    row.append(name, pips);
    el.appendChild(row);
  }
}

// ============================================================
// HUD, log, chat
// ============================================================
function setStatus(html) {
  document.getElementById("status").innerHTML = html;
}

function updateHud() {
  document.getElementById("turnIndicator").textContent =
    phase === "over" ? "—" : phase === "setup" ? "Setup" : (playerTurn ? "You" : "Enemy");
  document.getElementById("shotsCount").textContent = stats.shots;
  document.getElementById("hitsCount").textContent = stats.hits;
  document.getElementById("accuracy").textContent =
    stats.shots ? Math.round((stats.hits / stats.shots) * 100) + "%" : "—";
}

function log(who, text, extraClass = "") {
  const ul = document.getElementById("log");
  const li = document.createElement("li");
  li.className = `${who} ${extraClass}`.trim();
  // Pseudo-clock that advances with shots; gives the log a radar/operations feel
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  li.setAttribute("data-time", `${hh}:${mm}:${ss}`);
  li.innerHTML = `<span class="tag">${who === "you" ? "▸ YOU" : "◂ ENEMY"}</span> ${text}`;
  ul.prepend(li);
}

// ----- Chat (enemy "captain") -----
const CHAT = {
  start: [
    "Ahoy, Admiral. Hope you brought a life raft.",
    "My ships are bigger than yours. Probably.",
    "Let's see what you've got.",
    "Fire when ready. I won't be.",
  ],
  playerMiss: [
    "Haha, missed!",
    "Splash! Try aiming next time.",
    "Did you even look at the board?",
    "My sailors didn't even flinch.",
    "Was that on purpose?",
  ],
  playerHit: [
    "Ouch. Lucky shot.",
    "Hmm. Annoying.",
    "Don't get cocky.",
    "That stings a little.",
  ],
  playerSink: [
    "You sank my ship?! Outrageous.",
    "I liked that ship!",
    "Okay, that one hurt.",
    "Send help. (Don't, actually.)",
  ],
  enemyMiss: [
    "Recalibrating...",
    "Hmm, miscalculated.",
    "I meant to do that.",
  ],
  enemyHit: [
    "Bullseye!",
    "Got you!",
    "Tracking, locked, fired.",
    "Direct hit. You're welcome.",
  ],
  enemySink: [
    "Your ship sleeps with the fishes.",
    "Goodbye, vessel.",
    "Another one down!",
    "Should've placed it better.",
  ],
  playerWin: [
    "GG. You got lucky.",
    "Fine, fine — well played, Admiral.",
    "Rematch? I'll do better.",
  ],
  enemyWin: [
    "Victory is mine!",
    "Better luck next time, Admiral.",
    "Don't take it personally. Actually, do.",
  ],
};

function chatSay(category) {
  const pool = CHAT[category];
  if (!pool) return;
  const text = pool[Math.floor(Math.random() * pool.length)];
  showTyping().then(() => addChatMessage(text));
}

function showTyping() {
  return new Promise(resolve => {
    const ul = document.getElementById("chat");
    const li = document.createElement("li");
    li.className = "typing";
    li.innerHTML = `
      <div class="chat-avatar">${CAPTAIN_SVG}</div>
      <div class="chat-bubble">
        <span class="who">Cpt. Ironbeard</span>
        <span class="chat-typing"><span></span><span></span><span></span></span>
      </div>`;
    ul.appendChild(li);
    ul.scrollTop = ul.scrollHeight;
    setTimeout(() => {
      if (li.parentNode) li.remove();
      resolve();
    }, 600 + Math.random() * 500);
  });
}

function addChatMessage(text) {
  const ul = document.getElementById("chat");
  const li = document.createElement("li");
  li.innerHTML = `
    <div class="chat-avatar">${CAPTAIN_SVG}</div>
    <div class="chat-bubble">
      <span class="who">Cpt. Ironbeard</span>
      ${escapeHtml(text)}
    </div>`;
  ul.appendChild(li);
  ul.scrollTop = ul.scrollHeight;
}

// ----- Toast popups (sunk-ship announcements) -----
function showToast({ kind, icon, title, html }) {
  const wrap = document.getElementById("toasts");
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-text">${html}</div>
    </div>`;
  wrap.appendChild(t);
  // Auto-remove after the CSS exit animation finishes
  setTimeout(() => { if (t.parentNode) t.remove(); }, 5200);
}

function announceSink({ playerSunkEnemy, shipName }) {
  if (playerSunkEnemy) {
    const remaining = computerState.ships.filter(s => s.hits < s.length).length;
    showToast({
      kind: "win",
      icon: "💥",
      title: "Enemy Ship Down!",
      html: remaining
        ? `Their <strong>${shipName}</strong> is going under. <strong>${remaining}</strong> enemy ${remaining === 1 ? "ship" : "ships"} left.`
        : `Their <strong>${shipName}</strong> was the last one! Victory imminent.`,
    });
  } else {
    const remaining = playerState.ships.filter(s => s.hits < s.length).length;
    showToast({
      kind: "lose",
      icon: "☠️",
      title: "Your Ship Sunk!",
      html: remaining
        ? `Your <strong>${shipName}</strong> is lost. <strong>${remaining}</strong> ${remaining === 1 ? "ship stands" : "ships stand"} between you and defeat.`
        : `Your <strong>${shipName}</strong> was your last. The fleet is lost...`,
    });
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

// ============================================================
// Firing logic
// ============================================================
function fireAt(state, r, c) {
  const cell = state.grid[r][c];
  if (cell.hit) return { already: true };
  cell.hit = true;
  if (cell.ship) {
    cell.ship.hits++;
    const sunk = cell.ship.hits >= cell.ship.length;
    return { hit: true, sunk, ship: cell.ship };
  }
  return { hit: false };
}

function allSunk(state) {
  return state.ships.every(s => s.hits >= s.length);
}

async function playerFire(r, c) {
  if (phase !== "battle" || !playerTurn || gameOver || busy) return;
  // Reject already-hit cells without consuming a turn
  if (computerState.grid[r][c].hit) return;

  busy = true;
  // Pre-compute screen positions BEFORE any DOM updates
  const origin = boardOrigin("playerBoard", "left");
  const target = cellCenter("computerBoard", r, c);

  // Cannon fires!
  await fx.fire(origin.x, origin.y, target.x, target.y);

  // Apply hit/miss
  const res = fireAt(computerState, r, c);
  lastPlayerShot = [r, c];
  stats.shots++;
  if (res.hit) stats.hits++;

  // Visual + audio impact
  if (res.hit) {
    fx.explosion(target.x, target.y);
    if (res.sunk) audio.sunk(); else audio.hit();
  } else {
    fx.splash(target.x, target.y);
    audio.splash();
  }

  const cName = coord(r, c);
  if (res.hit) {
    if (res.sunk) {
      log("you", `${cName} — SUNK enemy ${res.ship.name}!`, "sunk");
      setStatus(`<span class="accent">Direct hit!</span> You sunk the enemy ${res.ship.name}.`);
      chatSay("playerSink");
      announceSink({ playerSunkEnemy: true, shipName: res.ship.name });
    } else {
      log("you", `${cName} — Hit`);
      setStatus(`<span class="accent">Hit!</span> Enemy is responding...`);
      chatSay("playerHit");
    }
  } else {
    log("you", `${cName} — Miss`);
    setStatus(`<span class="accent">Miss</span> at ${cName}. Enemy is targeting...`);
    chatSay("playerMiss");
  }

  if (allSunk(computerState)) {
    renderBoards(); updateHud();
    busy = false;
    endGame(true);
    return;
  }
  playerTurn = false;
  document.body.classList.remove("player-turn");
  document.body.classList.remove("first-shot");
  renderBoards(); updateHud();
  busy = false;
  setTimeout(computerFire, 900);
}

// ============================================================
// Computer AI (hunt / target)
// ============================================================
function makeAi() {
  return { mode: "hunt", targetQueue: [], hits: [], orientation: null };
}

async function computerFire() {
  if (gameOver) return;
  busy = true;
  const [r, c] = chooseAiShot();

  // Pre-compute screen positions
  const origin = boardOrigin("computerBoard", "right");
  const target = cellCenter("playerBoard", r, c);

  await fx.fire(origin.x, origin.y, target.x, target.y);

  const res = fireAt(playerState, r, c);
  lastComputerShot = [r, c];

  if (res.hit) {
    fx.explosion(target.x, target.y);
    if (res.sunk) audio.sunk(); else audio.hit();
  } else {
    fx.splash(target.x, target.y);
    audio.splash();
  }

  const cName = coord(r, c);
  if (res.hit) {
    if (res.sunk) {
      log("enemy", `${cName} — SUNK your ${res.ship.name}!`, "sunk");
      setStatus(`<span class="accent">Enemy sunk your ${res.ship.name}!</span>`);
      chatSay("enemySink");
      announceSink({ playerSunkEnemy: false, shipName: res.ship.name });
      ai = makeAi();
    } else {
      log("enemy", `${cName} — Hit`);
      setStatus(`<span class="accent">Enemy hit your ${res.ship.name}!</span>`);
      chatSay("enemyHit");
      ai.mode = "target";
      ai.hits.push([r, c]);
      updateAiAfterHit(r, c);
    }
  } else {
    log("enemy", `${cName} — Miss`);
    setStatus(`<span class="accent">Enemy missed</span> at ${cName}. Your turn — fire!`);
    chatSay("enemyMiss");
  }

  if (allSunk(playerState)) {
    renderBoards(); updateHud();
    busy = false;
    endGame(false);
    return;
  }
  playerTurn = true;
  document.body.classList.add("player-turn");
  renderBoards(); updateHud();
  busy = false;
}

function chooseAiShot() {
  while (ai.targetQueue.length) {
    const [r, c] = ai.targetQueue.shift();
    if (inBounds(r, c) && !playerState.grid[r][c].hit) return [r, c];
  }
  const choices = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (playerState.grid[r][c].hit) continue;
      if ((r + c) % 2 === 0) choices.push([r, c]);
    }
  }
  if (!choices.length) {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!playerState.grid[r][c].hit) choices.push([r, c]);
  }
  return choices[Math.floor(Math.random() * choices.length)];
}

function updateAiAfterHit(r, c) {
  if (ai.hits.length >= 2) {
    const [r0, c0] = ai.hits[0];
    ai.orientation = (r0 === r) ? "h" : "v";
    ai.targetQueue = [];
    const rows = ai.hits.map(h => h[0]);
    const cols = ai.hits.map(h => h[1]);
    if (ai.orientation === "h") {
      const minC = Math.min(...cols), maxC = Math.max(...cols);
      ai.targetQueue.push([r0, minC - 1], [r0, maxC + 1]);
    } else {
      const minR = Math.min(...rows), maxR = Math.max(...rows);
      ai.targetQueue.push([minR - 1, c0], [maxR + 1, c0]);
    }
  } else {
    ai.targetQueue.push([r-1, c], [r+1, c], [r, c-1], [r, c+1]);
    shuffle(ai.targetQueue);
  }
}

function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

// ============================================================
// End-of-game
// ============================================================
function endGame(playerWon) {
  gameOver = true;
  phase = "over";
  document.body.classList.remove("player-turn");
  renderBoards(); updateHud();
  if (playerWon) audio.fanfare(); else audio.dirge();
  chatSay(playerWon ? "playerWin" : "enemyWin");
  const ov = document.getElementById("overlay");
  const card = ov.querySelector(".overlay-card");
  card.classList.toggle("win",  playerWon);
  card.classList.toggle("lose", !playerWon);
  document.getElementById("overlayTitle").textContent = playerWon ? "VICTORY" : "DEFEAT";
  document.getElementById("overlayTitle").className = playerWon ? "win" : "lose";

  // Build a richer stats block instead of a single sentence
  const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
  const sunkByYou = computerState.ships.filter(s => s.hits >= s.length).length;
  const sunkByEnemy = playerState.ships.filter(s => s.hits >= s.length).length;
  document.getElementById("overlayText").innerHTML = `
    <span class="ov-line">${playerWon
      ? "You sank the enemy fleet, Admiral."
      : "Your fleet was lost to the depths."}</span>
    <div class="ov-stats">
      <div><span class="k">SHOTS</span><span class="v">${stats.shots}</span></div>
      <div><span class="k">HITS</span><span class="v">${stats.hits}</span></div>
      <div><span class="k">ACCURACY</span><span class="v">${acc}%</span></div>
      <div><span class="k">ENEMY SUNK</span><span class="v">${sunkByYou} / 5</span></div>
      <div><span class="k">FLEET LOST</span><span class="v">${sunkByEnemy} / 5</span></div>
    </div>
  `;
  setTimeout(() => ov.classList.remove("hidden"), 800);
}

// ============================================================
// Setup phase
// ============================================================
function renderShipPicker() {
  // Auto-advance selection BEFORE rendering chips so highlight is correct
  if (selectedShipIdx === null || placedShipNames.has(SHIPS[selectedShipIdx].name)) {
    const next = SHIPS.findIndex(s => !placedShipNames.has(s.name));
    selectedShipIdx = next === -1 ? null : next;
  }
  const el = document.getElementById("shipPicker");
  el.innerHTML = "";
  SHIPS.forEach((def, idx) => {
    const placed = placedShipNames.has(def.name);
    const chip = document.createElement("div");
    chip.className = "ship-chip"
      + (placed ? " placed" : "")
      + (selectedShipIdx === idx ? " selected" : "");
    chip.innerHTML = `
      <span class="ship-chip-name">${def.name.toUpperCase()}</span>
      <span class="ship-chip-icon">${chipSvg(def.name, def.length)}</span>
      <span class="ship-chip-len">□ ${def.length} CELLS</span>
    `;
    if (!placed) {
      chip.addEventListener("click", () => {
        selectedShipIdx = idx;
        renderShipPicker();
      });
    }
    el.appendChild(chip);
  });
  document.getElementById("startBtn").disabled = placedShipNames.size !== SHIPS.length;
}

function setOrientation(o) {
  setupOrientation = o;
  document.getElementById("orientLabel").textContent = o === "h" ? "Horizontal" : "Vertical";
  document.getElementById("orientIcon").textContent = o === "h" ? "↔" : "↕";
}

function toggleOrientation() {
  setOrientation(setupOrientation === "h" ? "v" : "h");
}

function attachSetupListeners() {
  const board = document.getElementById("playerBoard");
  board.addEventListener("mousemove", onSetupHover);
  board.addEventListener("mouseleave", () => clearPreview());
  board.addEventListener("click", onSetupClick);

  document.addEventListener("keydown", e => {
    if (phase !== "setup") return;
    if (e.key === "r" || e.key === "R") toggleOrientation();
  });
  document.getElementById("rotateBtn").addEventListener("click", toggleOrientation);
  document.getElementById("randomBtn").addEventListener("click", autoPlaceRemaining);
  document.getElementById("clearBtn").addEventListener("click", clearPlayerFleet);
  document.getElementById("startBtn").addEventListener("click", startBattle);
}

function getCellFromEvent(e) {
  const target = e.target.closest(".cell");
  if (!target) return null;
  return [parseInt(target.dataset.r), parseInt(target.dataset.c)];
}

function onSetupHover(e) {
  if (phase !== "setup" || selectedShipIdx === null) return;
  const rc = getCellFromEvent(e);
  if (!rc) return clearPreview();
  const [r, c] = rc;
  const def = SHIPS[selectedShipIdx];
  const horizontal = setupOrientation === "h";
  const valid = canPlace(playerState.grid, r, c, def.length, horizontal);
  renderPreview(r, c, def.length, horizontal, valid);
}

function onSetupClick(e) {
  if (phase !== "setup" || selectedShipIdx === null) return;
  const rc = getCellFromEvent(e);
  if (!rc) return;
  const [r, c] = rc;
  const def = SHIPS[selectedShipIdx];
  const horizontal = setupOrientation === "h";
  if (!canPlace(playerState.grid, r, c, def.length, horizontal)) return;
  placeShip(playerState.grid, playerState.ships, def, r, c, horizontal);
  placedShipNames.add(def.name);
  audio.click();
  clearPreview();
  renderBoards();
  renderShipPicker();
}

function autoPlaceRemaining() {
  for (const def of SHIPS) {
    if (placedShipNames.has(def.name)) continue;
    for (let attempts = 0; attempts < 1000; attempts++) {
      const horizontal = Math.random() < 0.5;
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      if (canPlace(playerState.grid, r, c, def.length, horizontal)) {
        placeShip(playerState.grid, playerState.ships, def, r, c, horizontal);
        placedShipNames.add(def.name);
        break;
      }
    }
  }
  renderBoards();
  renderShipPicker();
}

function clearPlayerFleet() {
  playerState = { grid: makeEmptyBoard(), ships: [] };
  placedShipNames.clear();
  selectedShipIdx = 0;
  clearPreview();
  renderBoards();
  renderShipPicker();
}

function startBattle() {
  if (placedShipNames.size !== SHIPS.length) return;
  phase = "battle";
  setScreen("battle");
  document.body.classList.add("player-turn");
  document.body.classList.add("first-shot");
  document.getElementById("setupPanel").classList.add("hidden");
  document.getElementById("enemyLock").classList.add("hidden");
  setStatus(`Battle begins. <span class="accent">Your turn</span> — click enemy waters to fire.`);
  chatSay("start");
  renderBoards();
  updateHud();
}

// ============================================================
// Reset / init
// ============================================================
function resetAll({ keepScreen = false } = {}) {
  phase = "setup";
  busy = false;
  document.body.classList.remove("firing", "player-turn", "first-shot");
  playerState = { grid: makeEmptyBoard(), ships: [] };
  computerState = makeRandomState();
  playerTurn = true;
  gameOver = false;
  stats = { shots: 0, hits: 0 };
  ai = makeAi();
  lastPlayerShot = null;
  lastComputerShot = null;
  placedShipNames = new Set();
  selectedShipIdx = 0;
  setOrientation("h");

  document.getElementById("setupPanel").classList.remove("hidden");
  document.getElementById("enemyLock").classList.remove("hidden");
  document.getElementById("overlay").classList.add("hidden");
  document.getElementById("log").innerHTML = "";
  document.getElementById("chat").innerHTML = "";
  document.getElementById("toasts").innerHTML = "";
  document.getElementById("fxLayer").innerHTML = "";

  setStatus("Deploy your fleet, Admiral. Click a ship, then click your board to place it.");
  renderShipPicker();
  renderBoards();
  updateHud();
  if (!keepScreen) setScreen("title");
}

function startSetup() {
  setScreen("setup");
}

// Event delegation for firing during battle (more reliable than per-cell listeners)
document.addEventListener("click", e => {
  if (phase !== "battle" || !playerTurn || gameOver) return;
  const board = e.target.closest("#computerBoard");
  if (!board) return;
  const rc = getCellFromEvent(e);
  if (rc) playerFire(rc[0], rc[1]);
});

document.getElementById("resetBtn").addEventListener("click", () => resetAll());
document.getElementById("overlayBtn").addEventListener("click", () => resetAll());
document.getElementById("titleStartBtn").addEventListener("click", () => {
  audio.click();
  startSetup();
});

// Mute toggle
document.getElementById("muteBtn").addEventListener("click", () => {
  audio.muted = !audio.muted;
  const btn = document.getElementById("muteBtn");
  document.getElementById("muteIcon").textContent = audio.muted ? "🔇" : "🔊";
  btn.classList.toggle("muted", audio.muted);
  btn.title = audio.muted ? "Unmute audio" : "Mute audio";
  if (!audio.muted) audio.click(); // give feedback that audio is back
});

// Lazy-init AudioContext on first user gesture (browser policy)
document.addEventListener("click", () => audio.ensure(), { once: true });
document.addEventListener("keydown", () => audio.ensure(), { once: true });

fx.init();
attachSetupListeners();
resetAll();
