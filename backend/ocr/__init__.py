"""
Medical Document OCR Module.
"""
try:
    from backend.ocr.processor import process_medical_image
    from backend.ocr.router import ocr_router, router
except ModuleNotFoundError:
    from ocr.processor import process_medical_image
    from ocr.router import ocr_router, router

__all__ = ["ocr_router", "router", "process_medical_image"]
