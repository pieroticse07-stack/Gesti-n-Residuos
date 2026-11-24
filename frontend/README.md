# Frontend · Huancayo Limpio

Angular con formularios Signal, cuentas, reportes ciudadanos, panel municipal,
fotografías y mapas Leaflet/Geoapify. Backend publicado:
`https://gesti-n-residuos.onrender.com` (conectado a Supabase).

## Desarrollo local

Desde `frontend/`: `npm ci` y `npm start`. Abre `http://localhost:4200`.
`environment.development.ts` conserva la detección del backend local en 8001 y
8000. No se utiliza `ng serve` para publicar la aplicación.

## Contenedor de producción

Docker compila Angular con Node 24 y copia únicamente los archivos públicos a
una imagen final Nginx sin privilegios. No incorpora Node, `node_modules`,
herramientas de compilación ni `.env`. Las pantallas se resuelven en el navegador;
no se ejecuta el servidor SSR. El `index.csr.html` de Angular se copia como `index.html`.

Nginx escucha en `PORT` (10000 por defecto), usa un worker y admite cuerpos de
hasta 8 MB para los reportes con fotos. `/health` verifica Nginx. Abrir o actualizar
`/ingresar`, `/panel` o `/reportes/1` sirve Angular; recursos inexistentes devuelven
404 y los errores de API conservan su estado, sin convertirse en HTML.

El objetivo es una imagen final menor de 512 MB y ejecución con 512 MB de RAM.
Son medidas diferentes. La compilación tiene sus propios requisitos de memoria;
Node y las herramientas de construcción no forman parte del servicio final.

## Conexión y cookies

```text
Navegador -> frontend.onrender.com/api/... -> Nginx -> backend FastAPI -> Supabase
```

En producción `environment.ts` usa `apiUrl: ''`: el navegador consulta `/api`
en el mismo origen del frontend. La URL que configuraste se conserva como
`BACKEND_URL=https://gesti-n-residuos.onrender.com` en Docker y el Blueprint.
Es un origen público, sin barra final ni `/api`, y puede cambiarse en Render
sin recompilar Angular.

Nginx verifica TLS del backend y conserva rutas, cuerpos, cookies y `Origin`.
No almacena respuestas de API ni repite escrituras. La cookie devuelta queda
asociada al dominio del frontend, por lo que se conserva `SameSite=Lax` sin
depender de cookies entre sitios diferentes. No se cambia la autenticación.

**Paso manual en el backend de Render:** añadir a `CORS_ORIGINS` el origen HTTPS
real que Render asigne al frontend, y mantener `COOKIE_SECURE=true`. Ejemplo:

```dotenv
CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200,https://TU-FRONTEND-REAL.onrender.com
COOKIE_SECURE=true
```

Guardar y desplegar el backend para cargar la variable. Su protección de
escrituras comprueba `Origin` también detrás del proxy; sin este paso el login
puede devolver 403. No usar `*` ni sustituir `Origin` para evitar esa protección.

Supabase y ApisPeru se configuran únicamente en el servicio backend. Geoapify
entrega la clave de mapas al navegador por diseño: revisar que sus restricciones
permitan el frontend publicado y las consultas del servidor.

## Prueba local en Docker

Con Docker Desktop ejecutándose, desde `frontend/`:

```powershell
docker build -t huancayo-limpio-frontend:local .
docker image inspect huancayo-limpio-frontend:local --format '{{.Size}}'
docker run --rm --name huancayo-frontend -p 8080:10000 --memory=512m --memory-swap=512m --cpus=0.1 huancayo-limpio-frontend:local
```

Abrir `http://localhost:8080`, `/health` y `/ingresar`. Consultar memoria con
`docker stats --no-stream huancayo-frontend`. Detener con
`docker stop huancayo-frontend`; `--rm` elimina el contenedor al finalizar.

Las cookies Secure del backend publicado no equivalen a una sesión de producción
desde HTTP local. El proxy puede verificarse con un servidor de prueba, y el
login real debe verificarse en la URL HTTPS tras configurar CORS.

## Publicar con Blueprint (manual)

Se utiliza el repositorio existente `pieroticse07-stack/Gesti-n-Residuos`:

1. Hacer commit/push en `despliegue-frontend`, crear el pull request a `main` y
   fusionarlo. No se crea otro repositorio ni se ejecuta `git init`.
2. En Render elegir **New > Blueprint**, conectar GitHub y seleccionar el
   repositorio existente y la rama `main`.
3. En **Blueprint Path**, indicar **`frontend/render.yaml`**. El archivo no está
   en la raíz: no dejar el valor predeterminado `render.yaml`.
4. Revisar y aplicar el Blueprint. Define únicamente el Web Service
   `huancayo-limpio-frontend` con plan Free; no redefine el backend existente.
5. Copiar la URL HTTPS real asignada y añadirla al `CORS_ORIGINS` del backend.
6. Verificar portada, rutas al actualizar, registro/login, persistencia de sesión,
   permisos por rol, reportes, fotos y mapa con cuentas autorizadas.

| Campo | Valor |
| --- | --- |
| Type | Web Service |
| Branch | `main` |
| Root Directory | `frontend` |
| Runtime | Docker |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context | `.` |
| Docker Command | Vacío: se usa Nginx |
| Health Check | `/health` |
| `BACKEND_URL` | `https://gesti-n-residuos.onrender.com` |

Render proporciona `PORT`. El Blueprint activa despliegues cuando cambia `main`
dentro de `frontend/`. El subdominio final depende de la disponibilidad del nombre.
Los commits, push y operaciones de Render los realiza el usuario manualmente.

## Verificación

```powershell
npm test -- --no-watch
npm run build
```

Un health check correcto no acredita Supabase ni las API externas. No se crean
cuentas o reportes reales durante las pruebas del contenedor. La validación final
de la web en Render requiere configurar el origen y usar cuentas autorizadas.

Preparación verificada: 37 pruebas de Angular aprobadas y construcción Docker
correcta. Imagen final medida: **92,23 MB**. Con límite de **512 MiB**, swap
adicional deshabilitado y **0,1 CPU**, la memoria observada después de 60 solicitudes
(8 concurrentes) fue **15,09 MiB**. Es una medición de esa prueba, no una garantía
para cualquier volumen de tráfico.

Se verificaron las rutas SPA, JavaScript, foto PNG, 404 de recursos inexistentes,
errores de API sin caché, propagación de login/cookies y rechazo de Origin contra
una API simulada, y un cuerpo JSON de 6,7 MB para comprobar el paso de fotografías.
El usuario de Nginx es UID 101 y no hay Node instalado en la imagen final.
`render.yaml` se validó contra el esquema oficial de Render. Los contenedores y
la red temporal de la prueba se eliminaron al terminar.

También se comprobó el proxy HTTPS contra el backend real:
`/api/auth/me` devolvió 401 sin sesión, como corresponde. Fue una consulta de
lectura; no se probó el login con una cuenta real ni se hicieron escrituras.

Referencias: [Blueprints](https://render.com/docs/blueprint-spec),
[monorepos](https://render.com/docs/monorepo-support),
[recursos de Render](https://render.com/docs/compute-plans),
[Nginx sin privilegios](https://github.com/nginx/docker-nginx-unprivileged).
