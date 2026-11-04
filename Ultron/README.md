# ULTRON

**U**tterly **L**azy, **T**yping **R**efused, **O**bviously **N**ot-clicking.

Look at a window, tab, link or Dock icon, then make a hand gesture at your webcam. macOS only.

| Gesture (hold it) | Action |
|---|---|
| 👌 thumb + index touching, other fingers up | **Open**: click what you're looking at (a link, a tab, a Dock icon) |
| ✋ open palm | **Maximize** the window (do it again to restore) |
| ✊ fist | **Minimize** the window |
| 👎 thumbs down (1 s) | **Close**: Cmd+W. If you look at a tab in the tab bar, that tab is closed |
| 👍 thumbs up (1 s) | Pause / resume ULTRON |

The target is locked to where you were looking when the gesture *started*, so your eyes can wander while you hold it.

## Setup

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python -m ultron --dry-run   # try it without touching any windows
.venv/bin/python -m ultron
```

Give your terminal app **Camera** and **Accessibility** permission (System Settings > Privacy & Security). Models download into `models/` on first run.

On first run you'll calibrate: follow 20 dots with your eyes, keeping your head still. Then a check screen shows a live dot where ULTRON thinks you're looking, so you can try it before saving: SPACE keeps it, C redoes it. The result is saved to `calibration.npz`.

- Slightly off after shifting in your seat: press `r` (look at one dot, about 2 s) to re-center.
- Moved the laptop, the chair or the lighting: press `c` (or run with `--calibrate`) to recalibrate fully.

Preview window keys: `q` quit, `c` calibrate, `r` drift fix, `m` toggle cursor-follows-gaze, `p` pause.

Options: `--camera N`, `--calibrate`, `--dry-run`, `--no-cursor`.

## How it works

- `ultron/vision.py`: webcam + MediaPipe face and hand landmarkers
- `ultron/gaze.py`: iris position in each eye, eyelid opening, MediaPipe's eye-direction scores and head pose, mapped to screen pixels by a ridge regression. Calibration drops junk samples (blinks, eyes still moving) and tests the model on dots it didn't learn from to pick the best settings. The output is smoothed (One Euro filter), then held steady while you look at one spot and moved only once your eyes clearly jump somewhere else
- `ultron/gestures.py`: hand pose classification with hold-to-fire
- `ultron/mac.py`: finds the window under your gaze (Quartz) and acts on it (Accessibility API, synthetic clicks/keys)
- `ultron/app.py`: main loop, calibration screen, preview

## Limits

A webcam isn't an eye tracker: expect gaze accuracy of roughly 1 to 3 cm on screen after a good calibration. Windows and browser tabs are easy targets; small links are hit or miss. The cursor follows your gaze by default so you can see where ULTRON thinks you're looking. Gaze is calibrated on the main display only.
