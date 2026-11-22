# Gestión de Residuos Sólidos

Base funcional del sistema web municipal para la gestión de residuos sólidos y la atención de puntos críticos. Esta primera versión implementa únicamente el módulo **Persona**, conectado a una base de datos PostgreSQL real alojada en Supabase.

El frontend y el backend se versionan juntos desde esta carpeta raíz. Los módulos de usuarios, reportes, prioridades y cuadrillas se desarrollarán después en ramas independientes.

## Qué incluye

- Angular con formulario basado en Signal Forms, listado, búsqueda, consulta, registro, edición y eliminación con confirmación.
- FastAPI con las capas `apis`, `schemas`, `services` y `repositories`, siguiendo la organización de Semana 14.
- Persistencia real con `psycopg`: los registros se guardan en Supabase, sin almacenamiento en memoria.
- Validación de nombres y apellidos, DNI único de 8 dígitos y teléfono de 9 dígitos.
- Script SQL versionado para crear la tabla Persona y pruebas del contrato HTTP y del frontend.

## Estructura

```text
Gestión-Residuos/
├── .gitignore
├── README.md
├── backend/
│   ├── .env.example
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── src/backend/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── apis/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── migrations/001_persona.sql
│   └── tests/
└── frontend/
    ├── package.json
    ├── package-lock.json
    └── src/
        ├── environments/
        └── app/
            ├── components/personas/
            ├── interfaces/
            └── services/
```

## Preparar una copia del proyecto

Requisitos: Python 3.14, uv y una versión de Node compatible con Angular 22.

1. En `backend`, ejecuta `uv sync`.
2. Copia `.env.example` como `.env` y completa `DATABASE_URL` con la conexión de TU proyecto de Supabase. Se recomienda la URI del Session Pooler en el puerto 5432. La contraseña debe estar codificada para URL cuando contiene caracteres especiales.
3. Si tu base todavía no tiene la tabla, ejecuta `uv run init-db`, o aplica `src/backend/migrations/001_persona.sql` desde el SQL Editor de Supabase. No es necesario repetirlo si Persona ya existe con la estructura correcta.
4. Inicia el backend desde su carpeta:

```powershell
uv run uvicorn backend.main:app
```

Si Windows bloquea el ejecutable de Uvicorn, puedes iniciarlo con `uv run python -m uvicorn backend.main:app`.

5. En otra terminal, desde `frontend`:

```powershell
npm ci
npm start
```

- Frontend: http://localhost:4200/personas
- API y documentación: http://127.0.0.1:8000/docs
- Conexión y columnas de la base de datos: http://127.0.0.1:8000/health/db
- CRUD: `GET/POST /api/personas` y `GET/PUT/DELETE /api/personas/{id}`.

Tras cambiar `.env`, reinicia el backend para que lea la nueva configuración. El script de creación de Persona no se ejecuta automáticamente al arrancar.

## Configuración privada

Las credenciales permanecen únicamente en `backend/.env`, excluido de Git. Cada integrante debe configurar su archivo local. Se comparte `.env.example` sin contraseñas reales. También se excluyen los historiales de respaldo, dependencias instaladas y archivos generados.

## Pruebas y siguientes cambios

- Backend, desde `backend`: `uv run pytest -q`.
- Frontend, desde `frontend`: `npm test -- --no-watch` y `npm run build`.
- La prueba de integración remota es optativa: requiere `TEST_DATABASE_URL` con una base de pruebas que tenga Persona preparada.

`main` contiene la base funcional. Crea una rama desde `main` para cada mejora y propone su integración mediante un pull request. Esta versión está orientada al desarrollo local; la autenticación y los permisos administrativos forman parte de los módulos posteriores.
