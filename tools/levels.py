"""Build the final level list: unique bomb mazes with bomb and start cell estimates."""
import json
import numpy as np

exec(open("tools/segment.py").read().split("print(f\"games:")[0])

feat = np.load("frames/features.npz")
cells = feat["cells"]
blank_cells = np.median(cells[ns["blank"]], axis=0)
cells = cells - blank_cells

flat = [m for g in games for m in g["mazes"]]
for i, m in enumerate(flat):
    m["end"] = flat[i + 1]["time"] if i + 1 < len(flat) else float(times[-1])
bomb_mazes = [m for m in flat if m["state"].sum() >= 28]


def cell_stats(m):
    sel = (times >= m["time"]) & (times < min(m["end"], m["time"] + 4))
    c = cells[sel]
    return np.median(c, axis=0), c[: max(1, len(c) // 4)].mean(axis=0)


levels, reps = [], []
for m in bomb_mazes:
    s = m["state"]
    if any(int((s != r).sum()) <= 4 for r in reps):
        continue
    reps.append(s)
    med, early = cell_stats(m)
    order = np.argsort(-med)
    bomb = int(order[0])
    margin = float(med[order[0]] - med[order[1]])
    early[bomb] = -1e9
    start = int(np.argmax(early))
    levels.append({
        "id": len(levels) + 1,
        "source_time": round(m["time"], 1),
        "walls": {k: bool(v) for k, v in zip(kinds, s)},
        "bomb": [bomb // COLS, bomb % COLS],
        "start": [start // COLS, start % COLS],
        "bomb_margin": round(margin, 1),
        "ascii": ascii_maze(s),
    })

print(f"bomb mazes: {len(bomb_mazes)}  unique levels: {len(levels)}")
for lv in levels[:25]:
    print(lv["id"], lv["source_time"], "bomb", lv["bomb"], "start", lv["start"], "margin", lv["bomb_margin"])
print("margins p10/p50/p90:", np.percentile([l["bomb_margin"] for l in levels], [10, 50, 90]))
print("bomb cell histogram:", np.bincount([l["bomb"][0] * COLS + l["bomb"][1] for l in levels], minlength=24).reshape(ROWS, COLS))
print("start cell histogram:", np.bincount([l["start"][0] * COLS + l["start"][1] for l in levels], minlength=24).reshape(ROWS, COLS))
json.dump(levels, open("frames/levels_1.json", "w"), indent=1)
