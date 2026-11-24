# Workflows del frontend

`workflows/deploy.yml` es una copia de referencia del workflow que ejecuta
pruebas, compila y solicita el despliegue del frontend.

En este monorepositorio GitHub ejecuta el archivo de la raíz
`.github/workflows/deploy-frontend.yml`. La copia interior no se ejecuta ni
produce despliegues duplicados. Conserva las rutas `frontend/` del repositorio
actual; no es una configuración lista para un repositorio separado.

Al modificar el workflow, actualizar primero el archivo ejecutable de la raíz
y mantener esta copia sincronizada. `HOOK_RENDER_FRONTEND` permanece en los
secretos de GitHub; no guardar su valor aquí.
