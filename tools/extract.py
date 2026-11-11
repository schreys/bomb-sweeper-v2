"""Read wall segment states from every aligned frame of the video."""
import cv2
import numpy as np

VIDEO = "game.mp4"
CROP = (130, 180, 350, 325)
SCALE = 4
ROWS, COLS = 4, 6
# Grid corners in the 4x calibration image (TL, TR, BL, BR), read from calib_min.png.
CORNERS = np.float32([[133, 143], [757, 143], [117, 487], [773, 487]])
SEG_LEN = 0.55  # fraction of cell edge sampled
THICK = 8
SEARCH = 10


def grid_point(r, c):
    """Bilinear interpolation of the grid corners; r in 0..ROWS, c in 0..COLS."""
    u, v = c / COLS, r / ROWS
    tl, tr, bl, br = CORNERS
    top = tl + (tr - tl) * u
    bot = bl + (br - bl) * u
    return top + (bot - top) * v


def segments():
    """Yield (kind, r, c, p0, p1) for every wall segment in the grid."""
    for r in range(ROWS + 1):
        for c in range(COLS):
            yield "h", r, c, grid_point(r, c), grid_point(r, c + 1)
    for r in range(ROWS):
        for c in range(COLS + 1):
            yield "v", r, c, grid_point(r, c), grid_point(r + 1, c)


def strip_mask(shape, p0, p1, offset, thick):
    d = p1 - p0
    n = np.array([-d[1], d[0]]) / np.linalg.norm(d)
    mid = (p0 + p1) / 2 + n * offset
    half = d * SEG_LEN / 2
    a, b = mid - half, mid + half
    m = np.zeros(shape, np.uint8)
    cv2.line(m, tuple(np.round(a).astype(int)), tuple(np.round(b).astype(int)), 255, thick)
    return m > 0


def build_masks(calib):
    dark = 255 - calib.astype(np.float32)
    masks = []
    for kind, r, c, p0, p1 in segments():
        best = max(range(-SEARCH, SEARCH + 1), key=lambda o: dark[strip_mask(dark.shape, p0, p1, o, THICK)].mean())
        on = strip_mask(dark.shape, p0, p1, best, THICK)
        bg = strip_mask(dark.shape, p0, p1, best + 14, 6) | strip_mask(dark.shape, p0, p1, best - 14, 6)
        masks.append((kind, r, c, on, bg))
    return masks


def cell_masks(shape):
    out = []
    for r in range(ROWS):
        for c in range(COLS):
            p = [grid_point(r + dr, c + dc) for dr in (0, 1) for dc in (0, 1)]
            ctr = np.mean(p, axis=0)
            w = np.linalg.norm(p[1] - p[0]) * 0.3
            h = np.linalg.norm(p[2] - p[0]) * 0.3
            m = np.zeros(shape, np.uint8)
            cv2.ellipse(m, (tuple(np.round(ctr).astype(int))), (int(w), int(h)), 0, 0, 360, 255, -1)
            out.append(m > 0)
    return out


def overlay(img, states, masks):
    out = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR) if img.ndim == 2 else img.copy()
    for (kind, r, c, on, _), s in zip(masks, states):
        color = (0, 0, 255) if s else (0, 200, 0)
        out[on] = (0.4 * out[on] + 0.6 * np.array(color)).astype(np.uint8)
    return out


def main():
    calib = cv2.imread("frames/calib_min.png", cv2.IMREAD_GRAYSCALE)
    masks = build_masks(calib)
    cv2.imwrite("frames/calib_masks.png", overlay(calib, [1] * len(masks), masks))

    d = np.load("frames/warps.npz")
    cap = cv2.VideoCapture(VIDEO)
    x0, y0, x1, y1 = CROP
    post = np.array([[SCALE, 0, -x0 * SCALE], [0, SCALE, -y0 * SCALE], [0, 0, 1]], np.float64)
    size = ((x1 - x0) * SCALE, (y1 - y0) * SCALE)
    cells = cell_masks(calib.shape)
    feats, cfeats = [], []
    idx = k = 0
    while k < len(d["times"]):
        ok, frame = cap.read()
        if not ok:
            break
        if idx % 4 == 0:
            m = np.vstack([d["warps"][k], [0, 0, 1]]).astype(np.float64)
            full = m @ np.linalg.inv(post)
            g = cv2.cvtColor(cv2.warpAffine(frame, full[:2], size, flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP), cv2.COLOR_BGR2GRAY)
            dark = 255 - g.astype(np.float32)
            feats.append([dark[on].mean() - dark[bg].mean() for *_, on, bg in masks])
            cfeats.append([dark[cm].mean() for cm in cells])
            k += 1
        idx += 1
    np.savez("frames/features.npz", times=d["times"][: len(feats)], feats=np.array(feats), cells=np.array(cfeats),
             kinds=np.array([f"{kd}{r}{c}" for kd, r, c, *_ in masks]))
    print("frames:", len(feats))


if __name__ == "__main__":
    main()
