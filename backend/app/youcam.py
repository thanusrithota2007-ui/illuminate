"""YouCam AI Skin Analysis (v2.0) client. Flow confirmed against docs.perfectcorp.com (checked Oct 2026):
POST /s2s/v2.0/file -> PUT to requests[0].url with requests[0].headers -> POST /s2s/v2.0/task/skin-analysis
-> poll GET /s2s/v2.0/task/skin-analysis/{task_id} (status running|success|error) -> POST /s2s/v2.0/task/delete.
format=json results: data.results.output[] of {type, ui_score, raw_score, mask_urls}. Never run against the live API here."""
import asyncio, logging, time
import httpx
log = logging.getLogger("illuminate.youcam")
ACTIONS = ["acne", "dark_circle_v2", "oiliness", "redness", "pore", "texture", "age_spot", "wrinkle"]
LABELS = {"acne": "Acne", "dark_circle_v2": "Dark circles", "oiliness": "Oiliness", "redness": "Redness", "pore": "Pores", "texture": "Texture",
          "age_spot": "Age spots", "wrinkle": "Wrinkles", "moisture": "Moisture", "radiance": "Radiance", "firmness": "Firmness",
          "eye_bag": "Eye bags", "droopy_upper_eyelid": "Upper eyelid", "droopy_lower_eyelid": "Lower eyelid", "tear_trough": "Tear trough"}
# Documented photo error codes (File Specs & Errors) -> actionable messages.
PHOTO_ERRORS = {
    "error_below_min_image_size": "The photo is too small. Use one with at least 480 pixels on the short side.",
    "error_exceed_max_image_size": "The photo is too large. Try a smaller version.",
    "error_src_face_too_small": "Your face is too small in the photo. It should fill more than 60% of the width, so move closer.",
    "error_src_face_out_of_bound": "Part of your face is outside the frame. Centre your face and try again.",
    "error_lighting_dark": "The photo is too dark. Try again in bright, even light.",
}
GENERIC_PHOTO = "The provider could not analyse this photo. Try a clear, front-facing photo in even light."

class ProviderError(Exception):
    def __init__(self, status, message): self.status, self.message = status, message

def _num(x):
    return float(x) if isinstance(x, (int, float)) and not isinstance(x, bool) else None

def parse_results(data: dict) -> dict:
    """Normalise data.results.output[]. Tolerates missing scores and unknown item types; never exposes masks."""
    out = ((data or {}).get("results") or {}).get("output") if isinstance(data, dict) else None
    if not isinstance(out, list): raise ProviderError(502, "The provider returned an unexpected response.")
    concerns, overall, age, skipped = [], None, None, 0
    for it in out:
        t = it.get("type") if isinstance(it, dict) else None
        if not isinstance(t, str) or not t: skipped += 1; continue
        ui, raw = _num(it.get("ui_score")), _num(it.get("raw_score"))
        if t == "all": overall = _num(it.get("score")) if _num(it.get("score")) is not None else overall; continue
        if t == "skin_age": age = _num(it.get("skin_age")) if _num(it.get("skin_age")) is not None else age; continue
        if ui is None and raw is None: skipped += 1; continue
        concerns.append({"type": t, "label": LABELS.get(t, t.replace("_", " ").capitalize()), "ui_score": None if ui is None else round(ui), "raw_score": raw})
    return {"concerns": concerns, "overall_score": overall, "skin_age": age, "skipped_items": skipped}

def _body(r):
    try: return r.json() if r.content else {}
    except ValueError: return {}

def _check(r):
    if r.status_code in (401, 403): raise ProviderError(502, "The provider rejected the API key. Check YOUCAM_API_KEY in backend/.env.")
    if r.status_code == 429: raise ProviderError(429, "The provider is rate limiting requests. Please wait a moment and try again.")
    if r.status_code >= 400:
        b = _body(r); blob = f"{b.get('error','')} {b.get('error_code','')}" if isinstance(b, dict) else ""
        for code, msg in PHOTO_ERRORS.items():
            if code in blob: raise ProviderError(422, msg)
        if "InvalidParameters" in blob: raise ProviderError(502, "The provider did not accept the analysis request. This is a configuration issue, not your photo.")
        raise ProviderError(502, "The provider returned an error.")

def _task_error(d):
    blob = " ".join(str(d.get(k, "")) for k in ("error", "error_code", "error_message", "message"))
    for code, msg in PHOTO_ERRORS.items():
        if code in blob: return ProviderError(422, msg)
    return ProviderError(422, GENERIC_PHOTO)

async def _delete(c, base, h, task_id):
    """Documented: POST /s2s/v2.0/task/delete {task_id}; only allowed once the task has finished. Best effort."""
    try:
        r = await c.post(f"{base}/task/delete", headers=h, json={"task_id": task_id})
        log.info("task cleanup status %s", r.status_code)
    except httpx.HTTPError:
        log.warning("task cleanup failed")

async def analyze(data: bytes, content_type: str, name: str, cfg: dict, transport=None):
    h = {"Authorization": f"Bearer {cfg['key']}"}
    base = cfg["base"] + "/s2s/v2.0"
    task_id, finished = None, False
    try:
        async with httpx.AsyncClient(timeout=30, transport=transport) as c:
            try:
                body = {"files": [{"content_type": content_type, "file_name": name, "file_size": len(data)}]}
                r = await c.post(f"{base}/file", headers=h, json=body)
                if r.status_code == 404: r = await c.post(f"{base}/file/skin-analysis", headers=h, json=body)  # older documented path
                _check(r)
                f = r.json()["data"]["files"][0]; req = f["requests"][0]; file_id = f["file_id"]
                hdrs = {k: v for k, v in (req.get("headers") or {}).items() if k.lower() != "content-length"} or {"Content-Type": content_type}
                up = await c.request(req.get("method", "PUT"), req["url"], content=data, headers=hdrs)  # no Authorization on pre-signed URL
                if up.status_code >= 300: raise ProviderError(502, "Uploading the photo to the analysis provider failed. Please try again.")
                r = await c.post(f"{base}/task/skin-analysis", headers=h, json={"src_file_id": file_id, "dst_actions": ACTIONS,
                                 "miniserver_args": {"enable_mask_overlay": False}, "format": "json"})
                _check(r)
                task_id = r.json()["data"]["task_id"]
                deadline = time.monotonic() + cfg["poll_timeout"]
                await asyncio.sleep(cfg["poll_initial"])
                while True:
                    r = await c.get(f"{base}/task/skin-analysis/{task_id}", headers=h); _check(r)
                    d = r.json()["data"]; st = d.get("task_status")
                    if st == "success": finished = True; return parse_results(d)
                    if st == "error": finished = True; raise _task_error(d)
                    if time.monotonic() >= deadline: raise ProviderError(504, "The analysis is taking too long. Please try again in a few minutes.")
                    await asyncio.sleep(cfg["poll_interval"])
            finally:
                if task_id and finished: await _delete(c, base, h, task_id)
    except httpx.TimeoutException: raise ProviderError(504, "The analysis provider timed out.")
    except httpx.HTTPError: raise ProviderError(502, "Could not reach the analysis provider.")
    except (KeyError, IndexError, ValueError, TypeError, AttributeError): raise ProviderError(502, "The provider returned an unexpected response.")
