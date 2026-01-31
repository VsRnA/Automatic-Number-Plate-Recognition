from src.domain.models import BoundingBox, PlateResult, RecognitionResult


class RecognitionService:
    """Business logic for plate recognition."""

    def recognize_from_image(
        self, image_base64: str, use_sample_image: bool
    ) -> RecognitionResult:
        """
        Recognize plates from image.

        For now returns mock data. Will be implemented with YOLO + EasyOCR.
        """
        if use_sample_image or not image_base64:
            # Return sample data for testing
            sample_plate = PlateResult(
                plate_number="A123BC77",
                confidence=0.95,
                bounding_box=BoundingBox(x=100, y=200, width=150, height=50),
            )
            return RecognitionResult(
                success=True,
                plates=[sample_plate],
                processing_time_ms="42",
            )

        # TODO: Implement actual recognition with YOLO + EasyOCR
        return RecognitionResult(
            success=False,
            plates=[],
            processing_time_ms="0",
            error="Image recognition not implemented yet",
        )
