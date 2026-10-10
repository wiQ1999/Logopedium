import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { copyFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createAppServer } from '../tools/serve.js';
import { acceptDatabase, DATABASE_FILE, saveDatabaseFile, serializeDatabase } from '../tools/database-file.js';
import { importExercises, mergeExercises } from '../tools/import-exercises.js';
import { loadRawDatabase } from './helpers.js';

let dir;
let file;
let server;
let port;

function send(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port, method, path, headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject);
    request.end(body);
  });
}
const put = (raw, headers = {}) => send('PUT', '/data/database.json', {
  body: typeof raw === 'string' ? raw : JSON.stringify(raw),
  headers: { 'content-type': 'application/json', 'x-logopedium-base-revision': loadRawDatabase().generated, ...headers },
});

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'logopedium-'));
  file = join(dir, 'database.json');
  server = createAppServer({ databaseFile: file });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
beforeEach(() => copyFile(DATABASE_FILE, file));
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

describe('serwer projektu', () => {
  it('podaje aplikację i bazę z informacją o obsłudze zapisu', async () => {
    const page = await send('GET', '/');
    assert.equal(page.status, 200);
    assert.match(page.text, /<main/);
    const db = await send('GET', '/data/database.json');
    assert.equal(db.status, 200);
    assert.equal(db.headers['x-logopedium-writable'], '1');
    assert.equal(JSON.parse(db.text).exercises.length, 71);
  });

  it('zapisuje poprawną bazę wprost do pliku i podnosi rewizję', async () => {
    const raw = loadRawDatabase();
    raw.exercises[0].title = 'Tytuł z serwera';
    const response = await put(raw);
    assert.equal(response.status, 200);
    const saved = await readFile(file, 'utf8');
    const parsed = JSON.parse(saved);
    assert.equal(parsed.exercises[0].title, 'Tytuł z serwera');
    assert.equal(parsed.generated, JSON.parse(response.text).generated);
    assert.ok(parsed.generated > raw.generated);
    assert.equal(saved, serializeDatabase(parsed));
    assert.deepEqual(await readdir(dir), ['database.json']);
  });

  it('odrzuca bazę niezgodną ze schematem, a plik zostaje nietknięty', async () => {
    const original = await readFile(file, 'utf8');
    const raw = loadRawDatabase();
    raw.exercises[3].title = '';
    raw.exercises[4].variants[0].instructionHtml = '<script>x()</script>';
    const response = await put(raw);
    assert.equal(response.status, 400);
    const { issues } = JSON.parse(response.text);
    assert.ok(issues.some((issue) => issue.includes('title')));
    assert.ok(issues.some((issue) => issue.includes('HTML')));
    assert.equal(await readFile(file, 'utf8'), original);
  });

  it('odrzuca zapis na nieaktualnej rewizji', async () => {
    const original = await readFile(file, 'utf8');
    const response = await put(loadRawDatabase(), { 'x-logopedium-base-revision': '1999-01-01' });
    assert.equal(response.status, 409);
    assert.equal(await readFile(file, 'utf8'), original);
  });

  it('przyjmuje zapis wyłącznie z tej samej strony i komputera', async () => {
    const original = await readFile(file, 'utf8');
    assert.equal((await put(loadRawDatabase(), { origin: 'https://example.com' })).status, 403);
    assert.equal((await put(loadRawDatabase(), { host: 'example.com' })).status, 403);
    assert.equal((await put(loadRawDatabase(), { origin: `http://127.0.0.1:${port}` })).status, 200);
    const external = await send('GET', '/data/database.json', { headers: { host: 'example.com' } });
    assert.equal(external.headers['x-logopedium-writable'], undefined);
    assert.notEqual(await readFile(file, 'utf8'), original);
  });

  it('odrzuca treść w złym formacie oraz inne metody i ścieżki', async () => {
    assert.equal((await put('{', {})).status, 400);
    assert.equal((await put(loadRawDatabase(), { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await send('PUT', '/index.html', { body: 'x' })).status, 405);
    assert.equal((await send('DELETE', '/data/database.json')).status, 405);
    assert.equal((await send('GET', '/../package.json')).status, 404);
    assert.notEqual((await send('GET', '/%2e%2e/package.json')).status, 200);
    assert.notEqual((await send('GET', '/..%5c..%5cpackage.json')).status, 200);
  });
});

describe('reguły zapisu bazy', () => {
  it('rewizja zawsze rośnie, także przy cofniętym zegarze', () => {
    const current = { ...loadRawDatabase(), generated: '2030-01-01T00:00:00.000Z' };
    const result = acceptDatabase(current, current, { baseRevision: current.generated, now: new Date('2026-01-01') });
    assert.equal(result.raw.generated, '2030-01-01T00:00:00.001Z');
  });

  it('równoległe zapisy z tej samej rewizji: drugi dostaje konflikt', async () => {
    const raw = loadRawDatabase();
    const results = await Promise.all([1, 2].map((n) => saveDatabaseFile({ ...raw, exercises: raw.exercises.map((e, i) => i ? e : { ...e, title: `Wersja ${n}` }) },
      { file, baseRevision: raw.generated })));
    assert.deepEqual(results.map((r) => r.status), ['accepted', 'conflict']);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).exercises[0].title, 'Wersja 1');
  });
});

describe('import zadań ze skanów', () => {
  const template = new URL('../tools/templates/import.json', import.meta.url);

  it('wzór importu przechodzi walidację na próbę bez zmiany bazy', async () => {
    const original = await readFile(file, 'utf8');
    const result = await importExercises(template, { file, dryRun: true });
    assert.deepEqual(result, { status: 'checked', added: 1 });
    assert.equal(await readFile(file, 'utf8'), original);
  });

  it('dopisuje ćwiczenia na końcu bazy i podnosi rewizję', async () => {
    const result = await importExercises(template, { file });
    assert.equal(result.status, 'saved');
    const saved = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(saved.exercises.length, 72);
    assert.equal(saved.exercises.at(-1).readQuality, 'do_weryfikacji');
    assert.equal(saved.generated, result.generated);
    assert.equal((await importExercises(template, { file })).status, 'invalid');
  });

  it('nie nadpisuje istniejących ćwiczeń ani kategorii i odrzuca niezgodne dane', async () => {
    const current = loadRawDatabase();
    assert.match(mergeExercises(current, { exercises: [current.exercises[0]] }).issues[0], /już istnieje/);
    assert.match(mergeExercises(current, { categories: [current.categories[0]], exercises: [{ id: 'x' }] }).issues[0], /już istnieje/);
    assert.equal(mergeExercises(current, []).raw, null);
    const broken = join(dir, 'broken.json');
    await writeFile(broken, JSON.stringify({ exercises: [{ id: 'nowe', title: '' }] }));
    const original = await readFile(file, 'utf8');
    const result = await importExercises(broken, { file });
    assert.equal(result.status, 'invalid');
    assert.ok(result.issues.length > 0);
    assert.equal(await readFile(file, 'utf8'), original);
  });
});
