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

`DATABASE_URL`, `APISPERU_TOKEN` y `GEOAPIFY_API_KEY`
se configuran en `backend/.env`, excluido de Git.
El archivo `.env.example` documenta los nombres sin incluir secretos reales.
Reinicia el proceso después de editar las variables. No se exponen al cliente
el token de ApisPeru ni la conexión SQL. La clave de mapas Geoapify se entrega al
navegador por diseño; configúrale las restricciones correspondientes en el proveedor.

## Despliegue manual del backend en Render con Docker

El alcance es únicamente esta carpeta. No se utiliza `render.yaml`; GitHub y
Render se configuran manualmente. Supabase continúa alojando la base de datos.

### Contenedor

`Dockerfile` usa dos etapas sobre
`ghcr.io/astral-sh/uv:0.12.19-python3.13-trixie-slim`. Instala las dependencias
de producción desde `uv.lock` con `--frozen`, instala el paquete sin modo editable
y copia el entorno instalado a la imagen final. Incluye las migraciones SQL
como recursos del paquete, pero no las ejecuta al arrancar.

El proceso usa el usuario `app` (UID/GID 10001), sin privilegios de root.
La imagen base trae `CMD`, no `ENTRYPOINT`. Se sustituye por
`CMD ["/app/.venv/bin/serve"]`, con `PATH=/app/.venv/bin:$PATH`.
`serve` inicia Uvicorn en `0.0.0.0`, lee `PORT` y usa 10000 si no se proporciona.
No activa `--reload`. El comando local `uv run uvicorn backend.main:app --port 8001`
sigue disponible.

`.dockerignore` excluye `.env*`, `.venv`, Git, cachés, pruebas y artefactos;
conserva `README.md` porque lo requiere la construcción del paquete.
No se copian credenciales a la imagen ni se declaran como argumentos de construcción.

Con Docker Desktop instalado y ejecutándose, desde `backend/`:

```powershell
docker build -t huancayo-limpio-backend .
docker run --rm --name huancayo-backend -p 8001:10000 --env-file .env -e PORT=10000 huancayo-limpio-backend
```

En otra terminal comprueba `http://localhost:8001/health`,
`http://localhost:8001/health/db` y `http://localhost:8001/docs`.
Para detener esta prueba: `docker stop huancayo-backend`.
`--env-file` inyecta el archivo local al ejecutar; no lo incorpora a la imagen.

### Configuración del Web Service

Después de subir y fusionar esta rama hacia `main`, en el proyecto
**Huancayo Limpio**, entorno **Production**, selecciona **New / Web Service**,
conecta GitHub y elige tu repositorio:

| Campo | Valor |
| --- | --- |
| Name | `huancayo-limpio-backend` o un nombre disponible |
| Branch | `main` |
| Root Directory | `backend` |
| Language / Runtime | `Docker` |
| Dockerfile Path | `./Dockerfile` (relativo a `backend`) |
| Docker Build Context Directory, si aparece | `.` (relativo a `backend`) |
| Docker Command | Vacío: se usa el CMD del Dockerfile |
| Health Check Path | `/health` |

Escoge el plan que corresponda a tu cuenta. No hace falta un Start Command de
Python ni un Build Command de `pip`: Render construye el Dockerfile.
Render asignará una URL HTTPS, por ejemplo
`https://huancayo-limpio-backend.onrender.com`; usa siempre la URL real que
aparezca en tu servicio. `backend-18-11.onrender.com`, visto en la captura de la
clase, es una referencia del ejemplo y no una dirección reservada para este proyecto.

### Variables de entorno en Render

En **Environment**, carga los valores privados desde tu `.env` de forma manual.
No subas ese archivo a GitHub.

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | URI real del Session Pooler de Supabase, con `sslmode=require` |
| `APISPERU_TOKEN` | Tu token real, si usarás la consulta de DNI |
| `APISPERU_BASE_URL` | `https://dniruc.apisperu.com/api/v1` |
| `GEOAPIFY_API_KEY` | Tu clave real para mapas y geocodificación |
| `CORS_ORIGINS` | Orígenes exactos permitidos, separados por comas, sin barra final |
| `COOKIE_SECURE` | `true` en Render, que sirve mediante HTTPS |
| `SESSION_HOURS` | `12` |
| `EXTERNAL_API_TIMEOUT_SECONDS` | `8` |

Mientras el frontend sea local, `CORS_ORIGINS` puede contener
`http://localhost:4200,http://127.0.0.1:4200`. Cuando se publique se añadirá su
origen HTTPS real. No uses `*` con cookies de sesión.
Render proporciona `PORT`; no copies el puerto local 8000/8001 al servicio.
Las variables vacías de ApisPeru y Geoapify deshabilitan esas integraciones;
`DATABASE_URL` es necesaria para los endpoints con datos.

### Comprobar el despliegue

1. Pulsa **Deploy / Create Web Service** y revisa los logs de construcción y arranque.
2. Abre `<URL_REAL>/health`: debe devolver `{"status":"ok"}`.
3. Abre `<URL_REAL>/health/db`: comprueba la conexión y la tabla Persona en Supabase.
4. Abre `<URL_REAL>/docs` para ver los endpoints. Los administrativos requieren sesión.

El health check usa `/health` para verificar el proceso; no acredita por sí solo
la disponibilidad de Supabase. Las migraciones pendientes se revisan y aplican
explícitamente a la base correcta antes de utilizar sus endpoints. No se crea
otra base de datos ni un administrador predeterminado durante el despliegue.

### Pendiente (manual)

- Publicar la rama, hacer commit/push en GitHub Desktop y fusionar el pull request
  hacia `main`. El repositorio ya está inicializado: no ejecutar otro `git init`.
- Crear el Web Service y cargar las variables en Render siguiendo lo anterior.
- Verificar `/health`, `/health/db` y `/docs` en la URL asignada.
- En una tarea posterior de frontend, cambiar `apiUrl` en sus archivos
  `environment.ts` y `environment.development.ts` a la URL HTTPS real, sin `/api`
  final. Esos archivos no se modifican en este alcance.
- Antes de conectar el frontend publicado, revisar la política de cookies:
  actualmente usa `SameSite=Lax`. Un frontend y backend en sitios diferentes
  necesitan una configuración de sesión compatible; cambiar solo CORS y la URL
  no garantiza que el navegador envíe la cookie. Esa integración queda pendiente.

Documentación: [Docker en Render](https://render.com/docs/docker),
[puertos de Web Services](https://render.com/docs/web-services#port-binding) y
[variables de entorno](https://render.com/docs/configure-environment-variables).

Verificación de esta preparación: pruebas locales de arranque y del backend,
construcción del wheel con `serve` y las cuatro migraciones incluidas, y arranque
temporal con `PORT` dinámico comprobando `/health` y `/docs`. La imagen base
indicada existe en el registro oficial y no define ENTRYPOINT. La imagen
`huancayo-limpio-backend:local` se construyó y ejecutó correctamente en Docker
Desktop. Se comprobaron `/health` y `/docs` con `PORT=18001`, usuario UID 10001,
las cuatro migraciones instaladas y la ausencia de `.env` y pruebas en `/app`.
El contenedor temporal se detuvo y eliminó al finalizar. Esta prueba no utilizó
credenciales ni se conectó a Supabase; `/health/db` queda por comprobar en el
servicio de Render con sus variables reales.

Si la terminal no encuentra `docker` o `docker-credential-desktop`, abre una
terminal nueva después de iniciar Docker Desktop y comprueba `docker version`.
En instalaciones por usuario, los ejecutables pueden estar en
`%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin`; esa carpeta debe estar en
el PATH de la terminal desde la que se ejecuta la construcción.

## Pruebas

```powershell
uv run pytest -q
```

La prueba optativa `tests/test_workflow_database.py` usa
`RUN_WORKFLOW_DB_TESTS=1` y revierte las filas creadas al terminar. Los
identificadores de las secuencias pueden avanzar aunque se reviertan las filas.

El paquete Python se llama `backend` y se configura para utilizar directamente `backend/src`. No se necesita una carpeta `src/backend`.
