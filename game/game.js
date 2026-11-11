"use strict";

const ROWS = 4;
const COLS = 6;
const CELL = 80;
const OX = 60;
const OY = 74;
const LIVES = 3;
const MOVE_TIME = 0.12;
const PUSH_TIME = 0.16;
// Bonus stage after every 10 mazes, as in Game A: the maze slides right 41 times.
const BONUS_EVERY = 10;
const SCROLL_STEPS = 41;
const SCROLL_DELAY = 3;
const SCROLL_INTERVAL = 1.35;
const MAX_LIVES = 5;
// The clock ticks every half second; the ticks left are counted into the score one by one.
const TICK = 0.5;
const TALLY_DELAY = 0.8;
const TALLY_RATE = 0.085;
const BONUS_POINTS = 100;
const BONUS_TALLY_RATE = 0.03;
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
  bonus: false,
  scroll: null,
  tally: null,
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
  hurt: null,
  scrollT: 1,
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
  game.bonus = false;
  game.scroll = null;
  const p = cellCenter(game.player);
  Object.assign(fx, { from: p, to: p, moveT: 1, bump: null, pushes: [], floaters: [], intro: 0, hurt: null });
  Sound.play("levelStart");
  setState("playing", `Level ${lv.id} van ${levels.length}`);
}

function loadBonus() {
  game.bonus = true;
  game.walls = new Set(SEGMENTS.filter((k) => isBoundary(k) && !(k[0] === "v" && k[2] === "0")));
  game.player = [ROWS - 1, COLS - 1];
  game.bombs = [];
  game.defusedAt = null;
  game.timeLeft = 0;
  game.scroll = { step: 0, wait: SCROLL_DELAY };
  const p = cellCenter(game.player);
  Object.assign(fx, { from: p, to: p, moveT: 1, bump: null, pushes: [], floaters: [], intro: 0, hurt: null, scrollT: 1 });
  Sound.play("bonusStart");
  setState("playing", "Bonus: laat je niet platdrukken tot het doolhof stilstaat, pak dan de bom bovenaan.");
}

function scrollStep() {
  const s = game.scroll;
  const w = game.walls;
  const set = (k, on) => (on ? w.add(k) : w.delete(k));
  const [r, c] = game.player;
  const edge = `v${r}${COLS - 1}`;
  if (c === COLS - 1 && w.has(edge) && w.has(`v${r}${COLS - 2}`)) {
    blowUp("Platgedrukt!");
    return;
  }
  s.step += 1;
  Sound.play("bonusMove");
  // A wall reaching the player at the right edge is pushed back one column first.
  if (c === COLS - 1 && w.has(edge)) {
    set(edge, false);
    set(`v${r}${COLS - 2}`, true);
  }
  for (let col = COLS; col > 0; col--) {
    for (let row = 0; row < ROWS; row++) set(`v${row}${col}`, w.has(`v${row}${col - 1}`));
  }
  for (let col = COLS - 1; col > 0; col--) {
    for (let row = 0; row <= ROWS; row++) set(`h${row}${col}`, w.has(`h${row}${col - 1}`));
  }
  const pick = (n, max) => {
    const out = new Set();
    while (out.size < n) out.add(Math.floor(Math.random() * max));
    return [...out];
  };
  const odd = s.step % 2 === 1;
  for (let row = 0; row <= ROWS; row++) set(`h${row}0`, false);
  for (let row = 0; row < ROWS; row++) set(`v${row}0`, s.step < 35 && odd);
  if (s.step < 35) {
    for (const row of pick(odd ? 1 : 2, ROWS + 1)) set(`h${row}0`, true);
    for (const row of pick(odd ? 1 : 2, ROWS)) set(`v${row}0`, !odd);
  } else {
    if (s.step !== 40) set("h00", true);
    set(`h${ROWS}0`, true);
  }
  fx.scrollT = 0;
  fx.pushes = [];
  if (c < COLS - 1) {
    game.player = [r, c + 1];
    walkTo(cellCenter(game.player), fx.dir);
  }
  if (s.step === SCROLL_STEPS) {
    for (let row = 0; row < ROWS; row++) set(`v${row}0`, true);
    game.bombs = ["h01"];
    ui.message.textContent = "Het doolhof staat stil: pak de bom bovenaan!";
  }
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
    Sound.play("push");
  } else {
    Sound.play("move");
  }
  game.player = [nr, nc];
  walkTo(cellCenter(game.player), dir);
}

function bump(dy, dx) {
  fx.bump = { dx, dy, t: 0 };
}

function ticksLeft() {
  return Math.max(0, Math.ceil(game.timeLeft / TICK - 1e-9));
}

function defuse(key, dir) {
  const points = game.bonus ? BONUS_POINTS : ticksLeft();
  game.tally = { left: points, wait: TALLY_DELAY, rate: game.bonus ? BONUS_TALLY_RATE : TALLY_RATE };
  Sound.play(game.bonus ? "bonusClear" : "levelEnd");
  game.defusedAt = key;
  walkTo(bombPos(key), dir);
  const [x, y] = bombPos(key);
  confetti(x, y);
  fx.floaters.push({ x, y: y - 20, text: `+${points}`, t: 0 });
  if (game.bonus) {
    game.lives = Math.min(game.lives + 1, MAX_LIVES);
    setState("defused", `Bonus gehaald! +${points} en een extra leven`);
    return;
  }
  localStorage.setItem("bombsweeper.best", Math.max(game.index + 2, bestLevel()));
  setState("defused", `Bom onschadelijk! +${points}`);
}

function blowUp(message) {
  if (!TEST_MODE) game.lives -= 1;
  explode();
  setState("exploded", game.lives > 0 ? message : "BOEM! Game over.");
}

function explode() {
  Sound.play("boom");
  fx.shake = 16;
  fx.flash = 1;
  // The player gets blown away from the nearest bomb.
  const [px, py] = playerPx();
  const [bx] = game.bombs.map(bombPos)
    .sort((a, b) => Math.hypot(a[0] - px, a[1] - py) - Math.hypot(b[0] - px, b[1] - py))[0] || [px];
  fx.hurt = { t: 0, dx: game.bonus ? -1 : px >= bx ? 1 : -1 };
  for (const [x, y] of game.bonus ? [[px, py]] : game.bombs.map(bombPos)) {
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
  if (params.has("bonus")) loadBonus();
}

function updateFx(dt) {
  fx.moveT += dt / MOVE_TIME;
  fx.scrollT += dt / MOVE_TIME;
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
  if (fx.hurt) {
    fx.hurt.t += dt;
    if (Math.random() < dt * 12) {
      const [x, y] = playerPx();
      fx.particles.push({
        x: x + (Math.random() - 0.5) * 20, y: y - 10, vx: (Math.random() - 0.5) * 20, vy: -30, g: -20,
        life: 0.8 + Math.random() * 0.5, age: 0, size: 4 + Math.random() * 4, color: "#6b6b75",
      });
    }
  }
  sparks(dt);
}

function update(dt) {
  game.stateTime += dt;
  updateFx(dt);
  if (game.state === "playing" && game.bonus) {
    const s = game.scroll;
    if (s.step < SCROLL_STEPS) {
      s.wait -= dt;
      if (s.wait <= 0) {
        s.wait += SCROLL_INTERVAL;
        scrollStep();
      }
    }
  } else if (game.state === "playing" && !TEST_MODE) {
    const before = ticksLeft();
    game.timeLeft -= dt;
    if (game.timeLeft > 0 && ticksLeft() < before) Sound.play("clock");
    if (game.timeLeft <= 0) {
      game.timeLeft = 0;
      blowUp("BOEM! Probeer opnieuw.");
    }
  } else if (game.state === "defused") {
    const t = game.tally;
    t.wait -= dt;
    while (t.wait <= 0 && t.left > 0) {
      t.left -= 1;
      game.score += 1;
      Sound.play("score");
      if (!game.bonus) game.timeLeft = t.left * TICK;
      t.wait += t.left > 0 ? t.rate : 0.6;
    }
    if (t.left === 0 && t.wait <= 0) {
      const done = game.index + 1;
      if (!game.bonus && done % BONUS_EVERY === 0 && done < levels.length) loadBonus();
      else if (done < levels.length) loadLevel(done);
      else setState("finished", "Alle bommen onschadelijk gemaakt! Druk op Enter.");
    }
  } else if (game.state === "exploded" && game.stateTime > 2.6) {
    if (game.lives > 0) {
      if (game.bonus) loadBonus();
      else loadLevel(game.index);
    } else {
      setState("gameover", "Game over. Druk op Enter om opnieuw te beginnen.");
      Sound.play("gameOver");
    }
  }
  ui.level.textContent = game.bonus ? "B" : game.index + 1;
  ui.total.textContent = levels.length;
  if (game.state === "defused") ui.time.textContent = game.tally.left;
  else if (game.bonus) ui.time.textContent = SCROLL_STEPS - game.scroll.step;
  else ui.time.textContent = TEST_MODE ? "\u221e" : ticksLeft();
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
  const urgent = !TEST_MODE && !game.bonus && game.state === "playing" && game.timeLeft < 5;
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
  const left = TEST_MODE || game.bonus || !lv || game.state === "title" ? 1 : clamp01(game.timeLeft / lv.time);
  ctx.strokeStyle = "#c9a26b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.quadraticCurveTo(4, -22 - 12 * left, 6 + 10 * left, -22 - 10 * left);
  ctx.stroke();
  const tip = [6 + 10 * left, -22 - 10 * left];
  const flick = 5 + Math.sin(t * 6) * 0.8;
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
  const hurt = fx.hurt;
  const walking = fx.moveT < 1 && !hurt;
  const swing = walking ? Math.sin(clamp01(fx.moveT) * Math.PI) * (fx.steps % 2 ? 1 : -1) : 0;
  let bob = walking ? -Math.abs(Math.sin(clamp01(fx.moveT) * Math.PI)) * 4 : Math.sin(t * 3) * 1;
  const happy = game.state === "defused" || game.state === "finished";
  const jump = happy ? -Math.abs(Math.sin(game.stateTime * 9)) * 10 : 0;
  const [ex, ey] = { U: [0, -2], D: [0, 1], L: [-3, 0], R: [3, 0] }[fx.dir];
  // Blown up: fly away spinning, land charred and dizzy.
  let ox = 0;
  let rot = 0;
  let flight = 0;
  if (hurt) {
    flight = clamp01(hurt.t / 0.7);
    ox = hurt.dx * 36 * flight;
    bob = -Math.sin(flight * Math.PI) * 70;
    rot = flight < 1
      ? hurt.dx * Math.PI * 2 * ease(flight)
      : Math.sin(hurt.t * 7) * 0.2 * Math.exp(-(hurt.t - 0.7) * 1.2);
  }
  const skin = hurt ? "#6e5848" : "#f8c291";
  const landed = hurt && flight >= 1;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x + ox, y + 26, 14 * (1 + bob / 140), 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (hurt && hurt.t < 0.5) {
    ctx.fillStyle = `rgba(20,20,20,${0.5 - hurt.t})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 24, 30, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(x + ox, y + bob + jump);
  ctx.rotate(rot);

  ctx.strokeStyle = hurt ? "#1a1f3a" : "#1e3799";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 10);
  ctx.lineTo(-5 - swing * 6, 24);
  ctx.moveTo(5, 10);
  ctx.lineTo(5 + swing * 6, 24);
  ctx.stroke();

  ctx.fillStyle = hurt ? "#2d3550" : "#4a69bd";
  ctx.beginPath();
  ctx.roundRect(-12, -6, 24, 20, 7);
  ctx.fill();
  ctx.fillStyle = hurt ? "#5c4a22" : "#f6b93b";
  ctx.fillRect(-12, 4, 24, 3);

  ctx.strokeStyle = skin;
  ctx.lineWidth = 5;
  ctx.beginPath();
  let armL = happy ? -14 : swing * 5;
  let armR = happy ? -14 : -swing * 5;
  if (hurt) {
    armL = landed ? 4 : -16 + Math.sin(hurt.t * 40) * 6;
    armR = landed ? 4 : -16 - Math.sin(hurt.t * 40) * 6;
  }
  ctx.moveTo(-12, 0);
  ctx.lineTo(-17, 8 + armL);
  ctx.moveTo(12, 0);
  ctx.lineTo(17, 8 + armR);
  ctx.stroke();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -16, 10, 0, Math.PI * 2);
  ctx.fill();
  if (hurt) {
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (const sx of [-3.5, 3.5]) {
      ctx.moveTo(sx - 2, -18);
      ctx.lineTo(sx + 2, -14);
      ctx.moveTo(sx + 2, -18);
      ctx.lineTo(sx - 2, -14);
    }
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(i * 4, -25);
      ctx.lineTo(i * 6 + (i % 2 ? 2 : -2), -33);
    }
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(0, -10, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (fx.dir !== "U") {
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(-3.5 + ex, -16 + ey, 1.8, 0, Math.PI * 2);
    ctx.arc(3.5 + ex, -16 + ey, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!hurt) drawHat(0, -19, 0);
  if (landed) {
    ctx.fillStyle = "#ffd32a";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      ctx.fillText("\u2605", Math.cos(a) * 16, -32 + Math.sin(a) * 5);
    }
  }
  ctx.restore();

  if (hurt) {
    // The hat flies off and lands crooked back on the head.
    const k = clamp01(hurt.t / 1.4);
    const hx = x + ox - hurt.dx * 30 * Math.sin(k * Math.PI);
    const hy = y + bob - 19 - Math.sin(k * Math.PI) * 120;
    drawHat(hx, hy, k < 1 ? hurt.dx * k * Math.PI * 4 : hurt.dx * 0.35);
  }
}

function drawHat(x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "#fbc531";
  ctx.beginPath();
  ctx.arc(0, 0, 11, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-13, -1, 26, 3);
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
  if ((TEST_MODE && !game.bonus) || !lv || !game.state.match(/^(playing|paused)$/)) return;
  const frac = game.bonus ? 1 - game.scroll.step / SCROLL_STEPS : clamp01(game.timeLeft / lv.time);
  const x = OX;
  const y = canvas.height - 18;
  const w = COLS * CELL;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, 8, 4);
  ctx.fill();
  const hue = game.bonus ? 200 : frac * 120;
  const blink = frac < 0.2 && !game.bonus ? 0.6 + Math.sin(t * 16) * 0.4 : 1;
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
  ctx.fillText("Tik of druk op Enter", 300, 340);
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
  ctx.save();
  if (game.bonus) ctx.translate((1 - ease(clamp01(fx.scrollT))) * -CELL, 0);
  drawWalls();
  ctx.restore();
  const blown = game.state === "exploded" || (game.state === "gameover" && fx.hurt);
  game.bombs.forEach((key) => {
    if (key === game.defusedAt) return;
    if (!blown) {
      drawBomb(key, t);
      return;
    }
    const [x, y] = bombPos(key);
    ctx.fillStyle = "rgba(10,10,10,0.55)";
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  drawPlayer(t);
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
    ctx.fillText(game.bonus ? "BONUS" : `LEVEL ${game.index + 1}`, 300, 228 - fx.intro * 20);
    ctx.globalAlpha = 1;
  }
  if (game.state === "paused") drawPanel([["PAUZE", 36], ["Druk op P", 18]]);
  if (game.state === "gameover") drawPanel([["GAME OVER", 36, "#ff6b6b"], [`Score ${game.score}`, 20], ["Tik of druk op Enter", 18]]);
  if (game.state === "finished") drawPanel([["GEWONNEN!", 36, "#7bed9f"], [`Score ${game.score}`, 20], ["Tik of druk op Enter", 18]]);
  ctx.restore();
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255, 240, 200, ${fx.flash * 0.8})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// --- Input ---

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "TEXTAREA") return;
  if ((e.key === "e" || e.key === "E") && TEST_MODE && !game.bonus && ["playing", "edit"].includes(game.state)) {
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
    blowUp("BOEM! Herstarten kost een leven.");
  } else if (e.key === "m" || e.key === "M") {
    toggleSound();
  } else if (e.key === "p" || e.key === "P") {
    if (game.state === "playing") setState("paused", "Pauze \u2014 druk op P");
    else if (game.state === "paused") setState("playing");
  }
});

// Tap zones like the Godot version: top/bottom third of the screen = up/down,
// otherwise left/right third = left/right; the centre does nothing.
// Reacting on pointerdown (not up) avoids taps getting lost to scroll/gesture cancels.
document.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button, textarea, a, #editor") || game.state === "edit") return;
  if (e.pointerType !== "mouse") e.preventDefault();
  if (["title", "gameover", "finished"].includes(game.state)) {
    startGame();
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (e.clientY < h / 3) move("U");
  else if (e.clientY > (2 * h) / 3) move("D");
  else if (e.clientX < w / 3) move("L");
  else if (e.clientX > (2 * w) / 3) move("R");
}, { passive: false });

document.getElementById("restart-btn").addEventListener("click", () => {
  if (["playing", "paused"].includes(game.state)) blowUp("BOEM! Herstarten kost een leven.");
});

const soundBtn = document.getElementById("sound-btn");
function toggleSound() {
  soundBtn.textContent = Sound.toggle() ? "\u{1F507}" : "\u{1F50A}";
}
soundBtn.textContent = Sound.isMuted() ? "\u{1F507}" : "\u{1F50A}";
soundBtn.addEventListener("click", toggleSound);

// Fullscreen: native where supported (Android), otherwise a CSS-only layout (iPhone).
const fsBtn = document.getElementById("fs-btn");
function setFullscreen(on) {
  document.body.classList.toggle("fs", on);
  fsBtn.textContent = on ? "\u2715" : "\u26f6";
}
fsBtn.addEventListener("click", async () => {
  const on = !document.body.classList.contains("fs");
  setFullscreen(on);
  try {
    if (on && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      await screen.orientation?.lock?.("landscape").catch(() => {});
    } else if (!on && document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    // Native fullscreen is optional; the CSS layout already applies.
  }
});
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) setFullscreen(false);
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
