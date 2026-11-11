"""Render aligned frame crops with detected walls overlaid: overlay.py OUT T1 [T2 ...]"""
import sys
import cv2
import numpy as np

sys.argv, args = sys.argv[:1], sys.argv[1:]
import importlib.util

spec = importlib.util.spec_from_file_location("ex", "tools/extract.py")
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)
an_src = open("tools/analyze.py").read().split("# Temporal median")[0].replace("print(", "(lambda *a, **k: None)(")
ns = {}
exec(an_src, ns)

calib = cv2.imread("frames/calib_min.png", cv2.IMREAD_GRAYSCALE)
masks = ex.build_masks(calib)
d = np.load("frames/warps.npz")
cap = cv2.VideoCapture(ex.VIDEO)
fps = cap.get(cv2.CAP_PROP_FPS)
x0, y0, x1, y1 = ex.CROP
post = np.array([[ex.SCALE, 0, -x0 * ex.SCALE], [0, ex.SCALE, -y0 * ex.SCALE], [0, 0, 1]], np.float64)
size = ((x1 - x0) * ex.SCALE, (y1 - y0) * ex.SCALE)

out_path, ts = args[0], [float(t) for t in args[1:]]
tiles = []
for t in ts:
    k = int(np.argmin(abs(d["times"] - t)))
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(d["times"][k] * fps)))
    ok, frame = cap.read()
    m = np.vstack([d["warps"][k], [0, 0, 1]]).astype(np.float64)
    img = cv2.warpAffine(frame, (m @ np.linalg.inv(post))[:2], size, flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)
    raw = img.copy()
    over = ex.overlay(img, ns["on"][k], masks)
    tile = np.hstack([raw, over])
    tile = cv2.resize(tile, (tile.shape[1] // 2, tile.shape[0] // 2))
    cv2.putText(tile, f"{t:.1f}s", (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
    tiles.append(tile)
cv2.imwrite(out_path, np.vstack(tiles))
