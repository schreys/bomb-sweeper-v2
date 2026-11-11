"""Print stable maze states as ASCII between two timestamps: analyze_ascii.py T0 T1"""
import sys
import numpy as np

exec(open("tools/analyze.py").read().split("mazes = []")[0].replace("print(", "(lambda *a, **k: None)("))

ROWS, COLS = 4, 6


def ascii_maze(state):
    st = dict(zip(kinds, state))
    lines = []
    for r in range(ROWS + 1):
        lines.append("+" + "+".join("--" if st[f"h{r}{c}"] else "  " for c in range(COLS)) + "+")
        if r < ROWS:
            lines.append("".join(("|" if st[f"v{r}{c}"] else " ") + ("  " if c < COLS else "") for c in range(COLS + 1)))
    return lines


t0, t1 = float(sys.argv[1]), float(sys.argv[2])
blocks = []
for a, b in runs:
    if b - a < 5 or times[a] < t0 or times[a] > t1:
        continue
    blocks.append([f"{times[a]:.1f}s".ljust(19)] + [l.ljust(19) for l in ascii_maze(smooth[a])])
for i in range(0, len(blocks), 5):
    group = blocks[i:i + 5]
    for row in zip(*group):
        print("  ".join(row))
    print()
