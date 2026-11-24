#!/bin/sh
set -eu

case "${PORT:-}" in
  ''|*[!0-9]*) echo 'PORT debe ser un entero entre 1 y 65535.' >&2; exit 1 ;;
esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo 'PORT debe ser un entero entre 1 y 65535.' >&2
  exit 1
fi

# Solo un origen, sin rutas, credenciales ni texto que pueda alterar nginx.conf.
if ! printf '%s' "${BACKEND_URL:-}" | grep -Eq '^https?://[a-zA-Z0-9.-]+(:[0-9]{1,5})?$'; then
  echo 'BACKEND_URL debe ser un origen HTTP(S) sin barra final, por ejemplo https://gesti-n-residuos.onrender.com.' >&2
  exit 1
fi
