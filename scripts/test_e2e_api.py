#!/usr/bin/env python3
"""
End-to-End Test Suite for MediKiosk API
Target: https://medikiosk-production-9938.up.railway.app

Workflow:
1. POST /api/intake/start -> Initialize session, extract session_id.
2. POST /api/ocr/process -> Upload sample_prescription.jpg (multipart/form-data).
3. POST /api/consent/grant -> Grant ABDM sharing consent.
4. POST /api/summary/generate -> Generate bilingual clinical summary in Hindi.
5. GET /api/fhir/bundle -> Retrieve FHIR OPConsultation bundle.
"""

import sys
import json
import os
from pathlib import Path
import requests

BASE_URL = os.getenv("MEDIKIOSK_API_URL", "https://medikiosk-production-9938.up.railway.app").rstrip("/")
IMAGE_PATH = os.getenv("SAMPLE_PRESCRIPTION_PATH", "sample_prescription.jpg")


def print_step(step_number: int, title: str):
    print("\n" + "=" * 80)
    print(f" STEP {step_number}: {title}")
    print("=" * 80)


def print_json(data: dict | list):
    print(json.dumps(data, indent=2, ensure_ascii=False))


def check_and_prepare_image(image_path: str) -> Path:
    """Verifies that the prescription image exists. If missing, handles cleanly."""
    path = Path(image_path)
    if not path.is_file():
        # Check relative to script directory as fallback
        script_dir_path = Path(__file__).parent / image_path
        if script_dir_path.is_file():
            return script_dir_path

        print(f"\n[ERROR] Missing required file: '{image_path}'")
        print("Please place a valid 'sample_prescription.jpg' in the current working directory,")
        print("or specify its location using the SAMPLE_PRESCRIPTION_PATH environment variable.")
        print(f"Example: python {Path(__file__).name} <path_to_prescription_image>")
        sys.exit(1)
    return path


def run_e2e_test():
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})

    # Check image availability upfront
    image_file_path = check_and_prepare_image(sys.argv[1] if len(sys.argv) > 1 else IMAGE_PATH)
    print(f"Using Prescription Image: {image_file_path.resolve()}")
    print(f"Target Base URL: {BASE_URL}")

    # -------------------------------------------------------------------------
    # 1. POST /api/intake/start
    # -------------------------------------------------------------------------
    print_step(1, "POST /api/intake/start (Start Clinical Intake)")
    start_url = f"{BASE_URL}/api/intake/start"
    start_payload = {
        "patient_id": "PATIENT_001",
        "language": "en"
    }
    print(f"Request URL: {start_url}")
    print("Request Payload:")
    print_json(start_payload)

    resp_start = session.post(start_url, json=start_payload, timeout=30)
    print(f"Response Status: {resp_start.status_code}")
    assert resp_start.status_code == 200, f"Expected 200, got {resp_start.status_code}: {resp_start.text}"
    
    start_data = resp_start.json()
    print("Response Body:")
    print_json(start_data)

    session_id = start_data.get("session_id")
    assert session_id, f"Missing 'session_id' in response: {start_data}"
    print(f"\n[✓] Extracted session_id: {session_id}")

    # -------------------------------------------------------------------------
    # 2. POST /api/ocr/process
    # -------------------------------------------------------------------------
    print_step(2, "POST /api/ocr/process (Upload Prescription Image)")
    ocr_url = f"{BASE_URL}/api/ocr/process"
    print(f"Request URL: {ocr_url}")
    print(f"Uploading file: {image_file_path}")

    try:
        with open(image_file_path, "rb") as img_file:
            files = {
                "file": (image_file_path.name, img_file, "image/jpeg")
            }
            # Optional query parameter or data if server tracks session for OCR
            data = {"session_id": session_id}
            resp_ocr = session.post(ocr_url, files=files, data=data, timeout=60)
    except IOError as e:
        print(f"[ERROR] Failed to read image file: {e}")
        sys.exit(1)

    print(f"Response Status: {resp_ocr.status_code}")
    assert resp_ocr.status_code == 200, f"Expected 200, got {resp_ocr.status_code}: {resp_ocr.text}"

    ocr_data = resp_ocr.json()
    print("Response Body:")
    print_json(ocr_data)
    print("[✓] OCR processing complete")

    # -------------------------------------------------------------------------
    # 3. POST /api/consent/grant
    # -------------------------------------------------------------------------
    print_step(3, "POST /api/consent/grant (Grant Consent)")
    consent_url = f"{BASE_URL}/api/consent/grant"
    consent_payload = {
        "session_id": session_id,
        "patient_id": "PATIENT_001",
        "consent_given": True,
        "purpose": "ABDM_SHARING"
    }
    print(f"Request URL: {consent_url}")
    print("Request Payload:")
    print_json(consent_payload)

    resp_consent = session.post(consent_url, json=consent_payload, timeout=30)
    print(f"Response Status: {resp_consent.status_code}")
    assert resp_consent.status_code == 200, f"Expected 200, got {resp_consent.status_code}: {resp_consent.text}"

    consent_data = resp_consent.json()
    print("Response Body:")
    print_json(consent_data)
    print("[✓] Consent granted successfully")

    # -------------------------------------------------------------------------
    # 4. POST /api/summary/generate
    # -------------------------------------------------------------------------
    print_step(4, "POST /api/summary/generate (Generate Clinical Summary)")
    summary_url = f"{BASE_URL}/api/summary/generate"
    summary_payload = {
        "session_id": session_id,
        "target_language": "hi"
    }
    print(f"Request URL: {summary_url}")
    print("Request Payload:")
    print_json(summary_payload)

    resp_summary = session.post(summary_url, json=summary_payload, timeout=60)
    print(f"Response Status: {resp_summary.status_code}")
    assert resp_summary.status_code == 200, f"Expected 200, got {resp_summary.status_code}: {resp_summary.text}"

    summary_data = resp_summary.json()
    print("Response Body:")
    print_json(summary_data)
    print("[✓] Clinical summary generated successfully")

    # -------------------------------------------------------------------------
    # 5. GET /api/fhir/bundle
    # -------------------------------------------------------------------------
    print_step(5, "GET /api/fhir/bundle (Retrieve FHIR Bundle)")
    fhir_url = f"{BASE_URL}/api/fhir/bundle"
    params = {"session_id": session_id}
    print(f"Request URL: {fhir_url}")
    print(f"Query Parameters: {params}")

    resp_fhir = session.get(fhir_url, params=params, timeout=30)
    print(f"Response Status: {resp_fhir.status_code}")
    assert resp_fhir.status_code == 200, f"Expected 200, got {resp_fhir.status_code}: {resp_fhir.text}"

    fhir_data = resp_fhir.json()
    print("Response Body:")
    print_json(fhir_data)
    print("[✓] FHIR bundle retrieved successfully")

    print("\n" + "=" * 80)
    print(" ALL 5 END-TO-END WORKFLOW TESTS PASSED SUCCESSFULLY! ")
    print("=" * 80)


if __name__ == "__main__":
    try:
        run_e2e_test()
    except AssertionError as err:
        print(f"\n[FAIL] Assertion Error: {err}", file=sys.stderr)
        sys.exit(1)
    except requests.exceptions.RequestException as err:
        print(f"\n[FAIL] Network/Request Error: {err}", file=sys.stderr)
        sys.exit(1)
