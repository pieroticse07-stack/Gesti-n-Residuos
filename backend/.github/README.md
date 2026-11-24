# Workflows del backend

Esta carpeta agrupa copias de referencia de los workflows del backend:

- `workflows/ci.yml`: pruebas y construcción Docker.
- `workflows/deploy.yml`: Deploy Hook y comprobaciones de salud.

En este monorepositorio GitHub ejecuta los archivos de la raíz
`.github/workflows/ci-backend.yml` y `.github/workflows/deploy-backend.yml`.
Los archivos interiores no se ejecutan ni producen despliegues duplicados.
Conservan las rutas `backend/` del repositorio actual; no son una configuración
lista para un repositorio separado.

Al modificar un workflow, actualizar primero el archivo ejecutable de la raíz
y mantener su copia de referencia sincronizada. No guardar secretos aquí.
