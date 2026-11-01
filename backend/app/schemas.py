from pydantic import BaseModel, Field

class Concern(BaseModel):
    type: str                       # provider concern id, e.g. "acne"
    label: str                      # human-readable label
    ui_score: int | None = None     # provider-calibrated display score (optional)
    raw_score: float | None = None  # provider raw score (optional)

class SkinAnalysisResponse(BaseModel):
    concerns: list[Concern] = Field(default_factory=list)
    overall_score: float | None = None   # provider "all" score, only if returned
    skin_age: float | None = None        # only if returned
    skipped_items: int = 0               # result items we could not read
    notice: str = "Informational only. Not a medical diagnosis or a measure of beauty or worth."

class CommunityStory(BaseModel):
    id: str
    category: str
    title: str
    body: str
    published_at: str | None = None

class CommunityStories(BaseModel):
    available: bool
    stories: list[CommunityStory] = Field(default_factory=list)
    message: str = ""

class CommunityStats(BaseModel):
    available: bool
    total: int = 0
    by_category: dict[str, int] = Field(default_factory=dict)
    measure: str = "Number of reviewed, consented community stories. It counts stories, not people, and is not a prevalence figure."
    source: str = "Illuminate community stories approved by a moderator."
    message: str = ""
