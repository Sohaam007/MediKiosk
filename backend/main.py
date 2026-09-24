"""
MediKiosk Backend Server.
Main FastAPI application entry point.
"""
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Resilient imports supporting execution from root or backend directory
try:
    from backend.intake.router import router as intake_router
    from backend.ocr.router import router as ocr_router
    from backend.summary.router import router as summary_router
    from backend.consent.router import router as consent_router
    from backend.fhir.router import router as fhir_router
    from backend.config import PORT, DEBUG
except ModuleNotFoundError:
    from intake.router import router as intake_router
    from ocr.router import router as ocr_router
    from summary.router import router as summary_router
    from consent.router import router as consent_router
    from fhir.router import router as fhir_router
    from config import PORT, DEBUG

app = FastAPI(
    title="MediKiosk API",
    description="Clinical Intake, OCR Extraction, Triage & FHIR Integration Backend",
    version="0.1.0",
)

# CORS Middleware - configured to allow all origins for hackathon / kiosk devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Health Check Routes
@app.get("/health", tags=["Health"])
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}


@app.get("/api/health", tags=["Health"])
def api_health_check():
    """API health check endpoint with version info."""
    return {"status": "ok", "version": "0.1.0"}


@app.get("/", tags=["Root"])
def root():
    """Root endpoint with service status and docs reference."""
    return {
        "service": "MediKiosk Backend API",
        "status": "online",
        "documentation": "/docs",
        "endpoints": {
            "health": "/health",
            "intake_start": "/api/intake/start",
            "intake_respond": "/api/intake/respond",
        },
    }


# Register Application Routers
app.include_router(intake_router, prefix="/api/intake", tags=["Clinical Intake"])
app.include_router(ocr_router, prefix="/api/ocr", tags=["OCR Processing"])
app.include_router(summary_router, prefix="/api/summary", tags=["Clinical Summary"])
app.include_router(consent_router, prefix="/api/consent", tags=["Patient Consent"])
app.include_router(fhir_router, prefix="/api/fhir", tags=["FHIR Bundle"])


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=DEBUG)
