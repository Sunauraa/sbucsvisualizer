"""ULTRON main loop: look at something, make a hand gesture, it happens."""

import argparse
import time

import cv2
import numpy as np

from . import gestures as G
from . import mac
from .gaze import GazeModel, GazePipeline
from .vision import Tracker

PREVIEW = "ULTRON"
CALIB = "ULTRON calibration"

ACTIONS = {
    G.PINCH: ("open", mac.open_at),
    G.PALM: ("maximize", mac.maximize),
    G.FIST: ("minimize", mac.minimize),
    G.THUMBS_DOWN: ("close", mac.close),
}
COOLDOWN_S = 0.8


CALIB_POINTS = [
    (x, y)
    for row, y in enumerate([0.07, 0.36, 0.64, 0.93])
    for x in ([0.05, 0.275, 0.5, 0.725, 0.95][::1 if row % 2 == 0 else -1])  # snake order: short eye jumps
]
CHECK_POINTS = [(x, y) for y in (0.1, 0.5, 0.9) for x in (0.08, 0.5, 0.92)]


class FullScreen:
    def __init__(self, screen):
        self.W, self.H = screen
        cv2.namedWindow(CALIB, cv2.WINDOW_NORMAL)
        cv2.moveWindow(CALIB, 0, 0)
        cv2.setWindowProperty(CALIB, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

    def canvas(self, text=""):
        c = np.full((self.H, self.W, 3), 18, np.uint8)
        for i, line in enumerate(text.split("\n")):
            (tw, _), _ = cv2.getTextSize(line, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
            cv2.putText(c, line, ((self.W - tw) // 2, self.H // 2 - 120 + i * 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (210, 210, 210), 2)
        return c

    def show(self, c):
        cv2.imshow(CALIB, c)
        return cv2.waitKey(1) & 0xFF

    def px(self, pt):
        return int(pt[0] * self.W), int(pt[1] * self.H)

    def close(self):
        cv2.destroyWindow(CALIB)


def wait_key(fs, tracker, text, keys):
    while True:
        tracker.read()  # keep the camera and trackers warm
        k = fs.show(fs.canvas(text))
        if k in keys:
            return k


def collect(fs, tracker, extract, points, settle=0.7, dwell=1.1):
    """Show each dot; after it settles, record features. Returns (feats, targets, groups) or None on ESC."""
    feats, targets, groups = [], [], []
    for i, pt in enumerate(points):
        dot = fs.px(pt)
        t0 = time.monotonic()
        while (el := time.monotonic() - t0) < settle + dwell:
            out = tracker.read()
            c = fs.canvas()
            settling = el < settle
            radius = int(30 - 20 * min(el / settle, 1))
            cv2.circle(c, dot, radius, (80, 220, 255) if settling else (90, 255, 120), -1)
            cv2.circle(c, dot, 3, (0, 0, 0), -1)
            cv2.putText(c, f"{i + 1}/{len(points)}", (20, fs.H - 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (120, 120, 120), 2)
            if fs.show(c) == 27:
                return None
            if settling or out is None:
                continue
            frame, face, _ = out
            f = extract(face, frame.shape[1], frame.shape[0])
            if f is not None:
                feats.append(f)
                targets.append(dot)
                groups.append(i)
    return feats, targets, groups


def verify(fs, tracker, pipeline, err, screen):
    """Live gaze dot over reference marks, so you can judge before saving. Returns the key pressed."""
    pipeline.reset()
    gaze = None
    while True:
        out = tracker.read()
        if out is not None:
            frame, face, _ = out
            gaze = pipeline.update(face, frame.shape[1], frame.shape[0], screen) or gaze
        c = fs.canvas(f"Estimated error: ~{err:.0f}px. Look at the crosses to check.\n"
                      "SPACE keep   C redo   ESC cancel")
        for pt in CHECK_POINTS:
            x, y = fs.px(pt)
            cv2.drawMarker(c, (x, y), (110, 110, 110), cv2.MARKER_CROSS, 30, 2)
        if gaze:
            cv2.circle(c, gaze, max(int(err), 12), (80, 80, 255), 2)
            cv2.circle(c, gaze, 6, (80, 80, 255), -1)
        k = fs.show(c)
        if k in (32, 27, ord("c")):
            return k


def calibrate(tracker, pipeline, screen):
    """Full calibration. On success replaces pipeline.model and saves it. Returns True if a model was saved."""
    fs = FullScreen(screen)
    try:
        if wait_key(fs, tracker, "Sit how you normally sit. Keep your head still and follow each dot with your EYES.\n"
                                 "Good, even light on your face helps a lot.\n\nSPACE start   ESC cancel", (32, 27)) == 27:
            return False
        while True:
            samples = collect(fs, tracker, pipeline.extract, CALIB_POINTS)
            if samples is None:
                return False
            feats, targets, groups = samples
            if len(set(groups)) < len(CALIB_POINTS) - 2 or len(feats) < 150:
                if wait_key(fs, tracker, "Couldn't see your eyes well enough. Check lighting / camera angle.\n\n"
                                         "SPACE retry   ESC cancel", (32, 27)) == 27:
                    return False
                continue
            candidate = GazeModel()
            err = candidate.fit(feats, targets, groups)
            k = verify(fs, tracker, GazePipeline(candidate, pipeline.extract), err, screen)
            if k == 32:
                pipeline.model = candidate
                pipeline.reset()
                candidate.save(screen)
                print(f"Calibrated on {len(feats)} samples, estimated error ~{err:.0f}px")
                return True
            if k == 27:
                return False
    finally:
        fs.close()


def drift_fix(tracker, pipeline, screen):
    """Quick 1-dot re-centering for when you've shifted since calibrating."""
    fs = FullScreen(screen)
    try:
        center = (0.5, 0.5)
        samples = collect(fs, tracker, pipeline.extract, [center], settle=0.8, dwell=1.4)
        if not samples or len(samples[0]) < 10:
            return False
        preds = np.array([pipeline.model.predict(f, with_offset=False) for f in samples[0]])
        pipeline.model.offset = np.array(fs.px(center), float) - np.median(preds, 0)
        pipeline.model.save(screen)
        pipeline.reset()
        print(f"Drift fixed: offset {pipeline.model.offset.round()}")
        return True
    finally:
        fs.close()


def draw_preview(frame, hand_pts, state):
    view = cv2.flip(frame, 1)
    h, w = view.shape[:2]
    if hand_pts is not None:
        for x, y in hand_pts:
            cv2.circle(view, (int(w - x), int(y)), 4, (90, 255, 120), -1)
    overlay = [
        ("PAUSED (thumbs up to resume)" if state["paused"] else "ARMED", (0, 160, 255) if state["paused"] else (90, 255, 120)),
        (f"gaze: {state['gaze']}", (230, 230, 230)),
        (f"target: {state['target']}", (230, 230, 230)),
        (f"gesture: {state['gesture']}", (80, 220, 255)),
        (f"last: {state['last']}", (200, 200, 200)),
        ("q quit  c calibrate  r drift-fix  m cursor  p pause", (150, 150, 150)),
    ]
    for i, (text, color) in enumerate(overlay):
        cv2.putText(view, text, (16, 34 + i * 32), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
    if state["progress"] > 0:
        cv2.rectangle(view, (16, h - 40), (16 + int((w - 32) * state["progress"]), h - 20), (80, 220, 255), -1)
    small = cv2.resize(view, (480, int(480 * h / w)))
    cv2.imshow(PREVIEW, small)


def run(args):
    if not args.dry_run and not mac.ensure_accessibility():
        print("Grant Accessibility permission to your terminal app "
              "(System Settings > Privacy & Security > Accessibility), then rerun.")
        return
    screen = mac.main_screen_size()
    tracker = Tracker(args.camera)
    model = GazeModel()
    pipeline = GazePipeline(model)
    hold = G.HoldDetector()

    if args.calibrate or not model.load(screen):
        if not calibrate(tracker, pipeline, screen) and not pipeline.model.ready:
            tracker.close()
            return

    cv2.namedWindow(PREVIEW)
    cv2.moveWindow(PREVIEW, screen[0] - 500, screen[1] - 420)
    follow = not args.no_cursor
    paused = False
    gaze = None
    locked = None
    last_action_t = 0.0
    last_msg = "-"

    try:
        while True:
            out = tracker.read()
            if out is None:
                print("Camera read failed.")
                break
            frame, face, hands = out
            fh, fw = frame.shape[:2]

            new_gaze = pipeline.update(face, fw, fh, screen)
            if new_gaze is not None and new_gaze != gaze:
                gaze = new_gaze
                if follow and not paused:
                    mac.move_cursor(*gaze)

            raw, hand_pts = G.classify(hands, fw, fh)
            gesture, fired, started, progress = hold.update(raw)

            if started and gaze is not None:
                # Lock the target where you were looking when the gesture began.
                locked = mac.window_at(*gaze) or mac.Target(0, "screen", (0, 0, *screen), gaze)

            if fired == G.THUMBS_UP:
                paused = not paused
                last_msg = "paused" if paused else "resumed"
            elif fired in ACTIONS and not paused and locked and time.monotonic() - last_action_t > COOLDOWN_S:
                name, fn = ACTIONS[fired]
                if fired != G.PINCH and locked.pid == 0:
                    last_msg = f"{name}: no window there"
                elif args.dry_run:
                    last_msg = f"[dry-run] {name} -> {locked.app} @ {locked.point}"
                else:
                    last_msg = fn(locked)
                last_action_t = time.monotonic()
                print(last_msg)

            hover = mac.window_at(*gaze) if gaze else None
            draw_preview(frame, hand_pts, dict(
                paused=paused, gaze=gaze, target=hover.app if hover else "-",
                gesture=gesture, progress=0 if paused and gesture != G.THUMBS_UP else progress, last=last_msg))

            k = cv2.waitKey(1) & 0xFF
            if k in (ord("q"), 27):
                break
            elif k == ord("c"):
                calibrate(tracker, pipeline, screen)
            elif k == ord("r"):
                drift_fix(tracker, pipeline, screen)
            elif k == ord("m"):
                follow = not follow
            elif k == ord("p"):
                paused = not paused
    finally:
        tracker.close()
        cv2.destroyAllWindows()


def main():
    ap = argparse.ArgumentParser(prog="ultron", description="Utterly Lazy, Typing Refused, Obviously Not-clicking")
    ap.add_argument("--camera", type=int, default=0, help="camera index (default 0)")
    ap.add_argument("--calibrate", action="store_true", help="force a fresh gaze calibration")
    ap.add_argument("--dry-run", action="store_true", help="show what would happen without touching windows")
    ap.add_argument("--no-cursor", action="store_true", help="don't move the mouse cursor to follow your gaze")
    run(ap.parse_args())
