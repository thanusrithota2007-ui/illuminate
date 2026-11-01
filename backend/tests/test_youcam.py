import asyncio, json, httpx, pytest
from app import youcam
from app.youcam import ProviderError
CFG = {"key": "k", "base": "https://api.test", "poll_initial": 0, "poll_interval": 0.01, "poll_timeout": 0.05}
UP = "https://s3.test/upload?sig=1"
def ok(data): return httpx.Response(200, json={"status": 200, "data": data})
def provider(output=None, status="success", task_extra=None, put=200, file_resp=None, task_resp=None, calls=None, delete=200, poll_resp=None):
    calls = [] if calls is None else calls
    def h(req):
        p = req.url.path; calls.append((req.method, str(req.url), dict(req.headers), req.content))
        if req.url.host == "s3.test": return httpx.Response(put)
        if p in ("/s2s/v2.0/file", "/s2s/v2.0/file/skin-analysis"):
            return file_resp or ok({"files": [{"file_id": "F1", "requests": [{"method": "PUT", "url": UP, "headers": {"Content-Type": "image/png", "Content-Length": "3"}}]}]})
        if p == "/s2s/v2.0/task/skin-analysis": return task_resp or ok({"task_id": "T1"})
        if p == "/s2s/v2.0/task/skin-analysis/T1":
            if poll_resp: return poll_resp
            d = {"task_status": status, **(task_extra or {})}
            if status == "success": d["results"] = {"output": output if output is not None else []}
            return ok(d)
        if p == "/s2s/v2.0/task/delete": return httpx.Response(delete, json={"status": delete})
        return httpx.Response(404)
    return h, calls
def run(h, cfg=CFG): return asyncio.run(youcam.analyze(b"abc", "image/png", "p.png", cfg, transport=httpx.MockTransport(h)))
def err(h, cfg=CFG):
    with pytest.raises(ProviderError) as e: run(h, cfg)
    return e.value
OUT = [{"type": "acne", "ui_score": 88, "raw_score": 92.3, "mask_urls": ["https://m/1"]}, {"type": "pore", "ui_score": 84, "raw_score": 88.4}, {"type": "dark_circle_v2", "ui_score": 76, "raw_score": 80.2}]

def test_multiple_concern_types_use_type_field():  # would have caught the original defect (names came from parent key "output")
    h, _ = provider(OUT); r = run(h)
    assert [c["type"] for c in r["concerns"]] == ["acne", "pore", "dark_circle_v2"] and "output" not in [c["type"] for c in r["concerns"]]
    assert r["concerns"][2]["label"] == "Dark circles"
def test_missing_optional_scores():
    r = youcam.parse_results({"results": {"output": [{"type": "acne", "ui_score": 80}, {"type": "pore", "raw_score": 50.5}, {"type": "texture"}]}})
    assert r["concerns"][0]["raw_score"] is None and r["concerns"][1]["ui_score"] is None and r["skipped_items"] == 1
def test_unexpected_items_do_not_crash():
    r = youcam.parse_results({"results": {"output": ["str", None, 5, {}, {"type": 7}, {"type": "resize_image", "url": "x"}, {"type": "new_thing", "ui_score": True, "raw_score": "bad"}, {"type": "new_thing2", "ui_score": 61}]}})
    assert [c["type"] for c in r["concerns"]] == ["new_thing2"] and r["concerns"][0]["label"] == "New thing2" and r["skipped_items"] == 7
def test_all_and_skin_age_optional():
    r = youcam.parse_results({"results": {"output": [{"type": "all", "score": 75.7}, {"type": "skin_age", "skin_age": 37}]}})
    assert r["overall_score"] == 75.7 and r["skin_age"] == 37 and r["concerns"] == []
def test_masks_and_raw_not_in_result():
    h, _ = provider(OUT); assert "mask" not in json.dumps(run(h))
def test_upload_uses_documented_method_and_headers():
    h, calls = provider(OUT); run(h); put = [x for x in calls if x[1] == UP][0]
    assert put[0] == "PUT" and put[2]["content-type"] == "image/png" and "authorization" not in put[2] and put[3] == b"abc"
def test_file_endpoint_fallback_on_404():
    base, calls = provider(OUT)
    def h(req):
        if req.url.path == "/s2s/v2.0/file": return httpx.Response(404)
        return base(req)
    assert run(h)["concerns"]
def test_cleanup_after_success_and_after_error():
    h, calls = provider(OUT); run(h); d = [x for x in calls if x[1].endswith("/task/delete")]
    assert len(d) == 1 and json.loads(d[0][3]) == {"task_id": "T1"}
    h, calls = provider(status="error", task_extra={"error": "error_lighting_dark"}); e = err(h)
    assert e.status == 422 and "dark" in e.message and any(x[1].endswith("/task/delete") for x in calls)
def test_cleanup_failure_does_not_break_result():
    h, _ = provider(OUT, delete=400); assert run(h)["concerns"]
def test_no_cleanup_on_timeout_and_timeout_error():
    h, calls = provider(status="running"); e = err(h)
    assert e.status == 504 and not any(x[1].endswith("/task/delete") for x in calls)
def test_failed_upload():
    h, calls = provider(OUT, put=403); e = err(h)
    assert e.status == 502 and not any(x[1].endswith("/task/skin-analysis") for x in calls)
@pytest.mark.parametrize("code,status", [(401, 502), (403, 502), (429, 429), (500, 502)])
def test_http_errors_mapped(code, status):
    h, _ = provider(file_resp=httpx.Response(code, json={})); assert err(h).status == status
def test_documented_photo_error_codes_mapped():
    for code in youcam.PHOTO_ERRORS:
        h, _ = provider(task_resp=httpx.Response(400, json={"status": 400, "error": code, "error_code": code})); e = err(h)
        assert e.status == 422 and e.message == youcam.PHOTO_ERRORS[code]
def test_invalid_parameters_is_not_blamed_on_photo():
    h, _ = provider(task_resp=httpx.Response(400, json={"error": "cannot mix HD and SD dst_actions", "error_code": "InvalidParameters"})); e = err(h)
    assert e.status == 502 and "configuration" in e.message
def test_unknown_task_error_gets_generic_photo_hint():
    h, _ = provider(status="error"); assert err(h).message == youcam.GENERIC_PHOTO
@pytest.mark.parametrize("kw", [dict(file_resp=httpx.Response(200, text="<html>")), dict(file_resp=ok({"files": []})), dict(file_resp=ok({"files": [{"file_id": "F"}]})),
                                dict(task_resp=ok({})), dict(poll_resp=httpx.Response(200, json={"status": 200})), dict(poll_resp=ok({"task_status": "success"})),
                                dict(poll_resp=ok({"task_status": "success", "results": {"output": "nope"}}))])
def test_malformed_provider_responses(kw):
    h, _ = provider(OUT, **kw); e = err(h); assert e.status == 502 and "unexpected" in e.message
def test_network_failure():
    def h(req): raise httpx.ConnectError("x")
    assert err(h).status == 502
