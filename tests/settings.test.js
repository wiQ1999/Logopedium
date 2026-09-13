import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  DEFAULT_PICK,
  activeSelections,
  categoryEntry,
  createDefaultParams,
  forgetParams,
  loadStoredParams,
  storeParams,
  totalExercises,
  withItemLimit,
  withVariantLimit,
} from '../src/webapp/js/params.js';
import { SETTINGS_VERSION, STORAGE_KEY, readSettings, writeSettings } from '../src/webapp/js/settings.js';
import { makeFixtureDatabase, makeParams } from './helpers.js';

const db = makeFixtureDatabase();

function useStorage(initial = null) {
  const data = new Map();
  if (initial !== null) {
    data.set(STORAGE_KEY, initial);
  }
  globalThis.localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
  return data;
}

function useBrokenStorage() {
  globalThis.localStorage = {
    getItem() {
      throw new Error('magazyn niedostępny');
    },
    setItem() {
      throw new Error('magazyn niedostępny');
    },
    removeItem() {
      throw new Error('magazyn niedostępny');
    },
  };
}

afterEach(() => {
  delete globalThis.localStorage;
});

describe('magazyn ustawień', () => {
  it('zapisuje i odczytuje wartość z numerem wersji', () => {
    const data = useStorage();
    assert.ok(writeSettings({ level: 2 }));
    assert.deepEqual(JSON.parse(data.get(STORAGE_KEY)), { level: 2, version: SETTINGS_VERSION });
    assert.deepEqual(readSettings(), { level: 2, version: SETTINGS_VERSION });
  });

  it('brak zapisu daje null', () => {
    useStorage();
    assert.equal(readSettings(), null);
  });

  it('zapis uszkodzony albo w innej wersji jest odrzucany w całości', () => {
    useStorage('to nie jest JSON');
    assert.equal(readSettings(), null);

    useStorage(JSON.stringify({ level: 2, version: SETTINGS_VERSION - 1 }));
    assert.equal(readSettings(), null);

    useStorage(JSON.stringify({ level: 2, version: SETTINGS_VERSION + 1 }));
    assert.equal(readSettings(), null);

    useStorage(JSON.stringify([1, 2, 3]));
    assert.equal(readSettings(), null);
  });

  it('niedostępny magazyn nie przerywa pracy', () => {
    useBrokenStorage();
    assert.equal(readSettings(), null);
    assert.equal(writeSettings({ level: 1 }), false);
  });

  it('brak magazynu w środowisku nie przerywa pracy', () => {
    assert.equal(readSettings(), null);
    assert.equal(writeSettings({ level: 1 }), false);
  });
});

describe('zapamiętywanie parametrów między wizytami', () => {
  it('odtwarza poziom, tryb doboru oraz limity każdej kategorii', () => {
    useStorage();
    const params = withItemLimit(
      db,
      withVariantLimit(db, makeParams([['cat-a', 2], ['cat-b', 0], ['cat-d', 1]], { level: 3, pick: 'losowo' }), 'cat-d', 2),
      'cat-a',
      7,
    );
    storeParams(params);

    const restored = loadStoredParams(db, '2026-10-01');
    assert.equal(restored.level, 3);
    assert.equal(restored.pick, 'losowo');
    assert.deepEqual(
      restored.categories.slice(0, 3).map((entry) => [entry.id, entry.count, entry.variantLimit, entry.itemLimit]),
      [
        ['cat-a', 2, 1, 7],
        ['cat-b', 0, 1, 20],
        ['cat-d', 1, 2, 32],
      ],
    );
  });

  it('data nie jest zapamiętywana — wraca dzień bieżący', () => {
    const data = useStorage();
    storeParams(makeParams([['cat-a', 1]]));
    assert.equal(JSON.parse(data.get(STORAGE_KEY)).date, undefined);
    assert.equal(loadStoredParams(db, '2026-10-01').date, '2026-10-01');
  });

  it('zachowuje kolejność kategorii z zapisu', () => {
    useStorage();
    storeParams(makeParams([['cat-c', 1], ['cat-a', 1], ['cat-b', 1], ['cat-d', 1], ['cat-e', 1]]));
    assert.deepEqual(
      loadStoredParams(db).categories.map((entry) => entry.id),
      ['cat-c', 'cat-a', 'cat-b', 'cat-d', 'cat-e'],
    );
  });

  it('pomija nieznane kategorie i dopisuje nowe z wartością domyślną', () => {
    useStorage(
      JSON.stringify({
        version: SETTINGS_VERSION,
        level: 4,
        categories: [
          { id: 'cat-b', count: 1, variantLimit: 1, itemLimit: 9 },
          { id: 'juz-nie-istnieje', count: 4 },
        ],
      }),
    );
    const restored = loadStoredParams(db);
    assert.deepEqual(
      restored.categories.map((entry) => [entry.id, entry.count, entry.itemLimit]),
      [
        ['cat-b', 1, 9],
        ['cat-a', 6, 12],
        ['cat-c', 2, 0],
        ['cat-d', 1, 39],
        ['cat-e', 1, 0],
      ],
    );
  });

  it('wartości spoza zakresu są przycinane jak parametry z adresu', () => {
    useStorage(
      JSON.stringify({
        version: SETTINGS_VERSION,
        level: 99,
        pick: 'byle-co',
        categories: [{ id: 'cat-d', count: 999, variantLimit: 99, itemLimit: -5 }],
      }),
    );
    const restored = loadStoredParams(db);
    assert.equal(restored.level, 4);
    assert.equal(restored.pick, DEFAULT_PICK);
    assert.deepEqual(activeSelections(restored)[0], {
      id: 'cat-d',
      count: 1,
      variantLimit: 5,
      itemLimit: 5,
    });
  });

  it('brakujące limity w zapisie wracają do krańców kategorii', () => {
    useStorage(
      JSON.stringify({
        version: SETTINGS_VERSION,
        level: 4,
        categories: [{ id: 'cat-d', count: 1 }],
      }),
    );
    const entry = categoryEntry(loadStoredParams(db), 'cat-d');
    assert.deepEqual([entry.variantLimit, entry.itemLimit], [5, 39]);
  });

  it('brak zapisu oznacza wartości domyślne', () => {
    useStorage();
    assert.equal(loadStoredParams(db), null);
    const defaults = createDefaultParams(db, '2026-10-01');
    assert.equal(totalExercises(defaults), 13);
    assert.equal(categoryEntry(defaults, 'cat-d').itemLimit, 39);
  });

  it('usunięcie zapisu przywraca stan sprzed pierwszej wizyty', () => {
    const data = useStorage();
    storeParams(makeParams([['cat-a', 1]], { level: 1 }));
    assert.ok(data.has(STORAGE_KEY));
    assert.ok(forgetParams());
    assert.equal(data.has(STORAGE_KEY), false);
    assert.equal(loadStoredParams(db), null);
  });
});
