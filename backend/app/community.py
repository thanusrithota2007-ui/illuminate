"""Read-only access to approved, consented community stories via Supabase REST (PostgREST). No extra dependency."""
import httpx
CATS = ["Acne", "Pigmentation", "Skin tone", "Scars", "Social-media pressure"]
APPROVED = {"status": "eq.approved", "consent_given": "eq.true"}   # unpublished/unconsented rows are never selected
TRANSPORT = None                                                   # tests inject httpx.MockTransport

class Unavailable(Exception): pass

def configured(cfg):
    return bool(cfg["sb_url"] and cfg["sb_key"]) and not cfg["sb_url"].startswith("replace_") and not cfg["sb_key"].startswith("replace_")

async def _rows(cfg, params):
    h = {"apikey": cfg["sb_key"], "Authorization": f"Bearer {cfg['sb_key']}"}
    try:
        async with httpx.AsyncClient(timeout=10, transport=TRANSPORT) as c:
            r = await c.get(f"{cfg['sb_url']}/rest/v1/community_stories", headers=h, params=params)
        if r.status_code >= 300: raise Unavailable
        rows = r.json()
        if not isinstance(rows, list): raise Unavailable
        return rows
    except (httpx.HTTPError, ValueError): raise Unavailable

async def stories(cfg, category=None, limit=20):
    p = {**APPROVED, "select": "id,category,title,body,published_at", "order": "published_at.desc", "limit": str(limit)}
    if category: p["category"] = f"eq.{category}"
    return [{k: r.get(k) for k in ("id", "category", "title", "body", "published_at")} for r in await _rows(cfg, p) if isinstance(r, dict) and r.get("category") in CATS]

async def stats(cfg):
    rows = await _rows(cfg, {**APPROVED, "select": "category", "limit": "10000"})
    by = {c: 0 for c in CATS}
    for r in rows:
        if isinstance(r, dict) and r.get("category") in by: by[r["category"]] += 1
    return {"total": sum(by.values()), "by_category": by}
