# API image. Build context is ./backend (see docker-compose.yml).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml ./
COPY waypoint_rules ./waypoint_rules
COPY app ./app
COPY seed ./seed
# Editable so the code in /app (and the seed's YAML fixtures next to it) is what runs.
RUN pip install -e .

COPY alembic.ini ./
COPY alembic ./alembic

RUN useradd --create-home --uid 10001 waypoint \
    && mkdir -p /app/uploads \
    && chown -R waypoint /app/uploads
USER waypoint

EXPOSE 8000
# Compose overrides this to run migrations and the seed first.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
