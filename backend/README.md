# Backend · Huancayo Limpio

FastAPI y PostgreSQL/Supabase para personas, cuentas, reportes, revisión municipal,
cuadrillas, vehículos, atenciones e historiales. La guía completa de esta rama está
en el [README de la raíz](../README.md).

## Preparar el esquema y el acceso municipal

Desde esta carpeta:

```powershell
uv sync
uv run python -m backend.setup migrate
uv run python -m backend.setup crear-personal
```

La herramienta local permite crear el primer administrador sin dejar contraseñas
predeterminadas. El registro público solo crea cuentas ciudadanas.

Las migraciones se aplican explícitamente, conservan Persona y sus registros y no
se ejecutan al iniciar Uvicorn. Usa una base dedicada para pruebas destructivas.

## Ejecutar sin recarga automática

```powershell
uv run uvicorn backend.main:app --port 8001
```

Si Windows bloquea el lanzador de Uvicorn:

```powershell
uv run python -m uvicorn backend.main:app --port 8001
```

Documentación: http://localhost:8001/docs. Diagnóstico de base: `/health/db`.
Los endpoints administrativos de Persona requieren login con rol administrador.

## Configuración privada

`DATABASE_URL`, `APISPERU_TOKEN`, `GOOGLE_MAPS_BROWSER_KEY` y
`GOOGLE_GEOCODING_API_KEY` se configuran en `backend/.env`, excluido de Git.
El archivo `.env.example` documenta los nombres sin incluir secretos reales.
Reinicia el proceso después de editar las variables. No se exponen al cliente
el token de ApisPeru, la conexión SQL ni la clave privada de geocodificación.

## Pruebas

```powershell
uv run pytest -q
```

La prueba optativa `tests/test_workflow_database.py` usa
`RUN_WORKFLOW_DB_TESTS=1` y revierte las filas creadas al terminar. Los
identificadores de las secuencias pueden avanzar aunque se reviertan las filas.

El paquete Python se llama `backend` y se configura para utilizar directamente `backend/src`. No se necesita una carpeta `src/backend`.
