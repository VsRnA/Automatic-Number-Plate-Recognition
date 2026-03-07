import logging

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from internal.exception.exceptions import ModelInferenceError

logger = logging.getLogger(__name__)

PLATE_CHARS = "0123456789ABEKMHOPCTYX"
NUM_CLASSES = len(PLATE_CHARS) + 1

IMAGE_W = 320
IMAGE_H = 64


class _CRNN(nn.Module):
    def __init__(self, num_classes: int = NUM_CLASSES, hidden_size: int = 256):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=3, padding=1), nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),

            nn.Conv2d(64, 128, kernel_size=3, padding=1), nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),

            nn.Conv2d(128, 256, kernel_size=3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1), nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 1), padding=(0, 1)),

            nn.Conv2d(256, 512, kernel_size=3, padding=1), nn.BatchNorm2d(512), nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1), nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 1), padding=(0, 1)),

            nn.Conv2d(512, 512, kernel_size=2, padding=0), nn.ReLU(inplace=True),
        )
        self.rnn = nn.LSTM(512 * 3, hidden_size, num_layers=2, bidirectional=True, batch_first=False)
        self.fc = nn.Linear(hidden_size * 2, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.cnn(x)
        B, C, H, W = features.shape
        features = features.view(B, C * H, W)
        features = features.permute(2, 0, 1)
        output, _ = self.rnn(features)
        return self.fc(output)


class TextRecognizer:
    def __init__(self, model_path: str, device: str = "cpu"):
        self._device = torch.device(device)
        self._model = self._load_model(model_path)
        self._model.eval()
        logger.info(f"TextRecognizer: loaded from '{model_path}' on {device}")

    def _load_model(self, model_path: str) -> _CRNN:
        model = _CRNN(num_classes=NUM_CLASSES)
        checkpoint = torch.load(model_path, map_location=self._device, weights_only=False)

        if isinstance(checkpoint, dict):
            state_dict = (
                checkpoint.get("model_state_dict")
                or checkpoint.get("state_dict")
                or checkpoint.get("model")
                or checkpoint
            )
            if any(k.startswith("rnn.0.") for k in state_dict):
                state_dict = {
                    (k.replace("rnn.0.", "rnn.", 1) if k.startswith("rnn.0.") else k): v
                    for k, v in state_dict.items()
                }
            try:
                model.load_state_dict(state_dict, strict=True)
            except RuntimeError as e:
                raise ModelInferenceError(
                    f"Failed to load weights from '{model_path}': {e}"
                ) from e
        elif hasattr(checkpoint, "state_dict"):
            return checkpoint.to(self._device)
        else:
            raise ModelInferenceError(f"Unknown checkpoint format: {type(checkpoint)}")

        return model.to(self._device)

    def recognize(self, plate_crop: np.ndarray) -> tuple[str, float] | None:
        tensor = self._preprocess(plate_crop)
        with torch.no_grad():
            output = self._model(tensor)
        return self._decode(output)

    def _preprocess(self, image: np.ndarray) -> torch.Tensor:
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        elif image.shape[2] == 4:
            image = cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)
        else:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        resized = cv2.resize(image, (IMAGE_W, IMAGE_H), interpolation=cv2.INTER_AREA)
        normalized = (resized.astype(np.float32) / 127.5) - 1.0
        tensor = torch.from_numpy(normalized).permute(2, 0, 1).unsqueeze(0)

        return tensor.to(self._device)

    def _decode(self, output: torch.Tensor) -> tuple[str, float] | None:
        probs = F.softmax(output, dim=2).squeeze(1)
        pred_indices = probs.argmax(dim=1)
        pred_probs = probs.max(dim=1).values

        chars = []
        confidences = []
        prev_idx = -1

        for i, idx in enumerate(pred_indices.cpu().numpy()):
            idx = int(idx)
            if idx != 0 and idx != prev_idx:
                char_pos = idx - 1
                if 0 <= char_pos < len(PLATE_CHARS):
                    chars.append(PLATE_CHARS[char_pos])
                    confidences.append(float(pred_probs[i]))
            prev_idx = idx

        if not chars:
            return None

        text = "".join(chars)
        confidence = float(np.mean(confidences))
        return text, confidence
