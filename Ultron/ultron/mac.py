"""macOS window control: find the window under a point and act on it.

Uses the Accessibility (AX) API for window ops and Quartz for synthetic input.
The terminal running ULTRON needs Accessibility permission
(System Settings > Privacy & Security > Accessibility).
"""

import os
import time
from dataclasses import dataclass

import AppKit
import ApplicationServices as AX
import Quartz

OWN_PID = os.getpid()
KEY_W = 13  # kVK_ANSI_W
TAB_STRIP_HEIGHT = 90  # px from a window's top edge counted as title/tab bar


@dataclass
class Target:
    pid: int
    app: str
    bounds: tuple  # (x, y, w, h) in global top-left coordinates
    point: tuple  # the gaze point that selected this window

    @property
    def in_tab_strip(self):
        return self.point[1] - self.bounds[1] < TAB_STRIP_HEIGHT


def ensure_accessibility(prompt=True):
    opts = {AX.kAXTrustedCheckOptionPrompt: prompt}
    return AX.AXIsProcessTrustedWithOptions(opts)


def main_screen_size():
    b = Quartz.CGDisplayBounds(Quartz.CGMainDisplayID())
    return int(b.size.width), int(b.size.height)


def window_at(x, y):
    """Topmost normal window containing (x, y), skipping our own windows."""
    opts = Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements
    for w in Quartz.CGWindowListCopyWindowInfo(opts, Quartz.kCGNullWindowID) or []:
        if w.get("kCGWindowLayer", 0) != 0 or w.get("kCGWindowOwnerPID") == OWN_PID:
            continue
        b = w["kCGWindowBounds"]
        bx, by, bw, bh = b["X"], b["Y"], b["Width"], b["Height"]
        if bw < 50 or bh < 50:
            continue
        if bx <= x < bx + bw and by <= y < by + bh:
            return Target(w["kCGWindowOwnerPID"], w.get("kCGWindowOwnerName", "?"),
                          (bx, by, bw, bh), (x, y))
    return None


# --- AX helpers -------------------------------------------------------------

def _get(elem, attr):
    err, val = AX.AXUIElementCopyAttributeValue(elem, attr, None)
    return val if err == 0 else None


def _point(val):
    return AX.AXValueGetValue(val, AX.kAXValueCGPointType, None)[1]


def _size(val):
    return AX.AXValueGetValue(val, AX.kAXValueCGSizeType, None)[1]


def _set_frame(win, x, y, w, h):
    AX.AXUIElementSetAttributeValue(win, "AXPosition", AX.AXValueCreate(AX.kAXValueCGPointType, Quartz.CGPoint(x, y)))
    AX.AXUIElementSetAttributeValue(win, "AXSize", AX.AXValueCreate(AX.kAXValueCGSizeType, Quartz.CGSize(w, h)))
    # Some apps clamp size against the old position; setting position again settles it.
    AX.AXUIElementSetAttributeValue(win, "AXPosition", AX.AXValueCreate(AX.kAXValueCGPointType, Quartz.CGPoint(x, y)))


def _frame(win):
    pos, size = _get(win, "AXPosition"), _get(win, "AXSize")
    if pos is None or size is None:
        return None
    p, s = _point(pos), _size(size)
    return (p.x, p.y, s.width, s.height)


def _ax_window(target):
    """Match the CGWindow bounds to one of the app's AX windows."""
    app = AX.AXUIElementCreateApplication(target.pid)
    best, best_d = None, 1e9
    for win in _get(app, "AXWindows") or []:
        f = _frame(win)
        if f is None:
            continue
        d = sum(abs(a - b) for a, b in zip(f, target.bounds))
        if d < best_d:
            best, best_d = win, d
    return app, (best if best_d < 40 else None)


def _visible_frame_for(x, y):
    """Visible frame (minus menu bar / Dock) of the screen containing (x, y), top-left coords."""
    primary_h = AppKit.NSScreen.screens()[0].frame().size.height
    for scr in AppKit.NSScreen.screens():
        f, v = scr.frame(), scr.visibleFrame()
        top = primary_h - (f.origin.y + f.size.height)
        if f.origin.x <= x < f.origin.x + f.size.width and top <= y < top + f.size.height:
            return (v.origin.x, primary_h - (v.origin.y + v.size.height), v.size.width, v.size.height)
    v = AppKit.NSScreen.mainScreen().visibleFrame()
    return (v.origin.x, primary_h - (v.origin.y + v.size.height), v.size.width, v.size.height)


def _focus(app, win, pid):
    AX.AXUIElementSetAttributeValue(app, "AXFrontmost", True)
    AX.AXUIElementPerformAction(win, "AXRaise")
    AX.AXUIElementSetAttributeValue(win, "AXMain", True)
    running = AppKit.NSRunningApplication.runningApplicationWithProcessIdentifier_(pid)
    if running:
        running.activateWithOptions_(AppKit.NSApplicationActivateIgnoringOtherApps)


# --- synthetic input --------------------------------------------------------

def move_cursor(x, y):
    ev = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, (x, y), Quartz.kCGMouseButtonLeft)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, ev)


def click(x, y):
    for kind in (Quartz.kCGEventLeftMouseDown, Quartz.kCGEventLeftMouseUp):
        ev = Quartz.CGEventCreateMouseEvent(None, kind, (x, y), Quartz.kCGMouseButtonLeft)
        Quartz.CGEventPost(Quartz.kCGHIDEventTap, ev)
        time.sleep(0.02)


def cmd_key(keycode):
    for down in (True, False):
        ev = Quartz.CGEventCreateKeyboardEvent(None, keycode, down)
        Quartz.CGEventSetFlags(ev, Quartz.kCGEventFlagMaskCommand)
        Quartz.CGEventPost(Quartz.kCGHIDEventTap, ev)
        time.sleep(0.02)


# --- actions ----------------------------------------------------------------

_restore_frames = {}  # window bounds after maximize -> bounds before


def open_at(target):
    """'Open' = click whatever is under the gaze: a link, a tab, a Dock icon, a window."""
    click(*target.point)
    return f"opened/clicked in {target.app}"


def maximize(target):
    app, win = _ax_window(target)
    if win is None:
        return f"no AX window for {target.app}"
    _focus(app, win, target.pid)
    cur = _frame(win)
    key = tuple(round(v) for v in cur)
    if key in _restore_frames:  # already maximized by us -> restore
        _set_frame(win, *_restore_frames.pop(key))
        return f"restored {target.app}"
    vis = _visible_frame_for(*target.point)
    _set_frame(win, *vis)
    new = _frame(win)
    if new:
        _restore_frames[tuple(round(v) for v in new)] = cur
    return f"maximized {target.app}"


def minimize(target):
    app, win = _ax_window(target)
    if win is None:
        return f"no AX window for {target.app}"
    AX.AXUIElementSetAttributeValue(win, "AXMinimized", True)
    return f"minimized {target.app}"


def close(target):
    """Close the tab you're looking at (Cmd+W). Looking at the tab strip selects that tab first."""
    app, win = _ax_window(target)
    if win is None:
        return f"no AX window for {target.app}"
    _focus(app, win, target.pid)
    time.sleep(0.12)
    if target.in_tab_strip:
        click(*target.point)
        time.sleep(0.12)
    cmd_key(KEY_W)
    return f"closed tab/window in {target.app}"
