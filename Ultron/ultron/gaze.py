"""Webcam gaze estimation: eye/head features -> calibrated screen point.

A plain webcam is not an eye tracker; after a good calibration expect roughly
1-3 cm of error on screen. Good enough to pick windows, tabs and big links.
Recalibrate if you move your chair or laptop; press `r` for a quick drift fix.
"""

from collections import deque
from pathlib import Path

import numpy as np

CALIB_FILE = Path(__file__).resolve().parent.parent / "calibration.npz"
CALIB_VERSION = 2

# MediaPipe face mesh indices (refined, 478 points)
R_EYE = dict(outer=33, inner=133, top=159, bottom=145, iris=468)
L_EYE = dict(outer=263, inner=362, top=386, bottom=374, iris=473)
LOOK_SHAPES = [f"eyeLook{d}{s}" for d in ("Up", "Down", "In", "Out") for s in ("Left", "Right")]
BLINK_FRACTION = 0.5  # eyes this much narrower than usual = blink, not "looking down"
CV_ALPHAS = [0.01, 0.1, 0.3, 1, 3, 10, 30, 100]


def _eye(lm, idx, w, h):
    p = {k: np.array([lm[i].x * w, lm[i].y * h]) for k, i in idx.items()}
    axis = p["inner"] - p["outer"]
    width = np.linalg.norm(axis)
    if width < 1e-3:
        return None
    ux = axis / width
    uy = np.array([-ux[1], ux[0]])
    rel = p["iris"] - (p["outer"] + p["inner"]) / 2
    openness = np.linalg.norm(p["bottom"] - p["top"]) / width
    return rel @ ux / width, rel @ uy / width, openness


class FeatureExtractor:
    """Per-frame feature vector. Tracks your normal eye openness to tell blinks from looking down."""

    def __init__(self):
        self.open_baseline = None

    def __call__(self, face_result, frame_w, frame_h):
        if not face_result.face_landmarks:
            return None
        lm = face_result.face_landmarks[0]
        r, l = _eye(lm, R_EYE, frame_w, frame_h), _eye(lm, L_EYE, frame_w, frame_h)
        if r is None or l is None:
            return None
        openness = (r[2] + l[2]) / 2
        if self.open_baseline is None:
            self.open_baseline = openness
        if openness < BLINK_FRACTION * self.open_baseline:
            return None
        self.open_baseline += 0.02 * (openness - self.open_baseline)

        # Eye axes point outer->inner, so the left eye's frame is mirrored (both axes).
        ex = (r[0] - l[0]) / 2
        ey = (r[1] - l[1]) / 2
        m = np.array(face_result.facial_transformation_matrixes[0])
        fx, fy = m[0, 2], m[1, 2]  # head forward direction
        tx, ty, tz = m[0, 3], m[1, 3], m[2, 3]  # head position (cm)
        shapes = {}
        if face_result.face_blendshapes:
            shapes = {c.category_name: c.score for c in face_result.face_blendshapes[0]}
        looks = [shapes.get(name, 0.0) for name in LOOK_SHAPES]
        # openness is in here on purpose: lid height tracks vertical gaze better than the iris does.
        return np.array([ex, ey, openness, fx, fy, tx, ty, tz, *looks])


def _expand(f):
    f = np.atleast_2d(f)
    core = f[:, [0, 1, 3, 4]]  # ex, ey, fx, fy
    i, j = np.triu_indices(core.shape[1])
    return np.column_stack([f, core[:, i] * core[:, j]])


def _solve(X, T, alpha):
    mu, sd = X.mean(0), X.std(0) + 1e-9
    Xn = np.column_stack([np.ones(len(X)), (X - mu) / sd])
    reg = alpha * np.eye(Xn.shape[1])
    reg[0, 0] = 0
    return mu, sd, np.linalg.solve(Xn.T @ Xn + reg, Xn.T @ T)


def _apply(X, mu, sd, W):
    return np.column_stack([np.ones(len(X)), (X - mu) / sd]) @ W


def _drop_outliers(F, groups):
    """Within each calibration point, drop samples whose eye features are far from the median
    (late saccades, half-blinks, glances away)."""
    keep = np.ones(len(F), bool)
    for g in np.unique(groups):
        m = groups == g
        eye = F[m][:, :2]
        med = np.median(eye, 0)
        mad = np.median(np.abs(eye - med), 0) * 1.4826 + 1e-6
        keep[m] = (np.abs(eye - med) / mad).max(1) < 3
    return keep


class GazeModel:
    def __init__(self):
        self.mu = self.sd = self.W = None
        self.offset = np.zeros(2)
        self.noise = 40.0  # per-frame jitter of predictions while staring at one dot (px)

    @property
    def ready(self):
        return self.W is not None

    def fit(self, feats, targets, groups):
        """Fit with ridge strength picked by leave-one-point-out CV. Returns honest median error (px)."""
        F, T, g = np.asarray(feats), np.asarray(targets, float), np.asarray(groups)
        keep = _drop_outliers(F, g)
        X, T, g = _expand(F[keep]), T[keep], g[keep]
        best = (np.inf, None)
        for alpha in CV_ALPHAS:
            errs = []
            for held in np.unique(g):
                tr = g != held
                pred = _apply(X[~tr], *_solve(X[tr], T[tr], alpha))
                errs.append(np.linalg.norm(pred - T[~tr], axis=1))
            err = float(np.median(np.concatenate(errs)))
            if err < best[0]:
                best = (err, alpha)
        self.mu, self.sd, self.W = _solve(X, T, best[1])
        self.offset = np.zeros(2)
        pred = _apply(X, self.mu, self.sd, self.W)
        jitter = [np.linalg.norm(pred[g == k] - np.median(pred[g == k], 0), axis=1) for k in np.unique(g)]
        self.noise = float(np.median(np.concatenate(jitter)))
        return best[0]

    def predict(self, f, with_offset=True):
        p = _apply(_expand(f), self.mu, self.sd, self.W)[0]
        return p + self.offset if with_offset else p

    def save(self, screen_size):
        np.savez(CALIB_FILE, mu=self.mu, sd=self.sd, W=self.W, offset=self.offset, noise=self.noise,
                 screen=np.array(screen_size), version=CALIB_VERSION)

    def load(self, screen_size):
        if not CALIB_FILE.exists():
            return False
        d = np.load(CALIB_FILE)
        if "version" not in d or int(d["version"]) != CALIB_VERSION or tuple(d["screen"]) != tuple(screen_size):
            return False
        self.mu, self.sd, self.W, self.offset = d["mu"], d["sd"], d["W"], d["offset"]
        self.noise = float(d["noise"]) if "noise" in d.files else self.noise
        return True


class Fixation:
    """Keeps the point perfectly still while you look at one spot.

    Eyes either hold still (fixation) or jump (saccade). Per-frame wobble is noise, so we
    look at the last few frames: the point only moves when they agree on a spot that is
    clearly somewhere else. `noise` is your per-frame jitter in px, measured at calibration.
    """

    def __init__(self, noise=40.0, window=6, confirm=3):
        self.radius = float(np.clip(3 * noise, 60, 300))
        self.recent = deque(maxlen=window)
        self.confirm = confirm
        self.anchor = None
        self.away = 0

    def __call__(self, p):
        self.recent.append(np.asarray(p, float))
        pts = np.array(self.recent)
        center = np.median(pts, 0)
        if self.anchor is None:
            self.anchor = center
        elif len(pts) == self.recent.maxlen:
            spread = np.median(np.linalg.norm(pts - center, axis=1))
            settled = spread < 0.7 * self.radius  # eyes resting somewhere, not mid-jump
            if settled and np.linalg.norm(center - self.anchor) > 0.6 * self.radius:
                self.away += 1
                if self.away >= self.confirm:
                    self.anchor, self.away = center, 0
            else:
                self.away = 0
        return self.anchor


class GazePipeline:
    """features -> model -> fixation hold."""

    def __init__(self, model, extract=None):
        self.model = model
        self.extract = extract or FeatureExtractor()
        self.reset()

    def reset(self):
        self.fixation = Fixation(self.model.noise)

    def update(self, face_result, frame_w, frame_h, screen):
        f = self.extract(face_result, frame_w, frame_h)
        if f is None:
            return None
        p = np.clip(self.model.predict(f), [0, 0], [screen[0] - 1, screen[1] - 1])
        return tuple(int(v) for v in self.fixation(p))
