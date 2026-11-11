"""Segment the stable states into games and mazes and look for repeats across games."""
import json
import numpy as np

ns = {}
exec(open("tools/analyze.py").read().split("mazes = []")[0].replace("print(", "(lambda *a, **k: None)("), ns)
times, smooth, runs, kinds = ns["times"], ns["smooth"], ns["runs"], list(ns["kinds"])
ROWS, COLS = 4, 6
boundary = np.array([(k[0] == "h" and k[1] in "04") or (k[0] == "v" and k[2] in "06") for k in kinds])


def ascii_maze(state):
    st = dict(zip(kinds, state))
    lines = []
    for r in range(ROWS + 1):
        lines.append("+" + "+".join("--" if st[f"h{r}{c}"] else "  " for c in range(COLS)) + "+")
        if r < ROWS:
            lines.append("".join(("|" if st[f"v{r}{c}"] else " ") + ("  " if c < COLS else "") for c in range(COLS + 1)))
    return lines


games, cur, maze = [], None, None
for a, b in runs:
    if b - a < 3:
        continue
    s = smooth[a]
    interior = int((s & ~boundary).sum())
    if s.sum() <= 2:
        continue  # blank screen
    if interior <= 2:
        if cur is None or cur["mazes"]:
            cur = {"start": float(times[a]), "mazes": []}
            games.append(cur)
        maze = None
        continue
    if cur is None:
        cur = {"start": float(times[a]), "mazes": []}
        games.append(cur)
    if maze is not None and int((s != maze["last"]).sum()) <= 4:
        maze["last"] = s
        continue
    maze = {"time": float(times[a]), "state": s, "last": s}
    cur["mazes"].append(maze)

print(f"games: {len(games)}, mazes: {sum(len(g['mazes']) for g in games)}")
for gi, g in enumerate(games):
    print(f"game {gi + 1} @ {g['start']:.0f}s: {len(g['mazes'])} mazes")

# Repeats: compare every maze with the first mazes of game 1.
allm = [(gi, mi, m) for gi, g in enumerate(games) for mi, m in enumerate(g["mazes"])]
print("\nclosest earlier maze (diff) per maze:")
for idx, (gi, mi, m) in enumerate(allm):
    best = min(((int((m["state"] != o["state"]).sum()), f"g{ogi + 1}m{omi + 1}") for ogi, omi, o in allm[:idx]), default=(None, "-"))
    print(f"g{gi + 1}m{mi + 1} @{m['time']:.1f}s  on={int(m['state'].sum())}  closest={best[1]} diff={best[0]}")

out = []
for gi, g in enumerate(games):
    for mi, m in enumerate(g["mazes"]):
        out.append({"game": gi + 1, "maze": mi + 1, "time": round(m["time"], 1),
                    "walls": {k: bool(v) for k, v in zip(kinds, m["state"])},
                    "ascii": ascii_maze(m["state"])})
json.dump(out, open("frames/mazes_raw.json", "w"), indent=1)
