# ILLUMINATE backend (FastAPI). Build context = this folder (backend/).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv

# Install the existing requirements.txt unchanged, except the test-only pytest line (not needed at runtime).
COPY requirements.txt .
RUN grep -vi '^pytest' requirements.txt > requirements.runtime.txt \
    && pip install -r requirements.runtime.txt \
    && rm requirements.runtime.txt

# Application code only (.dockerignore keeps .env files, tests and caches out of the image).
COPY app ./app

# Run as an unprivileged user.
RUN useradd --system --no-create-home --uid 10001 illuminate
USER illuminate

# Render injects PORT (default 10000). 8000 is only the fallback for local runs.
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:%s/api/health' % os.environ.get('PORT','8000'), timeout=4)"

# Shell form via sh -c so ${PORT} is expanded; exec makes uvicorn PID 1 so it receives SIGTERM on deploys.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
