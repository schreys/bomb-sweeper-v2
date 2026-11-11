"""Measure darkness just outside every boundary edge (where bombs sit) for every sampled frame."""
import importlib.util
import cv2
import numpy as np

spec = importlib.util.spec_from_file_location("ex", "tools/extract.py")
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)

OUT = 0.45  # offset outward, as a fraction of the cell size


def boundary_edges():
    """(key, centre, half-size) for the 20 boundary edges."""
    for c in range(ex.COLS):
        yield f"h0{c}", ex.grid_point(0, c), ex.grid_point(0, c + 1), (0, -1)
        yield f"h4{c}", ex.grid_point(4, c), ex.grid_point(4, c + 1), (0, 1)
    for r in range(ex.ROWS):
        yield f"v{r}0", ex.grid_point(r, 0), ex.grid_point(r + 1, 0), (-1, 0)
        yield f"v{r}6", ex.grid_point(r, 6), ex.grid_point(r + 1, 6), (1, 0)


def masks(shape):
    out = []
    for key, p0, p1, (dx, dy) in boundary_edges():
        mid = (p0 + p1) / 2
        length = np.linalg.norm(p1 - p0)
        cell = 100.0
        ctr = mid + np.array([dx, dy]) * cell * OUT
        m = np.zeros(shape, np.uint8)
        axes = (int(length * 0.3), int(cell * 0.22)) if dy else (int(cell * 0.22), int(length * 0.3))
        cv2.ellipse(m, tuple(np.round(ctr).astype(int)), axes, 0, 0, 360, 255, -1)
        out.append((key, m > 0))
    return out


def main():
    calib = cv2.imread("frames/calib_min.png", cv2.IMREAD_GRAYSCALE)
    ms = masks(calib.shape)
    vis = cv2.cvtColor(calib, cv2.COLOR_GRAY2BGR)
    for _, m in ms:
        vis[m] = (0.5 * vis[m] + [0, 0, 120]).astype(np.uint8)
    cv2.imwrite("frames/outside_masks.png", vis)

    d = np.load("frames/warps.npz")
    cap = cv2.VideoCapture(ex.VIDEO)
    x0, y0, x1, y1 = ex.CROP
    post = np.array([[ex.SCALE, 0, -x0 * ex.SCALE], [0, ex.SCALE, -y0 * ex.SCALE], [0, 0, 1]], np.float64)
    size = ((x1 - x0) * ex.SCALE, (y1 - y0) * ex.SCALE)
    feats, idx, k = [], 0, 0
    while k < len(d["times"]):
        ok, frame = cap.read()
        if not ok:
            break
        if idx % 4 == 0:
            m = np.vstack([d["warps"][k], [0, 0, 1]]).astype(np.float64)
            g = cv2.cvtColor(cv2.warpAffine(frame, (m @ np.linalg.inv(post))[:2], size,
                                            flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP), cv2.COLOR_BGR2GRAY)
            dark = 255 - g.astype(np.float32)
            feats.append([dark[mm].mean() for _, mm in ms])
            k += 1
        idx += 1
    np.savez("frames/outside.npz", feats=np.array(feats), keys=np.array([kk for kk, _ in ms]))
    print("frames:", len(feats))


if __name__ == "__main__":
    main()
