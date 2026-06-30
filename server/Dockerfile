# MissionGrid backend image.
# Used for the API and both workers (commands are overridden in docker-compose).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first so they cache independently of source changes.
# asyncpg and aiokafka ship cp312 manylinux wheels, so no build toolchain needed.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the source. In local dev docker-compose bind-mounts ./ over /app for live
# reload, so this COPY mainly matters for a standalone/prod image build.
COPY . .

EXPOSE 8000

# Default command runs the API. Workers override this in docker-compose.yml.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
