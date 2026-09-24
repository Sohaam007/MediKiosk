"""
Medical Document OCR Module.
"""
from backend.ocr.processor import process_medical_image
from backend.ocr.router import ocr_router, router

__all__ = ["ocr_router", "router", "process_medical_image"]
