"use strict";

const ROWS = 4;
const COLS = 6;
const CELL = 80;
const OX = 60;
const OY = 60;
const LIVES = 3;
const MOVE_TIME = 0.12;
const PUSH_TIME = 0.16;
const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const KEYS = {
  ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R",
  w: "U", s: "D", a: "L", d: "R", W: "U", S: "D", A: "L", D: "R",
};
const COLORS = {
  bg1: "#141a33",
  bg2: "#232c55",
  floor: "#2b3460",
  mortar: "#222a50",
  ghost: "rgba(255, 255, 255, 0.05)",
  wall: "#f2a541",
  wallTop: "#ffd28a",
  wallShadow: "rgba(0, 0, 0, 0.35)",
  text: "#f4f1e8",
};

const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");
const ui = {
  level: document.getElementById("level"),
  total: document.getElementById("total"),
  time: document.getElementById("time"),
  score: document.getElementById("score"),
  lives: document.getElementById("lives"),
  message: document.getElementById("message"),
};

const levels = window.LEVELS || [];
const params = new URLSearchParams(location.search);
// ?test enables the test mode: no timer, level navigation (N/B) and editing (E).
const TEST_MODE = params.has("test");
const game = {
  state: "title",
  index: 0,
  score: 0,
  lives: LIVES,
  walls: new Set(),
  player: [0, 0],
  bombs: [],
  defusedAt: null,
  timeLeft: 0,
  stateTime: 0,
};

// Purely visual state; never affects the game rules.
const fx = {
  from: [0, 0],
  to: [0, 0],
  moveT: 1,
  dir: "D",
  steps: 0,
  bump: null,
  pushes: [],
  particles: [],
  floaters: [],
  shake: 0,
  flash: 0,
  intro: 0,
};

const ease = (t) => 1 - (1 - t) ** 3;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;

function edgeKey(r, c, dr, dc) {
  if (dr === -1) return `h${r}${c}`;
  if (dr === 1) return `h${r + 1}${c}`;
  if (dc === -1) return `v${r}${c}`;
  return `v${r}${c + 1}`;
}

function isBoundary(key) {
  return (key[0] === "h" && (key[1] === "0" || key[1] === "4")) ||
         (key[0] === "v" && (key[2] === "0" || key[2] === "6"));
}

function loadLevel(i) {
  const lv = levels[i];
  const fix = loadFixes()[lv.source] || {};
  game.index = i;
  game.walls = new Set(fix.walls || lv.walls);
  game.player = [...(fix.start || lv.start)];
  game.bombs = [...(fix.bombs || lv.bombs)];
  game.defusedAt = null;
  game.timeLeft = lv.time;
  const p = cellCenter(game.player);
  Object.assign(fx, { from: p, to: p, moveT: 1, bump: null, pushes: [], floaters: [], intro: 0 });
  if (typeof lv.source !== "number") {
    setState("playing", `Level ${lv.id} \u2014 uit je Godot-versie`);
    return;
  }
  const m = Math.floor(lv.source / 60);
  const s = String(Math.floor(lv.source % 60)).padStart(2, "0");
  setState("playing", `Level ${lv.id} \u2014 in de video op ${m}:${s}`);
}

function setState(state, message = "") {
  game.state = state;
  game.stateTime = 0;
  ui.message.textContent = message;
}

function playerPx() {
  const t = ease(clamp01(fx.moveT));
  let x = lerp(fx.from[0], fx.to[0], t);
  let y = lerp(fx.from[1], fx.to[1], t);
  if (fx.bump) {
    const k = Math.sin(clamp01(fx.bump.t) * Math.PI) * 7;
    x += fx.bump.dx * k;
    y += fx.bump.dy * k;
  }
  return [x, y];
}

function walkTo(px, dir) {
  fx.from = playerPx();
  fx.to = px;
  fx.moveT = 0;
  fx.dir = dir;
  fx.steps += 1;
  fx.bump = null;
}

function move(dir) {
  if (game.state !== "playing") return;
  const [dr, dc] = DIRS[dir];
  const [r, c] = game.player;
  const nr = r + dr;
  const nc = c + dc;
  const key = edgeKey(r, c, dr, dc);
  fx.dir = dir;
  if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
    // Bombs lie outside the maze in an opening of the outer wall.
    if (!game.walls.has(key) && game.bombs.includes(key)) defuse(key, dir);
    else bump(dr, dc);
    return;
  }
  if (game.walls.has(key)) {
    // A wall can only be pushed one cell further if nothing blocks it there.
    const far = edgeKey(nr, nc, dr, dc);
    if (isBoundary(key) || game.walls.has(far)) {
      bump(dr, dc);
      return;
    }
    game.walls.delete(key);
    game.walls.add(far);
    fx.pushes.push({ from: key, to: far, t: 0 });
    const [x1, y1, x2, y2] = segmentLine(far);
    dust((x1 + x2) / 2, (y1 + y2) / 2, 10);
  }
  game.player = [nr, nc];
  walkTo(cellCenter(game.player), dir);
}

function bump(dy, dx) {
  fx.bump = { dx, dy, t: 0 };
}

function defuse(key, dir) {
  const bonus = Math.ceil(game.timeLeft) * 10;
  game.score += 100 + bonus;
  game.defusedAt = key;
  walkTo(bombPos(key), dir);
  const [x, y] = bombPos(key);
  confetti(x, y);
  fx.floaters.push({ x, y: y - 20, text: `+${100 + bonus}`, t: 0 });
  localStorage.setItem("bombsweeper.best", Math.max(game.index + 2, bestLevel()));
  setState("defused", `Bom onschadelijk! +${100 + bonus}`);
}

function explode() {
  fx.shake = 16;
  fx.flash = 1;
  for (const key of game.bombs) {
    const [x, y] = bombPos(key);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 260;
      fx.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 120,
        life: 0.6 + Math.random() * 0.6, age: 0, size: 3 + Math.random() * 5,
        color: ["#ffdd57", "#ff8c42", "#ff5233", "#ffffff"][i % 4],
      });
    }
  }
}

function confetti(x, y) {
  for (let i = 0; i < 36; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const v = 120 + Math.random() * 220;
    fx.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 420,
      life: 0.8 + Math.random() * 0.5, age: 0, size: 3 + Math.random() * 3, square: true,
      color: ["#7bed9f", "#70a1ff", "#ffd32a", "#ff6b81"][i % 4],
    });
  }
}

function dust(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 20 + Math.random() * 60;
    fx.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0,
      life: 0.35 + Math.random() * 0.25, age: 0, size: 2 + Math.random() * 3, color: "#ffd28a",
    });
  }
}

function sparks(dt) {
  if (game.state !== "playing" && game.state !== "title") return;
  const keys = game.state === "title" ? [] : game.bombs;
  for (const key of keys) {
    if (Math.random() > dt * 30) continue;
    const [x, y] = bombPos(key);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2;
    fx.particles.push({
      x: x + 12, y: y - 20, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, g: 160,
      life: 0.3 + Math.random() * 0.3, age: 0, size: 1.5 + Math.random() * 1.5,
      color: Math.random() < 0.5 ? "#ffdd57" : "#ff8c42",
    });
  }
}

function bestLevel() {
  return Number(localStorage.getItem("bombsweeper.best")) || 1;
}

function startGame() {
  game.score = 0;
  game.lives = LIVES;
  const requested = Number(params.get("level") || location.hash.slice(1)) - 1;
  loadLevel(requested >= 0 && requested < levels.length ? requested : 0);
}

function updateFx(dt) {
  fx.moveT += dt / MOVE_TIME;
  fx.intro += dt;
  if (fx.bump) {
    fx.bump.t += dt / 0.15;
    if (fx.bump.t >= 1) fx.bump = null;
  }
  for (const p of fx.pushes) p.t += dt / PUSH_TIME;
  fx.pushes = fx.pushes.filter((p) => p.t < 1);
  for (const p of fx.particles) {
    p.age += dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  fx.particles = fx.particles.filter((p) => p.age < p.life);
  for (const f of fx.floaters) f.t += dt;
  fx.floaters = fx.floaters.filter((f) => f.t < 1.2);
  fx.shake *= Math.exp(-dt * 8);
  fx.flash = Math.max(0, fx.flash - dt * 2.5);
  sparks(dt);
}

function update(dt) {
  game.stateTime += dt;
  updateFx(dt);
  if (game.state === "playing" && !TEST_MODE) {
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) {
      game.timeLeft = 0;
      game.lives -= 1;
      explode();
      setState("exploded", game.lives > 0 ? "BOEM! Probeer opnieuw." : "BOEM! Game over.");
    }
  } else if (game.state === "defused" && game.stateTime > 1.3) {
    if (game.index + 1 < levels.length) loadLevel(game.index + 1);
    else setState("finished", "Alle bommen onschadelijk gemaakt! Druk op Enter.");
  } else if (game.state === "exploded" && game.stateTime > 1.8) {
    if (game.lives > 0) loadLevel(game.index);
    else setState("gameover", "Game over. Druk op Enter om opnieuw te beginnen.");
  }
  ui.level.textContent = game.index + 1;
  ui.total.textContent = levels.length;
  ui.time.textContent = TEST_MODE ? "\u221e" : Math.ceil(game.timeLeft);
  ui.score.textContent = game.score;
  ui.lives.textContent = "\u2665".repeat(Math.max(0, game.lives)) || "0";
}

// --- Drawing ---

function segmentLine(key) {
  const kind = key[0];
  const r = Number(key[1]);
  const c = Number(key[2]);
  const x = OX + c * CELL;
  const y = OY + r * CELL;
  return kind === "h" ? [x + 7, y, x + CELL - 7, y] : [x, y + 7, x, y + CELL - 7];
}

function allSegments() {
  const keys = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c < COLS; c++) keys.push(`h${r}${c}`);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS; c++) keys.push(`v${r}${c}`);
  return keys;
}
const SEGMENTS = allSegments();

function cellCenter([r, c]) {
  return [OX + c * CELL + CELL / 2, OY + r * CELL + CELL / 2];
}

function bombPos(key) {
  const r = Number(key[1]);
  const c = Number(key[2]);
  if (key[0] === "h") return [OX + c * CELL + CELL / 2, OY + r * CELL + (r === 0 ? -32 : 32)];
  return [OX + c * CELL + (c === 0 ? -32 : 32), OY + r * CELL + CELL / 2];
}

const floorLayer = (() => {
  const layer = document.createElement("canvas");
  layer.width = canvas.width;
  layer.height = canvas.height;
  const g = layer.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, layer.height);
  grad.addColorStop(0, COLORS.bg1);
  grad.addColorStop(1, COLORS.bg2);
  g.fillStyle = grad;
  g.fillRect(0, 0, layer.width, layer.height);
  g.fillStyle = COLORS.floor;
  g.fillRect(OX, OY, COLS * CELL, ROWS * CELL);
  g.strokeStyle = COLORS.mortar;
  g.lineWidth = 2;
  const bh = CELL / 4;
  for (let row = 0; row * bh < ROWS * CELL; row++) {
    const y = OY + row * bh;
    g.beginPath();
    g.moveTo(OX, y);
    g.lineTo(OX + COLS * CELL, y);
    g.stroke();
    for (let x = OX + (row % 2 ? CELL / 4 : 0); x < OX + COLS * CELL; x += CELL / 2) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + bh);
      g.stroke();
    }
  }
  const vignette = g.createRadialGradient(300, 220, 120, 300, 220, 380);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = vignette;
  g.fillRect(0, 0, layer.width, layer.height);
  return layer;
})();

function drawBar(x1, y1, x2, y2, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.strokeStyle = COLORS.wallShadow;
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(x1 + 2, y1 + 4);
  ctx.lineTo(x2 + 2, y2 + 4);
  ctx.stroke();
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = COLORS.wallTop;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1 - 2.5);
  ctx.lineTo(x2, y2 - 2.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawWalls() {
  const moving = new Map(fx.pushes.map((p) => [p.to, p]));
  let i = 0;
  for (const key of game.walls) {
    const [x1, y1, x2, y2] = segmentLine(key);
    const appear = clamp01((fx.intro - i++ * 0.012) / 0.25);
    const drop = (1 - ease(appear)) * -14;
    const push = moving.get(key);
    if (push) {
      const [a1, b1, a2, b2] = segmentLine(push.from);
      const t = ease(clamp01(push.t));
      drawBar(lerp(a1, x1, t), lerp(b1, y1, t), lerp(a2, x2, t), lerp(b2, y2, t));
    } else {
      drawBar(x1, y1 + drop, x2, y2 + drop, appear);
    }
  }
}

function drawBomb(key, t) {
  const [x, y] = bombPos(key);
  drawBombAt(x, y, t);
}

function drawBombAt(x, y, t) {
  const lv = levels[game.index];
  const urgent = !TEST_MODE && game.state === "playing" && game.timeLeft < 5;
  const pulse = urgent ? 1 + Math.sin(t * 18) * 0.08 : 1 + Math.sin(t * 4) * 0.03;
  const wobble = urgent ? Math.sin(t * 40) * 1.5 : 0;
  ctx.save();
  ctx.translate(x + wobble, y + 4);
  ctx.scale(pulse * 0.8, pulse * 0.8);

  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
  glow.addColorStop(0, urgent ? "rgba(255,80,60,0.45)" : "rgba(255,180,80,0.25)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(-6, -6, 2, 0, 0, 20);
  body.addColorStop(0, "#5a5f73");
  body.addColorStop(1, "#111");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.fillRect(-6, -22, 12, 7);

  // Fuse gets shorter as the timer runs down.
  const left = TEST_MODE || !lv || game.state === "title" ? 1 : clamp01(game.timeLeft / lv.time);
  ctx.strokeStyle = "#c9a26b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.quadraticCurveTo(4, -22 - 12 * left, 6 + 10 * left, -22 - 10 * left);
  ctx.stroke();
  const tip = [6 + 10 * left, -22 - 10 * left];
  const flick = 4 + Math.random() * 3;
  const spark = ctx.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], flick * 2);
  spark.addColorStop(0, "#fff7c2");
  spark.addColorStop(0.5, "#ffb347");
  spark.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = spark;
  ctx.beginPath();
  ctx.arc(tip[0], tip[1], flick * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-7, -7, 5, 3, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(t) {
  const [x, y] = playerPx();
  const walking = fx.moveT < 1;
  const swing = walking ? Math.sin(clamp01(fx.moveT) * Math.PI) * (fx.steps % 2 ? 1 : -1) : 0;
  const bob = walking ? -Math.abs(Math.sin(clamp01(fx.moveT) * Math.PI)) * 4 : Math.sin(t * 3) * 1;
  const happy = game.state === "defused" || game.state === "finished";
  const jump = happy ? -Math.abs(Math.sin(game.stateTime * 9)) * 10 : 0;
  const [ex, ey] = { U: [0, -2], D: [0, 1], L: [-3, 0], R: [3, 0] }[fx.dir];

  ctx.save();
  ctx.translate(x, y + bob + jump);

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 26 - bob - jump, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1e3799";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 10);
  ctx.lineTo(-5 - swing * 6, 24);
  ctx.moveTo(5, 10);
  ctx.lineTo(5 + swing * 6, 24);
  ctx.stroke();

  ctx.fillStyle = "#4a69bd";
  ctx.beginPath();
  ctx.roundRect(-12, -6, 24, 20, 7);
  ctx.fill();
  ctx.fillStyle = "#f6b93b";
  ctx.fillRect(-12, 4, 24, 3);

  ctx.strokeStyle = "#f8c291";
  ctx.lineWidth = 5;
  ctx.beginPath();
  const arm = happy ? -14 : swing * 5;
  ctx.moveTo(-12, 0);
  ctx.lineTo(-17, 8 + arm);
  ctx.moveTo(12, 0);
  ctx.lineTo(17, 8 + (happy ? -14 : -swing * 5));
  ctx.stroke();

  ctx.fillStyle = "#f8c291";
  ctx.beginPath();
  ctx.arc(0, -16, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  if (fx.dir !== "U") {
    ctx.beginPath();
    ctx.arc(-3.5 + ex, -16 + ey, 1.8, 0, Math.PI * 2);
    ctx.arc(3.5 + ex, -16 + ey, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#fbc531";
  ctx.beginPath();
  ctx.arc(0, -19, 11, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-13, -20, 26, 3);
  ctx.restore();
}

function drawParticles() {
  for (const p of fx.particles) {
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = p.color;
    if (p.square) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.age * 10);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - p.age / p.life / 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.font = "bold 22px system-ui, sans-serif";
  for (const f of fx.floaters) {
    ctx.globalAlpha = 1 - f.t / 1.2;
    ctx.fillStyle = "#7bed9f";
    ctx.fillText(f.text, f.x, f.y - f.t * 40);
  }
  ctx.globalAlpha = 1;
}

function drawTimerBar(t) {
  const lv = levels[game.index];
  if (TEST_MODE || !lv || !["playing", "paused"].includes(game.state)) return;
  const frac = clamp01(game.timeLeft / lv.time);
  const x = OX;
  const y = canvas.height - 18;
  const w = COLS * CELL;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, 8, 4);
  ctx.fill();
  const hue = frac * 120;
  const blink = frac < 0.2 ? 0.6 + Math.sin(t * 16) * 0.4 : 1;
  ctx.fillStyle = `hsla(${hue}, 80%, 55%, ${blink})`;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(8, w * frac), 8, 4);
  ctx.fill();
}

function drawPanel(lines) {
  ctx.fillStyle = "rgba(10, 12, 30, 0.7)";
  ctx.beginPath();
  ctx.roundRect(110, 150, 380, 40 + lines.length * 40, 16);
  ctx.fill();
  ctx.textAlign = "center";
  lines.forEach(([text, size, color], i) => {
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.fillStyle = color || COLORS.text;
    ctx.fillText(text, canvas.width / 2, 195 + i * 40);
  });
}

function drawTitle(t) {
  const bounce = Math.abs(Math.sin(t * 2.5)) * -24;
  ctx.save();
  ctx.translate(300, 150 + bounce);
  ctx.scale(1.8, 1.8);
  drawBombAt(0, 0, t);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "900 46px system-ui, sans-serif";
  ctx.fillStyle = "#ff6b6b";
  ctx.fillText("BOMB SWEEPER", 302, 258);
  ctx.fillStyle = COLORS.text;
  ctx.fillText("BOMB SWEEPER", 300, 255);
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillStyle = "rgba(244,241,232,0.7)";
  ctx.fillText(`${levels.length} levels`, 300, 290);
  ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.4;
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.fillStyle = COLORS.text;
  ctx.fillText("Druk op Enter", 300, 340);
  ctx.globalAlpha = 1;
}

function draw(t) {
  ctx.save();
  if (fx.shake > 0.3) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  ctx.drawImage(floorLayer, 0, 0);
  ctx.fillStyle = COLORS.ghost;
  for (const key of SEGMENTS) {
    const [x1, y1, x2, y2] = segmentLine(key);
    ctx.beginPath();
    ctx.arc((x1 + x2) / 2, (y1 + y2) / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (game.state === "title") {
    drawTitle(t);
    ctx.restore();
    return;
  }
  drawWalls();
  game.bombs.forEach((key) => {
    if (key !== game.defusedAt) drawBomb(key, t);
  });
  if (game.state !== "exploded" || game.stateTime < 0.1) drawPlayer(t);
  drawParticles();
  drawTimerBar(t);
  if (game.state === "edit") {
    ctx.fillStyle = "#ff6b6b";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(loadFixes()[levels[game.index].source]?.skip ? "BEWERKEN (OVERSLAAN)" : "BEWERKEN", 10, 22);
  }
  if (game.state === "playing" && fx.intro < 1.2) {
    ctx.globalAlpha = clamp01(1.2 - fx.intro);
    ctx.textAlign = "center";
    ctx.font = "900 40px system-ui, sans-serif";
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`LEVEL ${game.index + 1}`, 300, 228 - fx.intro * 20);
    ctx.globalAlpha = 1;
  }
  if (game.state === "paused") drawPanel([["PAUZE", 36], ["Druk op P", 18]]);
  if (game.state === "gameover") drawPanel([["GAME OVER", 36, "#ff6b6b"], [`Score ${game.score}`, 20], ["Druk op Enter", 18]]);
  if (game.state === "finished") drawPanel([["GEWONNEN!", 36, "#7bed9f"], [`Score ${game.score}`, 20], ["Druk op Enter", 18]]);
  ctx.restore();
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255, 240, 200, ${fx.flash * 0.8})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// --- Input ---

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "TEXTAREA") return;
  if ((e.key === "e" || e.key === "E") && TEST_MODE && ["playing", "edit"].includes(game.state)) {
    toggleEdit();
  } else if (TEST_MODE && ["playing", "edit", "defused"].includes(game.state) && "nNbB".includes(e.key)) {
    const step = e.key.toLowerCase() === "n" ? 1 : -1;
    if (game.state === "edit") gotoLevel(game.index + step);
    else if (levels[game.index + step]) loadLevel(game.index + step);
  } else if (game.state === "edit") {
    if (e.key === "x" || e.key === "X") toggleSkip();
  } else if (KEYS[e.key]) {
    e.preventDefault();
    move(KEYS[e.key]);
  } else if (e.key === "Enter" && ["title", "gameover", "finished"].includes(game.state)) {
    startGame();
  } else if ((e.key === "r" || e.key === "R") && game.state === "playing") {
    loadLevel(game.index);
  } else if (e.key === "p" || e.key === "P") {
    if (game.state === "playing") setState("paused", "Pauze \u2014 druk op P");
    else if (game.state === "paused") setState("playing");
  }
});

document.querySelectorAll(".pad button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (["title", "gameover", "finished"].includes(game.state)) startGame();
    else move(btn.dataset.dir);
  });
});

let swipeStart = null;
canvas.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  swipeStart = [t.clientX, t.clientY];
}, { passive: true });
canvas.addEventListener("touchend", (e) => {
  if (!swipeStart || game.state === "edit") return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipeStart[0];
  const dy = t.clientY - swipeStart[1];
  swipeStart = null;
  if (["title", "gameover", "finished"].includes(game.state)) {
    startGame();
  } else if (Math.max(Math.abs(dx), Math.abs(dy)) >= 24) {
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : (dy > 0 ? "D" : "U"));
  }
});

// --- Edit mode: fix levels by hand and export the corrections for tools/overrides.json ---
const FIX_KEY = "bombsweeper.fixes";

function loadFixes() {
  try {
    return JSON.parse(localStorage.getItem(FIX_KEY)) || {};
  } catch {
    return {};
  }
}

function saveFix() {
  const fixes = loadFixes();
  const src = levels[game.index].source;
  fixes[src] = { ...fixes[src], walls: [...game.walls].sort(), start: [...game.player], bombs: [...game.bombs] };
  localStorage.setItem(FIX_KEY, JSON.stringify(fixes));
  showExport();
}

function toggleSkip() {
  const fixes = loadFixes();
  const src = levels[game.index].source;
  fixes[src] = { ...fixes[src], skip: !fixes[src]?.skip };
  localStorage.setItem(FIX_KEY, JSON.stringify(fixes));
  showExport();
}

function showExport() {
  document.getElementById("export").value = JSON.stringify(loadFixes(), null, 1);
}

function gotoLevel(i) {
  if (i < 0 || i >= levels.length) return;
  loadLevel(i);
  setState("edit", editHelp());
}

function editHelp() {
  return "Klik muur = aan/uit \u00b7 klik vakje = start \u00b7 klik buiten rand = bom \u00b7 N/B = volgend/vorig \u00b7 X = overslaan \u00b7 E = spelen";
}

function toggleEdit() {
  const entering = game.state !== "edit";
  loadLevel(game.index);
  if (entering) setState("edit", editHelp());
  document.getElementById("editor").hidden = !entering;
  showExport();
}

canvas.addEventListener("click", (e) => {
  if (game.state !== "edit") return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  let best = null;
  for (const key of SEGMENTS) {
    const [x1, y1, x2, y2] = segmentLine(key);
    const cx = Math.max(Math.min(x, Math.max(x1, x2)), Math.min(x1, x2));
    const cy = Math.max(Math.min(y, Math.max(y1, y2)), Math.min(y1, y2));
    const d = Math.hypot(x - cx, y - cy);
    if (!best || d < best.d) best = { key, d };
  }
  const inside = x > OX && x < OX + COLS * CELL && y > OY && y < OY + ROWS * CELL;
  if (!inside && best.d < 45 && isBoundary(best.key)) {
    // Outside the maze: toggle a bomb in this opening of the outer wall.
    const k = best.key;
    if (game.bombs.includes(k)) {
      game.bombs = game.bombs.filter((b) => b !== k);
      game.walls.add(k);
    } else {
      game.bombs.push(k);
      game.walls.delete(k);
    }
  } else if (inside && best.d < 14) {
    if (game.walls.has(best.key)) game.walls.delete(best.key);
    else game.walls.add(best.key);
  } else if (inside) {
    game.player = [Math.floor((y - OY) / CELL), Math.floor((x - OX) / CELL)];
    const p = cellCenter(game.player);
    Object.assign(fx, { from: p, to: p, moveT: 1 });
  } else {
    return;
  }
  saveFix();
});

document.getElementById("copy").addEventListener("click", () => {
  navigator.clipboard.writeText(document.getElementById("export").value);
});

// --- Main loop ---

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.state !== "paused") update(dt);
  draw(now / 1000);
  requestAnimationFrame(frame);
}

if (!levels.length) ui.message.textContent = "Geen levels gevonden (levels.js ontbreekt).";
if (TEST_MODE && levels.length) {
  document.getElementById("test-help").hidden = false;
  startGame();
}
requestAnimationFrame(frame);
