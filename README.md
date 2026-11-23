# Huancayo Limpio — Gestión de residuos sólidos

Sistema web con Angular y Signal Forms, FastAPI y PostgreSQL alojado en Supabase. El ciudadano registra incidentes; el administrador municipal los revisa y aprueba o rechaza, establece prioridad y asigna recursos; la cuadrilla registra sus intervenciones y el municipio valida la resolución.

## Funciones disponibles en esta rama

- Registro ciudadano, login y logout mediante una cookie HttpOnly y sesiones revocables; permisos comprobados en el backend.
- Gestión de Persona, conservando sus cinco columnas originales y su información existente.
- Reportes con ubicación, referencia y confirmación del ciudadano.
- Fotografía opcional con vista previa (JPG, PNG o WebP, hasta 5 MB). Se valida y reduce en el servidor, se retiran metadatos y se guarda en la tabla privada FOTO_REPORTE de Supabase junto con el reporte, dentro de la misma transacción. La consulta de la imagen requiere permiso sobre el reporte.
- Revisión municipal, validación territorial, aprobación o rechazo y prioridad con motivo e historial.
- Cuadrillas, integrantes con vigencia y vehículos con estado operativo y disponibilidad.
- Asignaciones y reasignaciones con historial; bloqueo de recursos ocupados.
- Inicio, observaciones y finalización de intervenciones; cierre validado por el administrador y reapertura.
- Seguimiento ciudadano, catálogos, mapa/lista e indicadores sobre datos persistidos.
- Integraciones con ApisPeru y mapas Geoapify mediante Leaflet. Para utilizarlas en vivo configura las claves de tus cuentas; no se incluyen credenciales de terceros ni datos de demostración.

**Revisión y atención son independientes:** aprobado no significa resuelto. Un reporte rechazado no se contabiliza como pendiente de limpieza.

## Estructura

```text
Gestión-Residuos/
├── README.md
├── backend/
│   ├── .env.example
│   ├── src/
│   │   ├── apis/              # Contratos HTTP y permisos
│   │   ├── schemas/           # Validación de entrada y salida
│   │   ├── services/          # Persona, autenticación e integraciones
│   │   ├── repositories/      # Persistencia y operaciones transaccionales
│   │   ├── migrations/       # 001 Persona y 002 sistema de residuos
│   │   └── setup.py           # Migración y alta local de personal
│   └── tests/
└── frontend/src/app/
    ├── components/            # Portada, acceso, paneles, reportes y Persona
    ├── interfaces/
    └── services/              # HTTP, sesión y protección de rutas
```

## Preparación

Requisitos: Python compatible con `backend/pyproject.toml`, uv y Node compatible con Angular 22.

Desde `backend`:

```powershell
uv sync
```

Si aún no existe `.env`, copia `.env.example` y completa `DATABASE_URL` con tu conexión a Supabase. No sobrescribas tu archivo si ya tiene la conexión configurada. El Session Pooler utiliza el puerto 5432; los caracteres especiales de la contraseña deben codificarse para URL.

Aplica las migraciones pendientes explícitamente:

```powershell
uv run python -m backend.setup migrate
```

La migración 002 agrega el sistema de residuos y los catálogos iniciales. No elimina ni altera las columnas de Persona. Las migraciones quedan registradas para evitar repetirlas; no se ejecutan automáticamente al iniciar el servidor.

### Primera cuenta municipal

No existe un correo o una contraseña administrativa predeterminada. Crea tu cuenta con la herramienta local:

```powershell
uv run python -m backend.setup crear-personal
```

Elige `administrador` e introduce tus datos y una contraseña de al menos diez caracteres. La contraseña se solicita sin mostrarla y se almacena como hash. Si el DNI ya está registrado en Persona, la herramienta pide confirmación antes de vincularlo con la nueva cuenta.

Si ya creaste una cuenta ciudadana, introduce su mismo correo y DNI. La herramienta pedirá confirmación para cambiar su rol a administrador y conservará la contraseña y los reportes. Después cierra sesión en la web y vuelve a ingresar. No existe una ruta pública para elegirse administrador.

Posteriormente, el administrador puede crear cuentas de personal desde **Cuentas y roles**, seleccionando una Persona sin cuenta, o cambiar el rol de una cuenta ciudadana existente. Los integrantes necesitan rol `cuadrilla` y pertenencia vigente para actualizar sus tareas.

## Dónde colocar las credenciales externas

Edita exclusivamente **`backend/.env`**, que está excluido de Git:

```dotenv
APISPERU_TOKEN=TU_TOKEN_PRIVADO_DE_APISPERU
APISPERU_BASE_URL=https://dniruc.apisperu.com/api/v1
GEOAPIFY_API_KEY=TU_CLAVE_COMPLETA_DE_GEOAPIFY
EXTERNAL_API_TIMEOUT_SECONDS=8
SESSION_HOURS=12
COOKIE_SECURE=false
```

Reinicia FastAPI después de cambiar el archivo. No pegues contraseñas ni tokens en el chat, código o commits.

### ApisPeru

Obtén el token del servicio DNI/RUC desde tu cuenta en [ApisPeru](https://apisperu.com/servicios/dniruc) y colócalo en `APISPERU_TOKEN`. El contrato del proveedor se consulta en [su documentación](https://dniruc.apisperu.com/doc).

La consulta se realiza desde FastAPI, normaliza nombres y apellidos y muestra una sugerencia. El usuario debe confirmarla; no guarda automáticamente una Persona ni acredita la titularidad del DNI. Si no hay token, resultado o disponibilidad, el registro manual permanece habilitado. El teléfono se introduce manualmente. La prueba real del proveedor depende de disponer de un token válido.

### Geoapify y Leaflet

En [Geoapify My Projects](https://myprojects.geoapify.com/) crea un proyecto y copia la clave completa de **API Keys** en `GEOAPIFY_API_KEY`, dentro de `backend/.env`. Reinicia FastAPI y actualiza la página. No necesitas claves de Google Maps. Leaflet está instalado como dependencia del frontend; el mapa se carga solo en el navegador.

- El navegador recibe la clave de mapas mediante `/api/config/publica`: es visible por diseño. Los tokens de ApisPeru y la conexión a la base de datos permanecen en el servidor. Configura restricciones en Geoapify que permitan el navegador local, el dominio publicado y las llamadas de búsqueda desde tu backend; comprueba ambos usos antes de publicar.
- El mapa usa teselas `osm-carto`, con atribución visible a Geoapify y OpenStreetMap. La búsqueda de direcciones se realiza desde FastAPI, filtrada a Perú y priorizando resultados cercanos a Huancayo. El mapa permite mover y acercar la vista, seleccionar puntos con clic y arrastrar el marcador.
- El plan gratuito tiene cuotas; revisa el consumo en tu panel y los [límites actuales](https://www.geoapify.com/pricing/). Ante un fallo del proveedor puedes continuar con coordenadas y referencia manuales.

El mapa inicia centrado en Huancayo. El administrador valida la competencia territorial; centrar el mapa o sesgar una búsqueda a Perú no valida límites municipales. Mientras no configures la clave, el formulario permite ingresar coordenadas y referencia manualmente. GPS es opcional y no se realiza rastreo continuo.


## Ejecutar la web

Backend, desde `backend`, sin recarga automática:

```powershell
uv run uvicorn backend.main:app --port 8001
```

Si Windows bloquea el ejecutable de Uvicorn:

```powershell
uv run python -m uvicorn backend.main:app --port 8001
```

Frontend, en otra terminal desde `frontend`:

```powershell
npm ci
npm start
```

- Web: http://localhost:4200/
- Login: http://localhost:4200/ingresar
- Registro ciudadano: http://localhost:4200/registro
- API: http://localhost:8001/docs
- Diagnóstico de conexión: http://localhost:8001/health/db

Usa `localhost` en ambos servicios para que el navegador gestione correctamente la cookie de sesión. `CORS_ORIGINS` debe incluir el origen exacto del frontend. En desarrollo Angular detecta el backend: prueba primero `http://localhost:8001/health` y, si no responde, `http://localhost:8000/health`. Puedes iniciarlo en cualquiera de esos dos puertos sin editar Angular; si ambos están disponibles se prioriza 8001. Si cambias de puerto mientras usas la web, actualiza la página. Las operaciones de registro no se repiten automáticamente ante fallos de conexión. Para un backend publicado configura su URL en `frontend/src/environments/`; la detección de puertos solo se aplica a las direcciones locales 8000 y 8001.

Para un despliegue público, configura HTTPS, `COOKIE_SECURE=true`, el origen permitido, la URL de API y las restricciones de las claves. El límite de intentos actual es por proceso; una instalación con varios procesos requiere un contador compartido. La disponibilidad, accesibilidad completa y recuperación requieren sus propias comprobaciones antes de un piloto.

## Pruebas

Backend:

```powershell
uv run pytest -q
```

Prueba optativa del flujo completo contra Supabase, con transacción que revierte todos sus datos de prueba:

```powershell
$env:RUN_WORKFLOW_DB_TESTS="1"
uv run pytest -q tests/test_workflow_database.py
```

La prueba usa la conexión configurada, recorre registro, aprobación, prioridad, asignación, reasignación, pertenencia, ejecución, cierre, reapertura, duplicidad y logout. Requiere las migraciones aplicadas. Aunque las filas se revierten, las secuencias de PostgreSQL pueden avanzar; no se debe interpretar los saltos de identificadores como pérdida de datos. Para pruebas concurrentes o destructivas utiliza una base dedicada.

Frontend:

```powershell
npm test -- --no-watch
npm run build
```

Las integraciones se comprueban con fallos y respuestas controladas; la comprobación en vivo de ApisPeru y Geoapify requiere tus claves. No se presenta como realizada mientras falten.

## Trabajo con Git

Los cambios se desarrollan en `Interfaz-con-los-RF-1---11`. Este trabajo no modifica `main` ni se publica mediante un push automático. Revisa los cambios, crea un commit y abre un pull request cuando corresponda. Nunca incluyas `backend/.env`, dependencias instaladas ni registros de prueba.

El paquete Python se llama `backend` y se configura para utilizar directamente `backend/src`. No se necesita una carpeta `src/backend`.
