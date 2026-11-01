import os
from dotenv import load_dotenv
load_dotenv()
def get():
    return {"key": os.getenv("YOUCAM_API_KEY", ""), "base": os.getenv("YOUCAM_API_BASE_URL", "https://yce-api-01.makeupar.com").rstrip("/"),
            "max": int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024,
            "sb_url": os.getenv("SUPABASE_URL", "").rstrip("/"), "sb_key": os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            "cors": [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()],  # tolerate spaces and a trailing slash
            # Docs: no short-interval polling needed; example interval 10 s; results kept 24 h.
            "poll_initial": float(os.getenv("POLL_INITIAL_SECONDS", "3")),
            "poll_interval": float(os.getenv("POLL_INTERVAL_SECONDS", "10")),
            "poll_timeout": float(os.getenv("POLL_TIMEOUT_SECONDS", "120"))}
