"""Align every sampled video frame to a reference frame (camera shake compensation)."""
import sys
import cv2
import numpy as np

VIDEO = "game.mp4"
REF_TIME = 45.0
STEP = 4  # analyse every 4th frame (5 fps)
# Lower screen incl. its border, in reference-frame pixels.
ROI = (100, 160, 380, 345)  # x0, y0, x1, y1


def prep(gray):
    return cv2.GaussianBlur(gray, (5, 5), 0).astype(np.float32)


def main():
    cap = cv2.VideoCapture(VIDEO)
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.set(cv2.CAP_PROP_POS_MSEC, REF_TIME * 1000)
    ok, ref = cap.read()
    assert ok
    ref_g = prep(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY))
    mask = np.zeros(ref_g.shape, np.uint8)
    x0, y0, x1, y1 = ROI
    mask[y0:y1, x0:x1] = 255

    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 100, 1e-5)
    warp = np.eye(2, 3, dtype=np.float32)
    times, warps, scores = [], [], []
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % STEP == 0:
            g = prep(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
            best = None
            for init in (warp, np.eye(2, 3, dtype=np.float32)):
                try:
                    cc, w = cv2.findTransformECC(ref_g, g, init.copy(), cv2.MOTION_AFFINE, criteria, mask, 5)
                except cv2.error:
                    continue
                if best is None or cc > best[0]:
                    best = (cc, w)
                if cc > 0.9:
                    break
            if best is None:
                best = (0.0, np.eye(2, 3, dtype=np.float32))
            else:
                warp = best[1]
            times.append(idx / fps)
            warps.append(best[1])
            scores.append(best[0])
        idx += 1
    np.savez("frames/warps.npz", times=np.array(times), warps=np.array(warps), scores=np.array(scores))
    s = np.array(scores)
    print(f"frames={len(s)} mean_cc={s.mean():.3f} below0.8={int((s < 0.8).sum())} below0.6={int((s < 0.6).sum())}")
    low = [f"{t:.1f}" for t, c in zip(times, scores) if c < 0.8]
    print("low:", " ".join(low[:80]))


if __name__ == "__main__":
    sys.exit(main())
