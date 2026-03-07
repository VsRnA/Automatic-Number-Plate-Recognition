class RecognitionError(Exception):
    pass


class ModelInferenceError(RecognitionError):
    pass


class InvalidFrameError(RecognitionError):
    pass


class VideoProcessingError(RecognitionError):
    pass


class WorkerError(RecognitionError):
    pass
