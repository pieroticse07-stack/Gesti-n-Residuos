"""FastAPI: módulo Persona y diagnóstico de conexión."""

import logging

import psycopg
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.apis.personas import router
from backend.config import get_settings
from backend.database import DatabaseNotConfiguredError, connection
from backend.services.errors import PersonaNotFoundError

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="Gestión de Residuos · Personas", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )
    app.include_router(router)

    @app.exception_handler(PersonaNotFoundError)
    async def not_found(_: Request, exc: PersonaNotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(DatabaseNotConfiguredError)
    async def not_configured(_: Request, exc: DatabaseNotConfiguredError):
        return JSONResponse(status_code=503, content={
            "detail": "Configura DATABASE_URL en backend/.env para conectar con Supabase."
        })

    @app.exception_handler(psycopg.Error)
    async def database_error(_: Request, exc: psycopg.Error):
        if isinstance(exc, psycopg.errors.UniqueViolation):
            code, detail = 409, "Ya existe una persona con ese DNI."
        elif isinstance(exc, psycopg.errors.ForeignKeyViolation):
            code, detail = 409, "No se puede eliminar: la persona tiene registros relacionados."
        elif isinstance(exc, psycopg.errors.UndefinedTable):
            code, detail = 503, "Falta la tabla Persona. Ejecuta la migración con uv run init-db."
        elif isinstance(exc, (psycopg.OperationalError, psycopg.InterfaceError)):
            code, detail = 503, "No se pudo conectar con Supabase. Revisa la conexión del backend."
        else:
            code, detail = 500, "No se pudo completar la operación en la base de datos."
        # No registrar el texto de la excepción: podría contener datos personales o credenciales.
        logger.warning("Error PostgreSQL: %s", type(exc).__name__)
        return JSONResponse(status_code=code, content={"detail": detail})

    @app.get("/health", tags=["Estado"])
    def health():
        return {"status": "ok"}

    @app.get("/health/db", tags=["Estado"])
    def database_health():
        with connection() as conn:
            conn.execute('SELECT "idPersona", nombres, apellidos, dni, telefono FROM public."Persona" LIMIT 0')
        return {"status": "ok", "database": "PostgreSQL", "provider": "Supabase"}

    return app


app = create_app()


def run() -> None:
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
