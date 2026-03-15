"""
Tests for main application endpoints.
"""
from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    """Test root endpoint returns app info."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "app" in data
    assert "version" in data
    assert "status" in data
    assert data["status"] == "online"


def test_health_check(client: TestClient):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data


def test_app_lifespan_startup():
    """Test that the app lifespan (startup) runs without error."""
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        resp = c.get("/health")
        assert resp.status_code == 200
