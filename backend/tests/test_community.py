import httpx, pytest
from fastapi.testclient import TestClient
from app import main, community
c = TestClient(main.app)
@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.test"); monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "SECRET123")
    yield; community.TRANSPORT = None
def mock(rows=None, status=200):
    seen = []
    def h(req): seen.append(req); return httpx.Response(status, json=rows if rows is not None else [])
    community.TRANSPORT = httpx.MockTransport(h); return seen
def test_unconfigured_makes_no_requests(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", ""); seen = mock()
    assert c.get("/api/community/stories").json()["available"] is False and c.get("/api/community/stats").json()["available"] is False and not seen
def test_only_approved_consented_rows_requested_and_no_consent_fields():
    seen = mock([{"id": "1", "category": "Acne", "title": "t", "body": "b", "published_at": "2026-01-01", "consent_version": "v1", "status": "approved"}])
    j = c.get("/api/community/stories?category=Acne").json(); q = seen[0].url.params
    assert q["status"] == "eq.approved" and q["consent_given"] == "eq.true" and q["category"] == "eq.Acne"
    assert j["available"] and set(j["stories"][0]) == {"id", "category", "title", "body", "published_at"}
def test_stats_counts_only_known_categories():
    mock([{"category": "Acne"}, {"category": "Acne"}, {"category": "Scars"}, {"category": "Bogus"}, "x"])
    j = c.get("/api/community/stats").json()
    assert j["total"] == 3 and j["by_category"]["Acne"] == 2 and "not a prevalence" in j["measure"] and j["available"]
def test_empty_is_graceful_not_fabricated():
    mock([]); j = c.get("/api/community/stats").json(); assert j["available"] is False and j["total"] == 0 and j["message"]
@pytest.mark.parametrize("status", [401, 500])
def test_provider_failure_degrades(status):
    mock([], status); assert c.get("/api/community/stories").json()["available"] is False
def test_malformed_json_degrades():
    community.TRANSPORT = httpx.MockTransport(lambda r: httpx.Response(200, text="<html>")); assert c.get("/api/community/stats").json()["available"] is False
def test_service_key_never_in_response():
    mock([{"id": "1", "category": "Acne", "title": "t", "body": "b", "published_at": None}])
    assert "SECRET123" not in c.get("/api/community/stories").text + c.get("/api/community/stats").text
def test_invalid_category_rejected(): assert c.get("/api/community/stories?category=x").status_code == 422
def test_public_submission_is_not_enabled():
    assert c.post("/api/community/stories", json={"title": "x"}).status_code == 405
