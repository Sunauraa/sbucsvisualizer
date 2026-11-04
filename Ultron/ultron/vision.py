"""Webcam capture + MediaPipe face and hand landmarkers."""

import time
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_URLS = {
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    "hand_landmarker.task": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
}


def model_path(name):
    path = MODELS_DIR / name
    if not path.exists():
        MODELS_DIR.mkdir(exist_ok=True)
        print(f"Downloading {name} ...")
        urllib.request.urlretrieve(MODEL_URLS[name], path)
    return str(path)


class Tracker:
    def __init__(self, camera=0):
        self.cap = cv2.VideoCapture(camera)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        if not self.cap.isOpened():
            raise RuntimeError("Cannot open camera (grant Camera permission to your terminal).")
        video = vision.RunningMode.VIDEO
        self.face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path("face_landmarker.task")),
            running_mode=video, num_faces=1,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True))
        # Hands are the slow model (~30 ms), so they run async; we use the latest result.
        self.hand_result = vision.HandLandmarkerResult([], [], [])
        self.hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path("hand_landmarker.task")),
            running_mode=vision.RunningMode.LIVE_STREAM, num_hands=1,
            result_callback=self._on_hands))
        self._t0 = time.monotonic()
        self._last_ts = -1

    def read(self):
        """Returns (frame_bgr, face_result, hand_result) or None if the camera failed."""
        ok, frame = self.cap.read()
        if not ok:
            return None
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        ts = max(int((time.monotonic() - self._t0) * 1000), self._last_ts + 1)
        self._last_ts = ts
        self.hands.detect_async(image, ts)
        return frame, self.face.detect_for_video(image, ts), self.hand_result

    def _on_hands(self, result, image, ts):
        self.hand_result = result

    def close(self):
        self.cap.release()
        self.face.close()
        self.hands.close()
