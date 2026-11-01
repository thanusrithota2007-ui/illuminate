import io, pytest
from PIL import Image
from fastapi.testclient import TestClient
from app import main, youcam
c = TestClient(main.app)
def png(n=500):
    b = io.BytesIO(); Image.new("RGB", (n, n), "pink").save(b, "PNG"); return b.getvalue()
@pytest.fixture(autouse=True)
def key(monkeypatch): monkeypatch.setenv("YOUCAM_API_KEY", "test"); monkeypatch.setenv("MAX_UPLOAD_MB", "1")
def post(data, ct="image/png"): return c.post("/api/skin-analysis", files={"image": ("a.png", data, ct)})
def test_health(): assert c.get("/api/health").json()["status"] == "ok"
def test_missing_config(monkeypatch):
    monkeypatch.setenv("YOUCAM_API_KEY", ""); assert post(png()).status_code == 503
def test_bad_format(): assert post(b"x", "image/gif").status_code == 415
def test_too_large(): assert post(b"0" * (1024 * 1024 + 5)).status_code == 413
def test_invalid_image(): assert post(b"notanimage").status_code == 400
def test_photo_too_small(): assert post(png(100)).status_code == 422
def test_provider_error_passthrough(monkeypatch):
    async def boom(*a, **k): raise youcam.ProviderError(429, "slow down")
    monkeypatch.setattr(youcam, "analyze", boom); r = post(png()); assert r.status_code == 429 and "slow down" in r.json()["detail"]
def test_success_response_model(monkeypatch):
    async def ok(*a, **k): return youcam.parse_results({"results": {"output": [{"type": "acne", "ui_score": 80, "raw_score": 70.5, "mask_urls": ["https://x/mask.jpg"]}]}})
    monkeypatch.setattr(youcam, "analyze", ok); r = post(png()); j = r.json()
    assert r.status_code == 200 and j["concerns"][0] == {"type": "acne", "label": "Acne", "ui_score": 80, "raw_score": 70.5}
    assert "mask" not in r.text and "http" not in r.text and "results" not in j
