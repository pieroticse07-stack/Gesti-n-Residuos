"""Inicialización explícita: no modifica tablas al arrancar el servidor."""

from pathlib import Path

import psycopg

from backend.database import DatabaseNotConfiguredError, connection


def run() -> None:
    sql = (Path(__file__).parent / "migrations" / "001_persona.sql").read_text(encoding="utf-8")
    try:
        with connection() as conn:
            conn.execute(sql, prepare=False)
            conn.execute('SELECT "idPersona", nombres, apellidos, dni, telefono FROM public."Persona" LIMIT 0')
    except DatabaseNotConfiguredError:
        raise SystemExit("Configura DATABASE_URL en backend/.env antes de crear la tabla.") from None
    except psycopg.Error as exc:
        raise SystemExit(
            f"No se pudo inicializar Persona ({type(exc).__name__}). "
            "Revisa la conexión y si existe una tabla con otra estructura."
        ) from None
    print("Tabla Persona preparada. Conexión PostgreSQL/Supabase verificada.")
