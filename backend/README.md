# Backend · Gestión de Residuos

FastAPI y PostgreSQL/Supabase. Único recurso implementado: Persona.

## Inicio

Requiere Python 3.13 o 3.14 y uv (el proyecto fija Python 3.14).

```powershell
uv sync
# Si .env no existe: Copy-Item .env.example .env
# Completar DATABASE_URL en .env con la URI del Session Pooler de Supabase.
uv run init-db
uv run backend
```

La aplicación escucha en `http://localhost:8000`. Swagger: `/docs`.
`/health` verifica FastAPI y `/health/db` verifica conexión y columnas de Persona.

Si no configuras la base de datos, el CRUD responde 503. No existe almacenamiento en memoria ni datos de demostración.

## Tabla

`public."Persona"`: `idPersona` (identity), `nombres`, `apellidos`, `dni` (único de 8 dígitos), `telefono` (9 dígitos). El archivo `src/backend/migrations/001_persona.sql` se aplica de manera explícita mediante `uv run init-db` o el SQL Editor de Supabase. No se ejecuta al arrancar el servidor. Está preparado para un proyecto nuevo y no adapta tablas existentes incompatibles.

## Rutas

- `GET /api/personas`
- `GET /api/personas/{id}`
- `POST /api/personas`
- `PUT /api/personas/{id}`
- `DELETE /api/personas/{id}`

Ejemplo de JSON para POST y PUT:

```json
{
  "nombres": "María Elena",
  "apellidos": "Torres Mendoza",
  "dni": "00123456",
  "telefono": "987654321"
}
```

PUT requiere los cuatro campos y mantiene el ID. Las respuestas incluyen `idPersona`. DNI repetido: 409; persona inexistente: 404; datos inválidos: 422; conexión no disponible: 503.

## Configuración y pruebas

`.env` se carga desde esta carpeta, independientemente del directorio desde el que se inicie Python. Variables del sistema tienen precedencia. Reinicia el backend tras editarlo. `CORS_ORIGINS` contiene orígenes separados por comas. Nunca subas `.env`; `.env.example` contiene solo marcadores.

```powershell
uv run pytest -q
```

Las pruebas del contrato HTTP usan un repositorio simulado. La prueba real de integración requiere `TEST_DATABASE_URL` y una tabla ya preparada en un proyecto de pruebas; inserta, consulta, actualiza y elimina únicamente un registro temporal.

Las capas `apis`, `schemas`, `services` y `repositories` siguen la organización de Semana 14. El repositorio ejecuta SQL parametrizado mediante psycopg y cada operación confirma su transacción antes de responder. El módulo actual es para desarrollo local; la autenticación administrativa corresponde a una etapa posterior.
