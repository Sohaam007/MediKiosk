def test_clinician_queue_returns_200(client_kiosk):
    response = client_kiosk.get("/api/clinician/queue?department_id=general")
    assert response.status_code == 200


def test_clinician_queue_has_correct_structure(client_kiosk):
    response = client_kiosk.get("/api/clinician/queue?department_id=general")
    data = response.json()
    assert data["department_id"] == "general"
    assert "entries" in data
    assert isinstance(data["entries"], list)
    assert "total_count" in data
