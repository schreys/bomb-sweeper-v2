"use strict";

const ROWS = 4;
const COLS = 6;
const CELL = 80;
const OX = 60;
const OY = 60;
const LIVES = 3;
const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const KEYS = {
  ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R",
  w: "U", s: "D", a: "L", d: "R", W: "U", S: "D", A: "L", D: "R",
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
  if (typeof lv.source !== "number") {
    setState("playing", `Level ${lv.id} \u2014 uit je Godot-versie`);
    return;
  }
  const m = Math.floor(lv.source / 60);
  const s = String(Math.floor(lv.source % 60)).padStart(2, "0");
  setState("playing", `Level ${lv.id} — in de video op ${m}:${s}`);
}

function setState(state, message = "") {
  game.state = state;
  game.stateTime = 0;
  ui.message.textContent = message;
}

function move(dir) {
  if (game.state !== "playing") return;
  const [dr, dc] = DIRS[dir];
  const [r, c] = game.player;
  const nr = r + dr;
  const nc = c + dc;
  const key = edgeKey(r, c, dr, dc);
  if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
    // Bombs lie outside the maze in an opening of the outer wall.
    if (!game.walls.has(key) && game.bombs.includes(key)) defuse(key);
    return;
  }
  if (game.walls.has(key)) {
    // A wall can only be pushed one cell further if nothing blocks it there.
    const far = edgeKey(nr, nc, dr, dc);
    if (isBoundary(key) || game.walls.has(far)) return;
    game.walls.delete(key);
    game.walls.add(far);
  }
  game.player = [nr, nc];
}

function defuse(key) {
  const bonus = Math.ceil(game.timeLeft) * 10;
  game.score += 100 + bonus;
  game.defusedAt = key;
  localStorage.setItem("bombsweeper.best", Math.max(game.index + 2, bestLevel()));
  setState("defused", `Bom onschadelijk! +${100 + bonus}`);
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

function update(dt) {
  game.stateTime += dt;
  if (game.state === "playing" && !TEST_MODE) {
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) {
      game.timeLeft = 0;
      game.lives -= 1;
      setState("exploded", game.lives > 0 ? "BOEM! Probeer opnieuw." : "BOEM! Game over.");
    }
  } else if (game.state === "defused" && game.stateTime > 1.2) {
    if (game.index + 1 < levels.length) loadLevel(game.index + 1);
    else setState("finished", "Alle bommen onschadelijk gemaakt! Druk op Enter.");
  } else if (game.state === "exploded" && game.stateTime > 1.8) {
    if (game.lives > 0) loadLevel(game.index);
    else setState("gameover", "Game over. Druk op Enter om opnieuw te beginnen.");
  }
  ui.level.textContent = game.index + 1;
  ui.total.textContent = levels.length;
  ui.time.textContent = TEST_MODE ? "∞" : Math.ceil(game.timeLeft);
  ui.score.textContent = game.score;
  ui.lives.textContent = game.lives;
}

function segmentLine(key) {
  const kind = key[0];
  const r = Number(key[1]);
  const c = Number(key[2]);
  const x = OX + c * CELL;
  const y = OY + r * CELL;
  return kind === "h" ? [x + 6, y, x + CELL - 6, y] : [x, y + 6, x, y + CELL - 6];
}

function allSegments() {
  const keys = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c < COLS; c++) keys.push(`h${r}${c}`);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS; c++) keys.push(`v${r}${c}`);
  return keys;
}
const SEGMENTS = allSegments();

function drawSegment(key, color, width) {
  const [x1, y1, x2, y2] = segmentLine(key);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function cellCenter([r, c]) {
  return [OX + c * CELL + CELL / 2, OY + r * CELL + CELL / 2];
}

function bombPos(key) {
  const r = Number(key[1]);
  const c = Number(key[2]);
  if (key[0] === "h") return [OX + c * CELL + CELL / 2, OY + r * CELL + (r === 0 ? -32 : 32)];
  return [OX + c * CELL + (c === 0 ? -32 : 32), OY + r * CELL + CELL / 2];
}

function drawBomb(key, t) {
  const [x, y] = bombPos(key);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.75, 0.75);
  ctx.translate(-x, -y);
  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath();
  ctx.arc(x, y + 6, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 6, y - 16, 12, 8);
  ctx.strokeStyle = "#1b1b1b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - 16);
  ctx.quadraticCurveTo(x + 6, y - 28, x + 16, y - 26);
  ctx.stroke();
  if (Math.floor(t * 6) % 2 === 0) {
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.arc(x + 17, y - 26, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer() {
  const [x, y] = game.defusedAt ? bombPos(game.defusedAt) : cellCenter(game.player);
  ctx.strokeStyle = "#1b1b1b";
  ctx.fillStyle = "#1b1b1b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y - 18, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.moveTo(x - 14, y - 2);
  ctx.lineTo(x + 14, y - 2);
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x - 10, y + 26);
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x + 10, y + 26);
  ctx.stroke();
}

function drawExplosion(t) {
  const [x, y] = [canvas.width / 2, canvas.height / 2];
  const radius = 20 + t * 220;
  ctx.fillStyle = `rgba(30, 30, 30, ${Math.max(0, 0.9 - t * 0.4)})`;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 ? radius : radius * 0.55;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawText(lines) {
  ctx.fillStyle = "#1b1b1b";
  ctx.textAlign = "center";
  lines.forEach(([text, size], i) => {
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.fillText(text, canvas.width / 2, 170 + i * 40);
  });
}

function draw(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Faint "ghost" segments like an unlit LCD.
  for (const key of SEGMENTS) drawSegment(key, "rgba(40, 50, 30, 0.08)", 8);

  if (game.state === "title") {
    drawText([["BOMB SWEEPER", 36], [`${levels.length} doolhoven uit de video`, 18], ["Druk op Enter", 22]]);
    return;
  }
  for (const key of game.walls) drawSegment(key, "#1b1b1b", 8);
  if (game.state !== "defused") game.bombs.forEach((key) => drawBomb(key, t));
  drawPlayer();
  if (game.state === "exploded") drawExplosion(game.stateTime);
  if (game.state === "edit") {
    ctx.fillStyle = "#b0281e";
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText(loadFixes()[levels[game.index].source]?.skip ? "BEWERKEN (OVERSLAAN)" : "BEWERKEN", 8, 20);
  }
  if (game.state === "paused") drawText([["PAUZE", 36]]);
  if (game.state === "gameover") drawText([["GAME OVER", 36]]);
  if (game.state === "finished") drawText([["GEWONNEN!", 36]]);
}

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
    if (game.state === "playing") setState("paused", "Pauze — druk op P");
    else if (game.state === "paused") setState("playing");
  }
});

document.querySelectorAll(".pad button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (["title", "gameover", "finished"].includes(game.state)) startGame();
    else move(btn.dataset.dir);
  });
});

let last = performance.now();

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
  return "Klik muur = aan/uit · klik vakje = start · klik buiten rand = bom · N/B = volgend/vorig · X = overslaan · E = spelen";
}

function toggleEdit() {
  if (game.state === "edit") {
    loadLevel(game.index);
  } else {
    loadLevel(game.index);
    setState("edit", editHelp());
  }
  document.getElementById("editor").hidden = game.state !== "edit";
  showExport();
}

function isBoundaryEdge(key) {
  return isBoundary(key);
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
  if (!inside && best.d < 45 && isBoundaryEdge(best.key)) {
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
  } else {
    return;
  }
  saveFix();
});

document.getElementById("copy").addEventListener("click", () => {
  navigator.clipboard.writeText(document.getElementById("export").value);
});
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
