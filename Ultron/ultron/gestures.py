"""Static hand-pose classification + hold-to-fire debouncing."""

import time
from collections import Counter, deque

import numpy as np

NONE, PINCH, PALM, FIST, THUMBS_DOWN, THUMBS_UP = "none", "pinch", "palm", "fist", "thumbs_down", "thumbs_up"

# How long a pose must be held before it fires (seconds). Destructive = longer.
HOLD = {PINCH: 0.25, PALM: 0.7, FIST: 0.7, THUMBS_DOWN: 1.0, THUMBS_UP: 1.0}

FINGERS = [(8, 6), (12, 10), (16, 14), (20, 18)]  # (tip, pip) for index..pinky


def classify(hand_result, frame_w, frame_h):
    if not hand_result.hand_landmarks:
        return NONE, None
    lm = hand_result.hand_landmarks[0]
    p = np.array([[l.x * frame_w, l.y * frame_h] for l in lm])
    d = lambda a, b: np.linalg.norm(p[a] - p[b])
    palm = d(0, 9)
    if palm < 1:
        return NONE, p

    up = [d(0, tip) > d(0, pip) * 1.1 for tip, pip in FINGERS]
    n_up = sum(up)
    thumb_out = d(4, 5) > 0.55 * palm

    if d(4, 8) < 0.25 * palm and sum(up[1:]) >= 2:
        return PINCH, p  # 👌 thumb + index touching, others up
    if n_up == 4 and thumb_out:
        return PALM, p
    if n_up == 0:
        if thumb_out and p[4, 1] > p[2, 1] + 0.3 * palm:
            return THUMBS_DOWN, p
        if thumb_out and p[4, 1] < p[2, 1] - 0.3 * palm:
            return THUMBS_UP, p
        if not thumb_out:
            return FIST, p
    return NONE, p


class HoldDetector:
    """Fires a gesture once after it has been held for HOLD[g] seconds."""

    def __init__(self, window=5):
        self.current, self.since, self.fired = NONE, 0.0, False
        self.recent = deque(maxlen=window)

    def update(self, raw_gesture, now=None):
        """Returns (stable_gesture, fired_gesture_or_None, started: bool, progress 0..1)."""
        now = time.monotonic() if now is None else now
        # Majority vote over the last few frames so a single misread doesn't reset a hold.
        self.recent.append(raw_gesture)
        gesture = Counter(self.recent).most_common(1)[0][0]
        fired, started, progress = self._step(gesture, now)
        return gesture, fired, started, progress

    def _step(self, gesture, now):
        started = False
        if gesture != self.current:
            self.current, self.since, self.fired = gesture, now, False
            started = gesture != NONE
        if gesture == NONE or self.fired:
            return None, started, 0.0
        progress = min((now - self.since) / HOLD[gesture], 1.0)
        if progress >= 1.0:
            self.fired = True
            return gesture, started, 1.0
        return None, started, progress
