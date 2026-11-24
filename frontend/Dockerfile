# syntax=docker/dockerfile:1
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build -- --configuration production \
    && if [ -f dist/frontend/browser/index.csr.html ]; then \
         cp dist/frontend/browser/index.csr.html dist/frontend/browser/index.html; \
       fi \
    && test -f dist/frontend/browser/index.html

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
ENV PORT=10000 \
    BACKEND_URL=https://gesti-n-residuos.onrender.com \
    NGINX_ENVSUBST_FILTER="^(PORT|BACKEND_URL)$"

COPY --chown=101:101 nginx/nginx.conf /etc/nginx/nginx.conf
COPY --chown=101:101 nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chown=101:101 --chmod=0755 nginx/05-validate-env.sh /docker-entrypoint.d/05-validate-env.sh
COPY --from=builder --chown=101:101 /app/dist/frontend/browser/ /usr/share/nginx/html/

USER 101
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["nginx", "-g", "daemon off;"]
