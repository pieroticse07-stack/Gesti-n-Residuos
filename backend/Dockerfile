# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:0.12.19-python3.13-trixie-slim AS builder

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

# Instalar primero dependencias para reutilizar esta capa cuando cambia el código.
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src/ ./src/
RUN uv sync --frozen --no-dev --no-editable

FROM ghcr.io/astral-sh/uv:0.12.19-python3.13-trixie-slim AS runtime

WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=10000

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home app
COPY --from=builder --chown=app:app /app/.venv /app/.venv

USER app
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["/app/.venv/bin/python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '10000') + '/health', timeout=3).close()"]

CMD ["/app/.venv/bin/serve"]
