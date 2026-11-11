"""Contact sheets: video frame next to the extracted level (walls, S=start, B=bomb)."""
import importlib.util
import json
import os
import cv2
import numpy as np

spec = importlib.util.spec_from_file_location("ex", "tools/extract.py")
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)

levels = json.load(open("frames/levels_final.json"))
d = np.load("frames/warps.npz")
cap = cv2.VideoCapture(ex.VIDEO)
fps = cap.get(cv2.CAP_PROP_FPS)
x0, y0, x1, y1 = ex.CROP
post = np.array([[ex.SCALE, 0, -x0 * ex.SCALE], [0, ex.SCALE, -y0 * ex.SCALE], [0, 0, 1]], np.float64)
size = ((x1 - x0) * ex.SCALE, (y1 - y0) * ex.SCALE)
TW, TH = 440, 290  # tile half size


def video_tile(t):
    k = int(np.argmin(abs(d["times"] - (t + 0.4))))
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(d["times"][k] * fps)))
    _, frame = cap.read()
    m = np.vstack([d["warps"][k], [0, 0, 1]]).astype(np.float64)
    img = cv2.warpAffine(frame, (m @ np.linalg.inv(post))[:2], size, flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)
    return cv2.resize(img, (TW, TH))


def level_tile(lv):
    img = np.full((TH, TW, 3), 235, np.uint8)
    cw, ch = (TW - 80) / 6, (TH - 80) / 4
    pt = lambda r, c: (int(40 + c * cw), int(40 + r * ch))
    for key in lv["walls"]:
        r, c = int(key[1]), int(key[2])
        a, b = (pt(r, c), pt(r, c + 1)) if key[0] == "h" else (pt(r, c), pt(r + 1, c))
        cv2.line(img, a, b, (20, 20, 20), 5)
    x, y = pt(lv["start"][0] + 0.5, lv["start"][1] + 0.5)
    cv2.putText(img, "S", (x - 12, y + 12), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (200, 120, 0), 3)
    for key in lv["bombs"]:
        r, c = int(key[1]), int(key[2])
        if key[0] == "h":
            x, y = pt(r + (-0.35 if r == 0 else 0.35), c + 0.5)
        else:
            x, y = pt(r + 0.5, c + (-0.3 if c == 0 else 0.3))
        cv2.circle(img, (x, y), 13, (0, 0, 220), -1)
    cv2.putText(img, f"#{lv['id']} {lv['source']}s", (6, TH - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (90, 90, 90), 1)
    return img


os.makedirs("frames/sheets", exist_ok=True)
per = 8
for s in range(0, len(levels), per):
    rows = [np.hstack([video_tile(lv["source"]), level_tile(lv)]) for lv in levels[s:s + per]]
    while len(rows) % 2:
        rows.append(np.zeros_like(rows[0]))
    grid = np.vstack([np.hstack(rows[i:i + 2]) for i in range(0, len(rows), 2)])
    cv2.imwrite(f"frames/sheets/levels_{s // per + 1:02d}.jpg", grid, [cv2.IMWRITE_JPEG_QUALITY, 80])
print("sheets:", (len(levels) + per - 1) // per)
