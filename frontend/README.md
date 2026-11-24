# Frontend · Huancayo Limpio · Node en Render

El frontend se publica como **Web Service con runtime Node**, siguiendo el formato
de la clase. El backend sigue usando su Dockerfile y no se modifica en esta tarea.
Se utiliza el repositorio existente; no hace falta crear otro repositorio.

## Comandos

| Uso | Comando |
| --- | --- |
| Instalar dependencias | `npm ci` |
| Desarrollo local | `npm run start:dev` |
| Compilar producción | `npm run build` |
| Iniciar producción, después de compilar | `npm start` |
| Pruebas Angular | `npm test -- --no-watch` |

**`npm start` ya no ejecuta `ng serve`.** Ahora ejecuta
`node --max-old-space-size=384 dist/frontend/server/server.mjs`.
`serve:ssr:frontend` conserva el mismo arranque como alias. No se utiliza Docker
ni Nginx para desplegar el frontend en Render.

## Configuración de Render

`frontend/render.yaml` define únicamente el frontend:

| Campo | Valor |
| --- | --- |
| Type | Web Service |
| Branch | `main` |
| Root Directory | `frontend` |
| Runtime / Language | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check | `/health` |
| Plan | Free (512 MB de RAM) |
| `NODE_VERSION` | `24.21.0` |
| `NODE_ENV` | `production` |
| `BACKEND_URL` | `https://gesti-n-residuos.onrender.com` |

La versión de Node también está en `.node-version`. `.npmrc` incluye las
dependencias de desarrollo durante `npm ci`, aunque `NODE_ENV=production`,
porque Angular CLI es necesario para ejecutar la compilación de la clase.
Render proporciona `PORT`; Node escucha en `0.0.0.0` y en ese puerto (10000 por
defecto). No usar el puerto de desarrollo 4200 para este servicio.

### Publicación manual

1. Hacer commit y push en `despliegue-frontend`, crear un nuevo pull request a
   `main` y fusionarlo. La fusión anterior de Docker no incorpora estos cambios.
2. En Render usar **New > Blueprint**, seleccionar el repositorio
   `pieroticse07-stack/Gesti-n-Residuos`, rama `main`, y **Blueprint Path:
   `frontend/render.yaml`**. Revisar que el runtime sea Node antes de aplicar.
3. También puede crearse manualmente un **Web Service**, con los campos de la
   tabla anterior. Elegir solo una vía para no duplicar servicios.
4. Comprobar la URL HTTPS real y `<URL_REAL>/health`. Debe mostrar estado `ok`,
   servicio `frontend` y runtime `node`.
5. Configurar el origen del frontend en el backend como se explica a continuación.
6. Verificar registro/login con cuentas autorizadas, sesión al actualizar, permisos
   por rol, reportes, fotografías y mapa en la web publicada.

Si se inició una configuración de frontend como Docker, no continuar con esa
configuración: el servicio que se publique para esta entrega debe indicar Node.
No modificar ni eliminar el servicio Docker del backend.

## Backend, cookies y CORS

En producción `environment.ts` usa `apiUrl: ''`, por lo que Angular llama a `/api`
en su propio dominio. El servidor Node reenvía esas llamadas a `BACKEND_URL`:

```text
Navegador -> frontend.onrender.com/api/... -> Node -> backend FastAPI -> Supabase
```

La URL previamente configurada se conserva en `BACKEND_URL`, sin `/api` final.
Debe ser un origen HTTP(S) sin rutas ni credenciales. El proxy verifica TLS en
HTTPS, conserva `Origin`, cookies y cuerpos, no almacena respuestas de API ni
repite escrituras. Las fotos se transmiten en streaming, con un máximo de 8 MB
por cuerpo, sin cargarlas completas en la memoria del servidor frontend.

El navegador recibe la cookie desde el dominio del frontend, lo que permite
mantener `SameSite=Lax` sin depender de cookies entre sitios distintos.
No se guardan tokens de sesión en localStorage.

**Paso manual obligatorio en el backend de Render:** añadir el origen HTTPS
real del frontend a `CORS_ORIGINS` y mantener `COOKIE_SECURE=true`. Ejemplo:

```dotenv
CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200,https://TU-FRONTEND-REAL.onrender.com
COOKIE_SECURE=true
```

Guardar y desplegar el backend para cargar esas variables. Si falta el origen,
su protección de escrituras puede rechazar login o reportes con 403.
No usar `*` ni sustituir `Origin` en el proxy para omitir esa comprobación.
Supabase, ApisPeru y Geoapify siguen configurados en el servicio backend.
Revisar en Geoapify las restricciones del dominio nuevo para cargar el mapa.

## Rutas y consumo

Las pantallas actuales usan renderizado en el navegador (CSR). Node sirve
`index.csr.html` en rutas como `/ingresar`, `/panel` y `/reportes/1`, también al
actualizar. No renderiza cuentas ni consulta Supabase para generar el HTML.
Los recursos inexistentes devuelven 404, y las respuestas API conservan sus errores.
El servidor Angular de desarrollo sigue disponible con `npm run start:dev`.

El plan Free limita la **RAM total a 512 MB**, no el tamaño del repositorio.
El arranque limita el heap de V8 a 384 MiB para reservar margen a buffers y memoria
nativa; ese límite por sí solo no garantiza que el RSS total sea menor de 512 MB.
La compilación requiere sus propios recursos y se verifica por separado del
proceso en ejecución. No se inician procesos adicionales de PM2 ni `ng serve`.

Para probar producción en PowerShell, después de compilar:

```powershell
$env:NODE_ENV='production'
$env:PORT='10000'
$env:BACKEND_URL='https://gesti-n-residuos.onrender.com'
npm start
```

Abrir `http://localhost:10000/health`. Las cookies Secure de producción se
verifican finalmente en HTTPS, no equivalen a una sesión desde HTTP local.
Detener la prueba con Ctrl+C y quitar las variables temporales si se vuelve al
desarrollo (`Remove-Item Env:NODE_ENV,Env:PORT,Env:BACKEND_URL`).

Las pruebas de proxy pueden usar una API simulada sin crear cuentas ni reportes
reales. El health check del frontend no acredita la disponibilidad de Supabase
ni de las API externas. La verificación funcional final y la configuración de
Render las realiza el usuario manualmente; no se publican cambios desde esta tarea.

Verificación de esta preparación: compilación correcta y 37 pruebas de Angular
aprobadas. Se ejecutó `npm start` con Node **24.21.0**, límite de **512 MiB**,
**0,1 CPU** y sin swap adicional; la memoria observada tras 60 solicitudes
(8 concurrentes) fue **64,63 MiB**. Esta medición no garantiza el consumo para
cualquier carga. Se comprobaron rutas SPA, JavaScript, imagen PNG, errores 404,
propagación de cookies de prueba, rechazo de Origin, respuestas de reportes y
una carga JSON de 6,7 MB contra una API simulada, sin utilizar Supabase.
El Blueprint también pasó la validación del esquema oficial de Render.
Los entornos temporales de prueba quedaron eliminados.
También se comprobó el arranque con `PORT=18001`, el rechazo de cuerpos superiores
a 8 MB con HTTP 413 y el proxy HTTPS al backend real (HTTP 401 sin sesión),
sin escrituras. El cliente no puede sustituir el destino del proxy mediante una
URI absoluta: se mantiene el origen configurado en `BACKEND_URL`.

Referencias: [Node en Render](https://render.com/docs/node-version),
[Blueprints](https://render.com/docs/blueprint-spec),
[puertos](https://render.com/docs/web-services#port-binding),
[memoria de Node](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-mib).
