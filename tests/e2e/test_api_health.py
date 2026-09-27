def test_health_check_returns_ok(client_kiosk):
    """GET /api/health returns 200 with status=ok and version=0.2.0."""
    response = client_kiosk.get("/api/health")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["status"] == "ok", f"Expected status=ok, got {data}"
    assert data["version"] == "0.2.0", f"Expected version=0.2.0, got {data}"
    assert "database" in data, f"Missing 'database' field in {data}"
