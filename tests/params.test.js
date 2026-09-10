import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_LEVEL,
  activeSelections,
  buildSeedString,
  clampParams,
  computeLimits,
  createDefaultParams,
  decodeParams,
  encodeParams,
  isExerciseEligible,
  isValidIsoDate,
  paramsSignature,
  todayIso,
  totalExercises,
  withCategoryActive,
  withCategoryCount,
  withDate,
  withLevel,
  withMovedCategory,
} from '../src/webapp/js/params.js';
import { makeFixtureDatabase, makeParams } from './helpers.js';

const db = makeFixtureDatabase();
const query = (search) => new URLSearchParams(search);

describe('daty', () => {
  it('todayIso formatuje datę lokalną', () => {
    assert.equal(todayIso(new Date(2026, 8, 10)), '2026-09-10');
    assert.equal(todayIso(new Date(2026, 0, 1)), '2026-01-01');
  });

  it('isValidIsoDate odrzuca daty nieistniejące i błędny format', () => {
    assert.ok(isValidIsoDate('2026-02-28'));
    assert.ok(isValidIsoDate('2024-02-29'));
    assert.ok(!isValidIsoDate('2026-02-30'));
    assert.ok(!isValidIsoDate('2026-13-01'));
    assert.ok(!isValidIsoDate('10.09.2026'));
    assert.ok(!isValidIsoDate(''));
  });
});

describe('parametry startowe', () => {
  it('obejmują wszystkie kategorie po jednym ćwiczeniu', () => {
    const params = createDefaultParams(db, '2026-09-10');
    assert.equal(params.date, '2026-09-10');
    assert.equal(params.level, DEFAULT_LEVEL);
    assert.deepEqual(
      params.categories.map((entry) => entry.id),
      ['cat-a', 'cat-b', 'cat-c'],
    );
    assert.ok(params.categories.every((entry) => entry.count === 1));
    assert.equal(totalExercises(params), 3);
  });
});

describe('poziom trudności', () => {
  it('ćwiczenia bez poziomu pozostają dostępne', () => {
    assert.ok(isExerciseEligible({ level: null }, 1));
    assert.ok(isExerciseEligible({ level: 1 }, 1));
    assert.ok(!isExerciseEligible({ level: 2 }, 1));
  });

  it('limity kategorii uwzględniają poziom', () => {
    assert.equal(computeLimits(db, 4).get('cat-a'), 6);
    assert.equal(computeLimits(db, 2).get('cat-a'), 4);
    assert.equal(computeLimits(db, 1).get('cat-a'), 3);
    assert.equal(computeLimits(db, 1).get('cat-b'), 3);
  });

  it('obniżenie poziomu przycina liczby ćwiczeń', () => {
    const params = makeParams([
      ['cat-a', 6],
      ['cat-b', 3],
      ['cat-c', 2],
    ]);
    const limited = withLevel(db, params, 1);
    assert.equal(limited.level, 1);
    assert.equal(limited.categories[0].count, 3);
    assert.equal(limited.categories[1].count, 3);
  });

  it('poziom spoza zakresu wraca do wartości domyślnej', () => {
    assert.equal(withLevel(db, makeParams([['cat-a', 1]]), 99).level, 4);
    assert.equal(withLevel(db, makeParams([['cat-a', 1]]), 0).level, 1);
  });
});

describe('konfiguracja kategorii', () => {
  const params = makeParams([
    ['cat-a', 2],
    ['cat-b', 0],
    ['cat-c', 1],
  ]);

  it('liczba ćwiczeń jest przycinana do limitu i do zera', () => {
    assert.equal(withCategoryCount(db, params, 'cat-a', 99).categories[0].count, 6);
    assert.equal(withCategoryCount(db, params, 'cat-a', -5).categories[0].count, 0);
    assert.equal(withCategoryCount(db, params, 'cat-a', '3').categories[0].count, 3);
    assert.equal(withCategoryCount(db, params, 'cat-a', 'abc').categories[0].count, 0);
  });

  it('wyłączenie kategorii ustawia zero, włączenie jeden', () => {
    assert.equal(withCategoryActive(db, params, 'cat-a', false).categories[0].count, 0);
    assert.equal(withCategoryActive(db, params, 'cat-b', true).categories[1].count, 1);
  });

  it('kategoria nieaktywna zachowuje pozycję na liście', () => {
    const disabled = withCategoryActive(db, params, 'cat-a', false);
    assert.deepEqual(
      disabled.categories.map((entry) => entry.id),
      ['cat-a', 'cat-b', 'cat-c'],
    );
  });

  it('przestawianie zmienia kolejność, ale nie wychodzi poza listę', () => {
    const moved = withMovedCategory(params, 'cat-c', -1);
    assert.deepEqual(
      moved.categories.map((entry) => entry.id),
      ['cat-a', 'cat-c', 'cat-b'],
    );
    assert.deepEqual(withMovedCategory(params, 'cat-a', -1).categories, params.categories);
    assert.deepEqual(withMovedCategory(params, 'cat-c', 1).categories, params.categories);
    assert.deepEqual(withMovedCategory(params, 'nieznana', 1).categories, params.categories);
  });

  it('aktywne kategorie to te z liczbą większą od zera', () => {
    assert.deepEqual(
      activeSelections(params).map((entry) => entry.id),
      ['cat-a', 'cat-c'],
    );
    assert.equal(totalExercises(params), 3);
  });

  it('clampParams przycina wszystkie kategorie naraz', () => {
    const clamped = clampParams(db, makeParams([['cat-a', 10], ['cat-b', 10], ['cat-c', 10]], { level: 2 }));
    assert.deepEqual(
      clamped.categories.map((entry) => entry.count),
      [4, 3, 2],
    );
  });

  it('zmiana daty przyjmuje tylko poprawne wartości', () => {
    assert.equal(withDate(params, '2026-12-24').date, '2026-12-24');
    assert.equal(withDate(params, 'jutro').date, params.date);
  });
});

describe('ziarno losowania', () => {
  it('zależy od daty, wersji bazy, poziomu i zestawu kategorii', () => {
    const params = makeParams([
      ['cat-a', 2],
      ['cat-b', 1],
    ]);
    const seed = buildSeedString(params, '1.0');
    assert.equal(seed, 'logopedium|v=1.0|d=2026-09-10|l=4|c=cat-a:2,cat-b:1');
    assert.notEqual(seed, buildSeedString({ ...params, date: '2026-09-11' }, '1.0'));
    assert.notEqual(seed, buildSeedString({ ...params, level: 3 }, '1.0'));
    assert.notEqual(seed, buildSeedString(params, '1.1'));
  });

  it('nie zależy od kolejności kategorii na liście', () => {
    const params = makeParams([
      ['cat-a', 2],
      ['cat-b', 1],
      ['cat-c', 1],
    ]);
    const reordered = withMovedCategory(withMovedCategory(params, 'cat-c', -1), 'cat-c', -1);
    assert.deepEqual(
      reordered.categories.map((entry) => entry.id),
      ['cat-c', 'cat-a', 'cat-b'],
    );
    assert.equal(buildSeedString(params, '1.0'), buildSeedString(reordered, '1.0'));
  });

  it('pomija kategorie nieaktywne', () => {
    const withZero = makeParams([
      ['cat-a', 2],
      ['cat-b', 0],
    ]);
    const withoutCategory = makeParams([['cat-a', 2]]);
    assert.equal(buildSeedString(withZero, '1.0'), buildSeedString(withoutCategory, '1.0'));
  });
});

describe('parametry w adresie', () => {
  it('kodowanie i dekodowanie zachowuje wybór oraz kolejność', () => {
    const params = makeParams([
      ['cat-c', 2],
      ['cat-a', 1],
      ['cat-b', 0],
    ]);
    const encoded = encodeParams(params);
    assert.deepEqual(encoded, { d: '2026-09-10', l: '4', c: 'cat-c:2,cat-a:1' });

    const decoded = decodeParams(query(`d=${encoded.d}&l=${encoded.l}&c=${encoded.c}`), db);
    assert.equal(decoded.date, params.date);
    assert.equal(decoded.level, params.level);
    assert.deepEqual(activeSelections(decoded), [
      { id: 'cat-c', count: 2 },
      { id: 'cat-a', count: 1 },
    ]);
    assert.equal(paramsSignature(decoded), paramsSignature(params));
  });

  it('brak parametrów daje pustą sesję na dziś', () => {
    const decoded = decodeParams(query(''), db);
    assert.equal(decoded.date, todayIso());
    assert.equal(decoded.level, DEFAULT_LEVEL);
    assert.equal(totalExercises(decoded), 0);
  });

  it('pomija nieznane kategorie, zera i duplikaty', () => {
    const decoded = decodeParams(query('c=cat-a:2,nieznana:3,cat-b:0,cat-a:5&l=4'), db);
    assert.deepEqual(activeSelections(decoded), [{ id: 'cat-a', count: 2 }]);
  });

  it('przycina liczby przekraczające limit poziomu', () => {
    const decoded = decodeParams(query('c=cat-a:6&l=1'), db);
    assert.deepEqual(activeSelections(decoded), [{ id: 'cat-a', count: 3 }]);
  });

  it('błędna data i poziom wracają do wartości domyślnych', () => {
    const decoded = decodeParams(query('d=2026-02-30&l=17&c=cat-a:1'), db);
    assert.equal(decoded.date, todayIso());
    assert.equal(decoded.level, DEFAULT_LEVEL);
  });
});

describe('sygnatura parametrów', () => {
  it('rozróżnia kolejność kategorii', () => {
    const params = makeParams([
      ['cat-a', 1],
      ['cat-b', 1],
    ]);
    const reordered = withMovedCategory(params, 'cat-b', -1);
    assert.notEqual(paramsSignature(params), paramsSignature(reordered));
  });
});
