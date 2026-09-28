import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_REVISION_HEADER, WRITABLE_HEADER } from '../src/webapp/js/data.js';
import { DATABASE_FILE, saveDatabaseFile } from './database-file.js';

const APP_DIR = fileURLToPath(new URL('../src/webapp/', import.meta.url));
const DATABASE_PATH = '/data/database.json';
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

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

function resolvePath(appDir, url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const relative = normalize(pathname).replace(/^([/\\])+/, '');
  if (relative.split(/[/\\]/).includes('..')) {
    return null;
  }
  const target = join(appDir, relative || 'index.html');
  return target.startsWith(appDir.replace(/[/\\]$/, '') + sep) || target === appDir ? target : null;
}

const hostName = (value) => String(value ?? '').replace(/:\d+$/, '').toLowerCase();

/** Writes are a local authoring tool: loopback peer, loopback Host (DNS rebinding) and same-origin only. */
function isLocalRequest(request) {
  if (!LOOPBACK_ADDRESSES.has(request.socket.remoteAddress)) return false;
  if (!LOOPBACK_HOSTS.has(hostName(request.headers.host))) return false;
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Baza przekracza dopuszczalny rozmiar.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleSave(request, response, databaseFile) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { error: 'Zapis bazy jest dostępny tylko z tego komputera.' });
    return;
  }
  if (!/^application\/json\b/i.test(request.headers['content-type'] ?? '')) {
    sendJson(response, 415, { error: 'Oczekiwano treści application/json.' });
    return;
  }
  let proposed;
  try {
    proposed = JSON.parse(await readBody(request));
  } catch (error) {
    sendJson(response, error.status ?? 400, { error: error.status ? error.message : 'Treść nie jest poprawnym dokumentem JSON.' });
    return;
  }
  const baseRevision = request.headers[BASE_REVISION_HEADER];
  try {
    const result = await saveDatabaseFile(proposed, { file: databaseFile, baseRevision });
    if (result.status === 'conflict') sendJson(response, 409, { generated: result.generated });
    else if (result.status === 'invalid') sendJson(response, 400, { issues: result.issues });
    else sendJson(response, 200, { generated: result.raw.generated });
  } catch (error) {
    sendJson(response, 500, { error: `Nie udało się zapisać pliku bazy (${error.message}).` });
  }
}

export function createAppServer({ appDir = APP_DIR, databaseFile = DATABASE_FILE } = {}) {
  return createServer(async (request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    if (pathname === DATABASE_PATH && request.method === 'PUT') {
      await handleSave(request, response, databaseFile);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
      response.end('405 Method Not Allowed');
      return;
    }

    const target = pathname === DATABASE_PATH ? databaseFile : resolvePath(appDir, request.url);
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
      ...(pathname === DATABASE_PATH && isLocalRequest(request) ? { [WRITABLE_HEADER]: '1' } : {}),
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  });
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
  const port = Number(process.env.PORT) || 4173;
  // --database <plik> serves and saves another copy of the base, e.g. for trying the editor safely.
  const option = process.argv.indexOf('--database');
  const databaseFile = option > -1 && process.argv[option + 1] ? resolve(process.argv[option + 1]) : DATABASE_FILE;
  createAppServer({ databaseFile }).listen(port, () => {
    console.log(`Logopedium: http://localhost:${port}/ (baza: ${databaseFile})`);
  });
}
