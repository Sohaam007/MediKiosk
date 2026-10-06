from uuid import uuid4

from medikiosk.api.app import create_app

app = create_app()


def test_get_doctors_api(client_kiosk):
    # Get all doctors
    response = client_kiosk.get("/api/doctors")
    assert response.status_code == 200
    data = response.json()
    assert "doctors" in data
    assert len(data["doctors"]) >= 1

    # Get by department
    response = client_kiosk.get("/api/doctors?department=Cardiology")
    assert response.status_code == 200
    assert all(d["department"] == "Cardiology" for d in response.json()["doctors"])

    # Get by language
    response = client_kiosk.get("/api/doctors?language=Bengali")
    assert response.status_code == 200
    assert all("Bengali" in d["languages"] for d in response.json()["doctors"])


def test_select_doctor_api(client_kiosk):
    # First, fetch doctors
    response = client_kiosk.get("/api/doctors")
    doctors = response.json()["doctors"]
    doctor_id = doctors[0]["doctor_id"]
    session_id = str(uuid4())

    # Select doctor
    select_response = client_kiosk.post(
        "/api/intake/select-doctor", json={"session_id": session_id, "doctor_id": doctor_id}
    )
    assert select_response.status_code == 200
    assert "message" in select_response.json()


def test_get_packages_api(client_kiosk):
    response = client_kiosk.get("/api/packages")
    assert response.status_code == 200
    data = response.json()
    assert "packages" in data
    assert len(data["packages"]) >= 1


def test_select_package_api(client_kiosk):
    # First, fetch packages
    response = client_kiosk.get("/api/packages")
    packages = response.json()["packages"]
    package_id = packages[0]["package_id"]
    session_id = str(uuid4())

    # Select package
    select_response = client_kiosk.post(
        "/api/intake/select-package", json={"session_id": session_id, "package_ids": [package_id]}
    )
    assert select_response.status_code == 200
    assert "message" in select_response.json()
