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
- El despliegue es manual mediante Web Service de Render, sin `render.yaml`.
- El usuario realiza GitHub (commits, push, pull request) y Render manualmente.
  El frontend queda fuera del alcance; documentar su configuración pendiente en README.md.
