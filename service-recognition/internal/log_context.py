import logging
import threading
from datetime import datetime, timezone

_camera_local: threading.local = threading.local()


def set_camera_id(camera_id: str) -> None:
    _camera_local.camera_id = camera_id


def clear_camera_id() -> None:
    _camera_local.camera_id = None


def get_camera_id() -> str | None:
    return getattr(_camera_local, 'camera_id', None)


class CameraContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.camera_id = get_camera_id()
        return True


try:
    try:
        from pythonjsonlogger.json import JsonFormatter as _JsonFormatterBase  # v3.x
    except ImportError:
        from pythonjsonlogger import jsonlogger  # v2.x
        _JsonFormatterBase = jsonlogger.JsonFormatter

    class _JsonFormatter(_JsonFormatterBase):
        def add_fields(
            self,
            log_record: dict,
            record: logging.LogRecord,
            message_dict: dict,
        ) -> None:
            super().add_fields(log_record, record, message_dict)
            log_record['time'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
            log_record['level'] = 'WARN' if record.levelname == 'WARNING' else record.levelname
            log_record['service'] = 'service-recognition'
            log_record['file'] = record.filename
            log_record['line'] = record.lineno
            if 'message' in log_record:
                log_record['msg'] = log_record.pop('message')
            for key in ('asctime', 'levelname', 'name', 'filename', 'lineno'):
                log_record.pop(key, None)

    _JSON_AVAILABLE = True

except ImportError:
    _JSON_AVAILABLE = False


def setup_logging(log_level: str) -> None:
    level = getattr(logging, log_level.upper(), logging.DEBUG)

    handler = logging.StreamHandler()

    if _JSON_AVAILABLE:
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter('%(asctime)s %(levelname)s %(name)s %(filename)s:%(lineno)d %(message)s')
        )

    handler.addFilter(CameraContextFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
