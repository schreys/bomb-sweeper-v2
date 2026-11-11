"""Cluster bomb mazes (non-scrolling phases) into unique layouts and show the order per game."""
import json
import numpy as np

exec(open("tools/segment.py").read().split("print(f\"games:")[0])

phases = []
for gi, g in enumerate(games):
    ms = g["mazes"]
    if len(ms) < 2:
        continue
    dur = np.median(np.diff([m["time"] for m in ms]))
    phases.append(("bomb" if dur >= 1.5 else "scroll", gi, ms))

bomb = [(pi, mi, m) for pi, (kind, gi, ms) in enumerate(phases) if kind == "bomb" for mi, m in enumerate(ms)]
clusters = []  # list of (representative state, members)
labels = []
for pi, mi, m in bomb:
    s = m["state"]
    best = min(range(len(clusters)), key=lambda c: int((clusters[c][0] != s).sum()), default=None)
    if best is not None and int((clusters[best][0] != s).sum()) <= 4:
        clusters[best][1].append((pi, mi, m))
        labels.append(best)
    else:
        clusters.append((s, [(pi, mi, m)]))
        labels.append(len(clusters) - 1)

print("phases:", [(k, len(ms)) for k, _, ms in phases])
print(f"bomb mazes: {len(bomb)}  unique layouts: {len(clusters)}")
print("repeated layouts:", sum(1 for c in clusters if len(c[1]) > 1))
i = 0
for pi, (kind, gi, ms) in enumerate(phases):
    if kind != "bomb":
        continue
    seq = labels[i:i + len(ms)]
    i += len(ms)
    print(f"phase {pi:2d} @ {ms[0]['time']:6.1f}s: " + " ".join(f"{l:3d}" for l in seq))
