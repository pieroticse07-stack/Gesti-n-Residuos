from backend.database import connection
from backend.schemas.persona import PersonaBase


class PersonaRepository:
    def list_all(self) -> list[dict]:
        with connection() as conn:
            return conn.execute(
                'SELECT "idPersona", nombres, apellidos, dni, telefono '
                'FROM public."Persona" ORDER BY "idPersona" DESC'
            ).fetchall()

    def get(self, persona_id: int) -> dict | None:
        with connection() as conn:
            return conn.execute(
                'SELECT "idPersona", nombres, apellidos, dni, telefono '
                'FROM public."Persona" WHERE "idPersona" = %s', (persona_id,)
            ).fetchone()

    def create(self, data: PersonaBase) -> dict:
        with connection() as conn:
            return conn.execute(
                'INSERT INTO public."Persona" (nombres, apellidos, dni, telefono) '
                'VALUES (%s, %s, %s, %s) RETURNING *',
                (data.nombres, data.apellidos, data.dni, data.telefono),
            ).fetchone()

    def update(self, persona_id: int, data: PersonaBase) -> dict | None:
        with connection() as conn:
            return conn.execute(
                'UPDATE public."Persona" SET nombres=%s, apellidos=%s, dni=%s, telefono=%s '
                'WHERE "idPersona"=%s RETURNING *',
                (data.nombres, data.apellidos, data.dni, data.telefono, persona_id),
            ).fetchone()

    def delete(self, persona_id: int) -> bool:
        with connection() as conn:
            return conn.execute(
                'DELETE FROM public."Persona" WHERE "idPersona"=%s RETURNING "idPersona"',
                (persona_id,),
            ).fetchone() is not None
