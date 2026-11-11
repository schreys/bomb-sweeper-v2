"""Turn per-frame segment contrasts into a list of distinct mazes."""
import json
import numpy as np

d = np.load("frames/features.npz")
times, feats, kinds = d["times"], d["feats"], list(d["kinds"])


def otsu(x):
    hist, edges = np.histogram(x, 200)
    centers = (edges[:-1] + edges[1:]) / 2
    best, thr = -1, 0
    for i in range(1, 200):
        w0, w1 = hist[:i].sum(), hist[i:].sum()
        if not w0 or not w1:
            continue
        m0 = (hist[:i] * centers[:i]).sum() / w0
        m1 = (hist[i:] * centers[i:]).sum() / w1
        v = w0 * w1 * (m0 - m1) ** 2
        if v > best:
            best, thr = v, centers[i]
    return thr


thr = otsu(feats.ravel())
print(f"threshold={thr:.1f}  p5={np.percentile(feats, 5):.1f} p50={np.percentile(feats, 50):.1f} p95={np.percentile(feats, 95):.1f}")
# Lighting differs across the screen, so threshold each segment between its own
# "off" level (blank screens between games) and its "on" level.
blank = (feats > thr).sum(axis=1) <= 2
off_lvl = np.median(feats[blank], axis=0)
on_lvl = np.percentile(feats, 97, axis=0)
seg_thr = (off_lvl + on_lvl) / 2
on = feats > seg_thr

# Temporal median over 5 samples (1 s) to suppress the blinking sprites.
k = 5
pad = np.pad(on, ((k // 2, k // 2), (0, 0)), mode="edge")
smooth = np.array([np.median(pad[i:i + k], axis=0) > 0.5 for i in range(len(on))])

# Collapse into runs of identical states.
runs = []
start = 0
for i in range(1, len(smooth) + 1):
    if i == len(smooth) or (smooth[i] != smooth[start]).any():
        runs.append((start, i))
        start = i

mazes = []
prev = None
for a, b in runs:
    if b - a < 5:
        continue
    state = smooth[a]
    n = int(state.sum())
    dist = None if prev is None else int((state != prev).sum())
    print(f"{times[a]:6.1f}-{times[b - 1]:6.1f}s  on={n:2d}  diff={dist}")
    prev = state
