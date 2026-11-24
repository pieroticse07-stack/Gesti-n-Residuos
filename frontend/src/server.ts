import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { request as httpRequest } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');
const production = process.env['NODE_ENV'] === 'production';
const backend = new URL(process.env['BACKEND_URL'] || 'https://gesti-n-residuos.onrender.com');
if (
  !['https:', 'http:'].includes(backend.protocol) ||
  backend.username ||
  backend.password ||
  backend.pathname !== '/' ||
  backend.search ||
  backend.hash
) {
  throw new Error('BACKEND_URL debe ser un origen HTTP(S), sin rutas ni credenciales.');
}

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ status: 'ok', service: 'frontend', runtime: 'node' });
});

const hopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
const maxBody = 8 * 1024 * 1024;

// Proxy en streaming: no almacena fotos completas ni repite escrituras.
app.use('/api', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (Number(req.headers['content-length'] || 0) > maxBody) {
    res.status(413).json({ detail: 'El contenido supera el máximo de 8 MB.' });
    return;
  }
  const headers: IncomingHttpHeaders = { ...req.headers, host: backend.host };
  const excluded = new Set([
    ...hopHeaders,
    ...String(req.headers.connection || '')
      .toLowerCase()
      .split(',')
      .map((h) => h.trim()),
  ]);
  for (const header of excluded) delete headers[header];
  headers.host = backend.host;
  const send = backend.protocol === 'https:' ? httpsRequest : httpRequest;
  // El cliente aporta solo ruta/query; nunca puede cambiar el host del proxy.
  const incoming = new URL(req.originalUrl, 'http://frontend.invalid');
  const target = new URL(backend);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const upstream = send(
    target,
    {
      method: req.method,
      headers,
      timeout: 120_000,
    },
    (reply) => {
      for (const [name, value] of Object.entries(reply.headers)) {
        if (value !== undefined && !hopHeaders.has(name) && name !== 'cache-control') {
          res.setHeader(name, value);
        }
      }
      res.statusCode = reply.statusCode || 502;
      reply.on('error', () => res.destroy());
      reply.pipe(res);
    },
  );
  upstream.on('timeout', () => upstream.destroy(new Error('Backend timeout')));
  upstream.on('error', () => {
    if (res.destroyed || res.writableEnded) return;
    if (res.headersSent) res.destroy();
    else
      res.status(502).json({ detail: 'No se pudo conectar con el backend. Intenta nuevamente.' });
  });
  let received = 0;
  req.on('data', (chunk: Buffer) => {
    received += chunk.length;
    if (received > maxBody) {
      req.unpipe(upstream);
      if (!res.headersSent)
        res.status(413).json({ detail: 'El contenido supera el máximo de 8 MB.' });
      else res.destroy();
      upstream.destroy();
    }
  });
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => {
    if (!res.writableEnded) upstream.destroy();
  });
  req.pipe(upstream);
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1d',
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

// Todas las rutas actuales son CSR: producción sirve el HTML sin renderizar
// cuentas en el servidor ni exigir allowedHosts de localhost para el dominio público.
const angularApp = production ? undefined : new AngularNodeAppEngine();
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(404).end();
    return;
  }
  if (extname(req.path)) {
    res.status(404).end();
    return;
  }
  if (production) {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(browserDistFolder, 'index.csr.html'));
    return;
  }
  angularApp!
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = Number(process.env['PORT'] || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535.');
  }
  app.listen(port, '0.0.0.0', (error) => {
    if (error) throw error;
    console.log(`Frontend Node escuchando en el puerto ${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
