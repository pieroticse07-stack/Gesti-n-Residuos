# Despliegue del backend

- Mantener los cambios de despliegue dentro de `backend/`.
- La imagen base acordada es `ghcr.io/astral-sh/uv:0.12.19-python3.13-trixie-slim`.
- Usar construcción multietapa, instalar desde `uv.lock` con `--frozen` y ejecutar
  con el usuario sin privilegios `app`.
- La imagen base utiliza `CMD`, no `ENTRYPOINT`. El Dockerfile establece
  `CMD ["/app/.venv/bin/serve"]`; no necesita un entrypoint adicional.
- `serve` escucha en `0.0.0.0` y lee `PORT` (10000 por defecto). No usar recarga automática.
- No copiar `.env`, tokens ni credenciales dentro de la imagen. Conservar README.md
  en el contexto de construcción porque es metadato del paquete Python.
- Las migraciones y la creación de personal siguen siendo operaciones explícitas;
  no ejecutarlas al iniciar el contenedor.
- El Web Service Docker de Render se configura manualmente, sin `render.yaml`; los siguientes despliegues pueden dispararse desde Actions.
- El usuario realiza GitHub (commits, push, pull request) y la configuración de Render manualmente.
  El frontend queda fuera del alcance; documentar su configuración pendiente en README.md.
- GitHub Actions se define en `.github/workflows/` de la raíz y filtra exclusivamente backend; CI usa uv 0.12.19, pruebas sin Supabase y Docker sin push.
- Deploy Backend usa `HOOK_RENDER_BACKEND` tras CI verde en push a main o ejecución manual en main; desactivar Auto-Deploy del backend en Render.
- No solicitar hooks reales en el chat ni probarlos localmente; el smoke test solo consulta `/health` y `/health/db`, sin migraciones ni escrituras.
