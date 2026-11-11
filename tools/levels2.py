"""Build final levels: walls from the video, bombs outside the maze at boundary openings, player start inside."""
import json
import sys
from collections import deque
import numpy as np

exec(open("tools/segment.py").read().split("print(f\"games:")[0])
from finalize_fast import BIT, MOVES, is_boundary  # noqa: E402

out_feat = np.load("frames/outside.npz")
outside, okeys = out_feat["feats"], list(out_feat["keys"])
outside = outside - np.median(outside[ns["blank"]], axis=0)
cells = np.load("frames/features.npz")["cells"]
cells = cells - np.median(cells[ns["blank"]], axis=0)

OUT_DIR = {}
for k in okeys:
    r, c = int(k[1]), int(k[2])
    OUT_DIR[k] = (r if k[0] == "v" else (0 if r == 0 else 3), c if k[0] == "h" else (0 if c == 0 else 5))

flat = [m for g in games for m in g["mazes"]]
for i, m in enumerate(flat):
    m["end"] = flat[i + 1]["time"] if i + 1 < len(flat) else float(times[-1])
bomb_mazes = [m for m in flat if m["state"].sum() >= 26]


def window(m, a, b):
    return (times >= m["time"] + a) & (times < min(m["end"], m["time"] + b))


def solve(start, walls, bombs):
    """BFS (pushes allowed) until the player can step out onto a bomb."""
    exits = {}
    for k in bombs:
        exits.setdefault(OUT_DIR[k][0] * COLS + OUT_DIR[k][1], []).append(k)
    dir_of = {"h0": "U", "h4": "D", "v0": "L", "v6": "R"}
    s0 = (start, walls)
    parent = {s0: None}
    q = deque([s0])
    while q and len(parent) < 200000:
        cur = q.popleft()
        pos, w = cur
        for k in exits.get(pos, []):
            if not w & BIT[k]:
                path = []
                st = cur
                while parent[st]:
                    st, d = parent[st]
                    path.append(d)
                side = k[0] + (k[1] if k[0] == "h" else k[2])
                return "".join(reversed(path)) + dir_of[side]
        for d, tgt, eb, fb, bnd in MOVES[pos]:
            if w & eb:
                if bnd or w & fb:
                    continue
                nw = (w & ~eb) | fb
            else:
                nw = w
            nxt = (tgt, nw)
            if nxt not in parent:
                parent[nxt] = (cur, d)
                q.append(nxt)
    return None


rows, reps = [], []
overrides = json.load(open("tools/overrides.json"))
# Scrolling-maze phases in game.mp4 (seconds); their rapidly changing frames are not bomb levels.
SCROLL_WINDOWS = [(57, 84), (149, 175), (242, 269), (335, 360), (427, 451), (531, 554), (637, 659), (733, 754)]
for m in bomb_mazes:
    s = m["state"]
    if any(a <= m["time"] < b for a, b in SCROLL_WINDOWS):
        continue
    if any(int((s != r).sum()) <= 4 for r in reps):
        continue
    reps.append(s)
    osc = np.median(outside[window(m, 0, 4)], axis=0)
    early = cells[window(m, 0, 0.8)].mean(axis=0)
    rows.append((m, s, osc, early))

all_scores = np.concatenate([r[2] for r in rows])
print("outside score percentiles 50/80/90/95/99:", np.percentile(all_scores, [50, 80, 90, 95, 99]).round(1))
thr = float(sys.argv[1]) if len(sys.argv) > 1 else float(np.percentile(all_scores, 93))
print("bomb threshold:", round(thr, 1))

levels, stats = [], {"ok": 0, "unsolvable": 0, "two_bombs": 0}
for m, s, osc, early in rows:
    order = np.argsort(-osc)
    bombs = [okeys[i] for i in order[:2] if osc[i] >= thr] or [okeys[order[0]]]
    st = dict(zip(kinds, s))
    walls = {k for k, v in st.items() if v and not is_boundary(k)}
    walls |= {k for k in st if is_boundary(k) and k not in bombs}
    wbits = sum(BIT[k] for k in walls)
    sol, start = None, None
    for cell in np.argsort(-early)[:3]:
        sol = solve(int(cell), wbits, bombs)
        if sol:
            start = int(cell)
            break
    fix = overrides.get(f"{round(m['time'], 1)}")
    if fix:
        if fix.get("skip"):
            continue
        if "walls" in fix:
            walls = set(fix["walls"])
        if "bombs" in fix:
            bombs = fix["bombs"]
            walls = {k for k in walls if not is_boundary(k)} | {k for k in BIT if is_boundary(k) and k not in bombs}
        wbits = sum(BIT[k] for k in walls)
        if "start" in fix:
            start = fix["start"][0] * COLS + fix["start"][1]
        sol = solve(start, wbits, bombs) if start is not None else None
    if not sol:
        stats["unsolvable"] += 1
        continue
    if len(sol) < 5 and not fix:
        # Usually means the start was read while the player was already next to the bomb.
        stats["too_short"] = stats.get("too_short", 0) + 1
        continue
    stats["ok"] += 1
    stats["two_bombs"] += len(bombs) == 2
    levels.append({
        "id": len(levels) + 1,
        "source": round(m["time"], 1),
        "walls": sorted(walls),
        "start": [start // COLS, start % COLS],
        "bombs": bombs,
        "solution": sol,
        "corrected": bool(fix),
        "time": max(12, round(len(sol) * 1.5 + 8)),
    })
print(stats, "levels:", len(levels))
print("solution lengths:", sorted(len(l["solution"]) for l in levels))

# Hand-made levels from the Godot version replace the first video levels.
godot = json.load(open("frames/levels_godot.json"))
manual = []
for g in godot:
    sol = solve(g["start"][0] * COLS + g["start"][1], sum(BIT[k] for k in g["walls"]), g["bombs"])
    if sol is None:
        print("godot level unsolvable:", g["source"])
        continue
    manual.append({**g, "solution": sol, "corrected": True, "time": 25})
levels = manual + levels[len(godot):]
for i, lv in enumerate(levels, 1):
    lv["id"] = i
print("final levels:", len(levels), "of which from Godot:", len(manual))
with open("game/levels.js", "w") as f:
    f.write("// Generated by tools/levels2.py from game.mp4\nwindow.LEVELS = ")
    json.dump(levels, f, separators=(",", ":"))
    f.write(";\n")
json.dump(levels, open("frames/levels_final.json", "w"), indent=1)
