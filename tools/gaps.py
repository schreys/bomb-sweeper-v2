import json
from collections import Counter

levels = json.load(open("frames/levels_1.json"))
sides = Counter()
per_level = Counter()
for lv in levels:
    w = lv["walls"]
    gaps = [k for k, v in w.items() if not v and ((k[0] == "h" and k[1] in "04") or (k[0] == "v" and k[2] in "06"))]
    per_level[len(gaps)] += 1
    for k in gaps:
        sides[k] += 1
print("gaps per level:", sorted(per_level.items()))
print("gap positions:", sorted(sides.items(), key=lambda x: -x[1]))
