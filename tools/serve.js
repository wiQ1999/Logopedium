import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = fileURLToPath(new URL('../src/webapp/', import.meta.url));
const PORT = Number(process.env.PORT) || 4173;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

function resolvePath(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const relative = normalize(pathname).replace(/^([/\\])+/, '');
  if (relative.split(/[/\\]/).includes('..')) {
    return null;
  }
  const target = join(APP_DIR, relative || 'index.html');
  return target.startsWith(APP_DIR.replace(/[/\\]$/, '') + sep) || target === APP_DIR ? target : null;
}

const server = createServer(async (request, response) => {
  const target = resolvePath(request.url);
  if (!target) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('403 Forbidden');
    return;
  }

  let file = target;
  try {
    const info = await stat(file);
    if (info.isDirectory()) {
      file = join(file, 'index.html');
      await stat(file);
    }
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('404 Not Found');
    return;
  }

  response.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  console.log(`Logopedium: http://localhost:${PORT}/`);
});
