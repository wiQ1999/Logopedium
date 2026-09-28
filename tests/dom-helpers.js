import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { loadRawDatabase } from './helpers.js';
import { acceptDatabase } from '../tools/database-file.js';
import { BASE_REVISION_HEADER, WRITABLE_HEADER } from '../src/webapp/js/data.js';

const INDEX_HTML = readFileSync(new URL('../src/webapp/index.html', import.meta.url), 'utf8');
const GLOBALS = ['window', 'document', 'HTMLElement', 'CSS', 'Event', 'KeyboardEvent', 'localStorage'];

let instanceCounter = 0;

export function tick(times = 3) {
  return new Promise((resolve) => {
    let remaining = times;
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
      } else {
        setTimeout(step, 0);
      }
    };
    setTimeout(step, 0);
  });
}

function installGlobals(window) {
  const previous = new Map();
  GLOBALS.forEach((name) => {
    previous.set(name, globalThis[name]);
    if (window[name] !== undefined) {
      globalThis[name] = window[name];
    }
  });
  if (!window.CSS || typeof window.CSS.escape !== 'function') {
    globalThis.CSS = { escape: (value) => String(value).replace(/["\\]/g, '\\$&') };
  }
  return () => {
    GLOBALS.forEach((name) => {
      const value = previous.get(name);
      if (value === undefined) {
        delete globalThis[name];
      } else {
        globalThis[name] = value;
      }
    });
  };
}

function installFetch(response) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (...args) => response(...args);
  return () => {
    globalThis.fetch = previous;
  };
}

/** Magazyn ustawień do podstawienia pod localStorage — przeżywa kolejne uruchomienia aplikacji. */
export function makeStorage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

export function jsonResponse(payload) {
  return () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => payload,
  });
}

/** Atrapa serwera projektu: GET podaje bazę z nagłówkiem zapisu, PUT stosuje reguły tools/database-file.js. */
export function devServer(raw = loadRawDatabase(), { writable = true, fail = null } = {}) {
  const state = { raw, saves: [], reads: 0 };
  const reply = (status, payload, headers = {}) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => structuredClone(payload),
  });
  const handler = (url, init = {}) => {
    if ((init.method ?? 'GET') !== 'PUT') {
      state.reads += 1;
      return reply(200, state.raw, writable ? { [WRITABLE_HEADER]: '1' } : {});
    }
    if (fail) return fail();
    const result = acceptDatabase(JSON.parse(init.body), state.raw, { baseRevision: init.headers?.[BASE_REVISION_HEADER] });
    state.saves.push(result);
    if (result.status === 'conflict') return reply(409, { generated: result.generated });
    if (result.status === 'invalid') return reply(400, { issues: result.issues });
    state.raw = result.raw;
    return reply(200, { generated: result.raw.generated });
  };
  handler.state = state;
  return handler;
}

export function errorResponse(status, statusText = 'Not Found') {
  return () => ({ ok: false, status, statusText, json: async () => ({}) });
}

export function networkFailure(message = 'fetch failed') {
  return () => {
    throw new TypeError(message);
  };
}

export async function bootApp({ hash = '#/params', response, storage } = {}) {
  const virtualConsole = new VirtualConsole();
  const runtimeErrors = [];
  virtualConsole.on('jsdomError', (error) => runtimeErrors.push(error.message));
  const dom = new JSDOM(INDEX_HTML, {
    url: `http://localhost/${hash}`,
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.scrollTo = () => {};

  const restoreGlobals = installGlobals(window);
  if (storage) {
    globalThis.localStorage = storage;
  }
  const server = response ?? devServer();
  const restoreFetch = installFetch(server);

  instanceCounter += 1;
  await import(`../src/webapp/js/main.js?instance=${instanceCounter}`);
  await tick(5);

  return {
    window,
    server: server.state,
    document: window.document,
    main: window.document.querySelector('#app-main'),
    hash: () => decodeURIComponent(window.location.hash),
    text: () => window.document.querySelector('#app-main').textContent.replace(/\s+/g, ' ').trim(),
    query: (selector) => window.document.querySelector(selector),
    queryAll: (selector) => [...window.document.querySelectorAll(selector)],
    async goto(nextHash) {
      window.location.hash = nextHash;
      await tick(4);
    },
    async click(selector) {
      const element = window.document.querySelector(selector);
      if (!element) {
        throw new Error(`Brak elementu do kliknięcia: ${selector}`);
      }
      element.click();
      await tick(4);
    },
    async press(key) {
      window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
      await tick(4);
    },
    teardown() {
      restoreFetch();
      restoreGlobals();
      window.close();
      assert.deepEqual(runtimeErrors, [], 'Nieobsłużone błędy przeglądarki');
    },
  };
}
