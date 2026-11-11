"""Convert the hand-made Godot levels (original/level_*.gd) to the web game's level format."""
import json
import re

FLAGS = {"NONE": 0, "RIGHT": 1, "BOTTOM": 2, "PLAYER": 4, "BOMB": 8}


def parse_levels(path):
    src = open(path).read()
    body = src[src.index("return") + len("return"):]
    levels, level, depth, row = [], None, 0, None
    for tok in re.findall(r"\[|\]|BlockType\.\w+(?:\s*\|\s*BlockType\.\w+)*", body):
        if tok == "[":
            depth += 1
            if depth == 2:
                level = []
            elif depth == 3:
                row = []
        elif tok == "]":
            if depth == 3:
                level.append(row)
            elif depth == 2:
                levels.append(level)
            depth -= 1
        else:
            row.append(sum(FLAGS[f] for f in re.findall(r"BlockType\.(\w+)", tok)))
    return levels


def convert(grid):
    """Godot grid: border row 0/5 and border col 0/7 around a 4x6 maze (rows 1-4, cols 1-6)."""
    walls, bombs, start = set(), [], None
    for r, row in enumerate(grid):
        for c, v in enumerate(row):
            if v & FLAGS["PLAYER"]:
                start = [r - 1, c - 1]
            if v & FLAGS["BOMB"]:
                if r == 0:
                    bombs.append(f"h0{c - 1}")
                elif r == 5:
                    bombs.append(f"h4{c - 1}")
                elif c == 0:
                    bombs.append(f"v{r - 1}0")
                elif c == 7:
                    bombs.append(f"v{r - 1}6")
            if v & FLAGS["BOTTOM"] and 0 <= r <= 4 and 1 <= c <= 6:
                walls.add(f"h{r}{c - 1}")
            if v & FLAGS["RIGHT"] and 1 <= r <= 4 and 0 <= c <= 6:
                walls.add(f"v{r - 1}{c}")
    return {"walls": sorted(walls), "start": start, "bombs": bombs}


levels = []
for path in ("original/level_1_10.gd", "original/level_11_20.gd"):
    for grid in parse_levels(path):
        lv = convert(grid)
        lv["source"] = f"godot-{len(levels) + 1}"
        levels.append(lv)
json.dump(levels, open("frames/levels_godot.json", "w"), indent=1)
print("godot levels:", len(levels))
for i, lv in enumerate(levels, 1):
    print(i, "start", lv["start"], "bombs", lv["bombs"], "walls", len(lv["walls"]))
