"""List final levels with the duration their maze was on screen (short = likely a transition frame)."""
import json
import sys

sys.argv = sys.argv[:1]
exec(open("tools/segment.py").read().split("print(f\"games:")[0])
flat = [m for g in games for m in g["mazes"]]
dur = {}
for i, m in enumerate(flat):
    end = flat[i + 1]["time"] if i + 1 < len(flat) else float(times[-1])
    dur[round(m["time"], 1)] = end - m["time"]
levels = json.load(open("frames/levels_final.json"))
for lv in levels:
    print(lv["id"], lv["source"], f"dur={dur.get(lv['source'], -1):.1f}", "start", lv["start"], "bombs", lv["bombs"], "sol", len(lv["solution"]))
