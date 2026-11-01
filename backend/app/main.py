import io, logging
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from . import config, youcam
from .schemas import SkinAnalysisResponse, CommunityStories, CommunityStats
from . import community
log = logging.getLogger("illuminate")
app = FastAPI(title="ILLUMINATE API", description="Beyond the Reflection")
app.add_middleware(CORSMiddleware, allow_origins=config.get()["cors"], allow_methods=["GET", "POST"], allow_headers=["*"])
FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG"}

@app.get("/api/health")
def health(): return {"status": "ok", "service": "ILLUMINATE"}

@app.post("/api/skin-analysis", response_model=SkinAnalysisResponse)
async def skin_analysis(image: UploadFile = File(...)):
    cfg = config.get()
    if not cfg["key"] or cfg["key"].startswith("replace_"):
        raise HTTPException(503, "Skin analysis is not configured. Add YOUCAM_API_KEY to backend/.env.")
    if image.content_type not in FORMATS: raise HTTPException(415, "Please upload a JPEG or PNG photo.")
    data = await image.read(cfg["max"] + 1)
    if len(data) > cfg["max"]: raise HTTPException(413, f"Photo is larger than {cfg['max'] // 1048576} MB.")
    try:
        im = Image.open(io.BytesIO(data)); im.verify()
        if im.format != FORMATS[image.content_type]: raise ValueError
        w, h = Image.open(io.BytesIO(data)).size
    except Exception: raise HTTPException(400, "That file is not a valid image.")
    if min(w, h) < 480: raise HTTPException(422, "The photo is too small. Use one with at least 480 pixels on the short side.")
    try:
        res = await youcam.analyze(data, image.content_type, "photo." + FORMATS[image.content_type].lower(), cfg)
    except youcam.ProviderError as e:
        log.warning("provider error %s", e.status)  # never log image or key
        raise HTTPException(e.status, e.message)
    return SkinAnalysisResponse(**res)

NA = "Community stories are not available yet. Illuminate shows them only once real, consented stories have been reviewed."

@app.get("/api/community/stories", response_model=CommunityStories)
async def community_stories(category: str | None = None):
    if category and category not in community.CATS: raise HTTPException(422, "Unknown category.")
    cfg = config.get()
    if not community.configured(cfg): return CommunityStories(available=False, message=NA)
    try: rows = await community.stories(cfg, category)
    except community.Unavailable: return CommunityStories(available=False, message=NA)
    return CommunityStories(available=True, stories=rows, message="" if rows else "No community stories have been published here yet.")

@app.get("/api/community/stats", response_model=CommunityStats)
async def community_stats():
    cfg = config.get()
    if not community.configured(cfg): return CommunityStats(available=False, message=NA)
    try: s = await community.stats(cfg)
    except community.Unavailable: return CommunityStats(available=False, message=NA)
    return CommunityStats(available=s["total"] > 0, total=s["total"], by_category=s["by_category"], message="" if s["total"] else "No community stories have been published yet.")
