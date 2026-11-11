"""Build darkest/median images of the aligned lower screen to locate all wall segments."""
import cv2
import numpy as np

VIDEO = "game.mp4"
CROP = (130, 180, 350, 325)  # x0, y0, x1, y1 in reference pixels
SCALE = 4


def aligned_crops(min_cc=0.85, every=5):
    d = np.load("frames/warps.npz")
    cap = cv2.VideoCapture(VIDEO)
    fps = cap.get(cv2.CAP_PROP_FPS)
    x0, y0, x1, y1 = CROP
    # Shift so the crop's top-left becomes the origin, then upscale.
    post = np.array([[SCALE, 0, -x0 * SCALE], [0, SCALE, -y0 * SCALE], [0, 0, 1]], np.float64)
    size = ((x1 - x0) * SCALE, (y1 - y0) * SCALE)
    for i, (t, w, cc) in enumerate(zip(d["times"], d["warps"], d["scores"])):
        if i % every or cc < min_cc:
            continue
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
        ok, frame = cap.read()
        if not ok:
            continue
        # ECC warp maps reference -> frame, so sample frame with WARP_INVERSE_MAP.
        m = np.vstack([w, [0, 0, 1]]).astype(np.float64)
        full = np.linalg.inv(post @ np.linalg.inv(m))
        yield t, cv2.warpAffine(frame, full[:2], size, flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)


def main():
    stack = [cv2.cvtColor(c, cv2.COLOR_BGR2GRAY) for _, c in aligned_crops()]
    stack = np.array(stack)
    print("frames used:", len(stack))
    cv2.imwrite("frames/calib_min.png", np.percentile(stack, 5, axis=0).astype(np.uint8))
    cv2.imwrite("frames/calib_median.png", np.median(stack, axis=0).astype(np.uint8))


if __name__ == "__main__":
    main()
