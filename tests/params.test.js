import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_LEVEL,
  DEFAULT_PICK,
  activeSelections,
  buildSeedString,
  categoryEntry,
  clampParams,
  computeLimits,
  createDefaultParams,
  decodeParams,
  encodeParams,
  isExerciseEligible,
  isValidIsoDate,
  itemBounds,
  paramsSignature,
  todayIso,
  totalExercises,
  variantBounds,
  withCategoryActive,
  withCategoryCount,
  withDate,
  withItemLimit,
  withLevel,
  withMovedCategory,
  withPick,
  withVariantLimit,
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
  it('opisują sesję nieograniczoną, kategoria po kategorii', () => {
    const params = createDefaultParams(db, '2026-09-10');
    assert.equal(params.date, '2026-09-10');
    assert.equal(params.level, DEFAULT_LEVEL);
    assert.equal(params.pick, DEFAULT_PICK);
    assert.deepEqual(
      params.categories.map((entry) => entry.id),
      ['cat-a', 'cat-b', 'cat-c', 'cat-d', 'cat-e'],
    );
    assert.deepEqual(
      params.categories.map((entry) => [entry.count, entry.variantLimit, entry.itemLimit]),
      [
        [6, 1, 12],
        [3, 1, 20],
        [2, 2, 0],
        [1, 5, 39],
        [1, 1, 0],
      ],
    );
    assert.equal(totalExercises(params), 13);
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

describe('zakres materiału kategorii', () => {
  it('kraniec `W` bierze się z najbogatszego ćwiczenia tej kategorii', () => {
    assert.deepEqual(variantBounds(db, 'cat-d', 4), { min: 1, max: 5 });
    assert.deepEqual(variantBounds(db, 'cat-c', 4), { min: 1, max: 2 });
    assert.deepEqual(variantBounds(db, 'cat-a', 4), { min: 1, max: 1 });
  });

  it('kraniec `P` zależy od `W` tej samej kategorii', () => {
    assert.deepEqual(itemBounds(db, 'cat-d', 4, 1), { min: 1, max: 20 });
    assert.deepEqual(itemBounds(db, 'cat-d', 4, 2), { min: 2, max: 32 });
    assert.deepEqual(itemBounds(db, 'cat-d', 4, 3), { min: 3, max: 38 });
    assert.deepEqual(itemBounds(db, 'cat-d', 4, 4), { min: 4, max: 39 });
    assert.deepEqual(itemBounds(db, 'cat-d', 4, 5), { min: 5, max: 39 });
    assert.deepEqual(itemBounds(db, 'cat-a', 4, 1), { min: 1, max: 12 });
  });

  it('kategoria bez pozycji ma zerowy kraniec `P`', () => {
    assert.deepEqual(itemBounds(db, 'cat-c', 4, 2), { min: 0, max: 0 });
    assert.deepEqual(itemBounds(db, 'cat-e', 4, 1), { min: 0, max: 0 });
  });

  it('krańce kategorii nie zależą od siebie nawzajem', () => {
    const narrow = withVariantLimit(db, makeParams([['cat-d', 1], ['cat-a', 1]]), 'cat-d', 1);
    assert.equal(categoryEntry(narrow, 'cat-d').variantLimit, 1);
    assert.equal(categoryEntry(narrow, 'cat-a').variantLimit, 1);
    assert.equal(categoryEntry(narrow, 'cat-a').itemLimit, 12);
  });

  it('zmniejszenie `W` dociąga `P` tej samej kategorii do nowego krańca', () => {
    const params = makeParams([['cat-d', 1]]);
    assert.equal(categoryEntry(params, 'cat-d').itemLimit, 39);
    assert.equal(categoryEntry(withVariantLimit(db, params, 'cat-d', 2), 'cat-d').itemLimit, 32);
    assert.equal(categoryEntry(withVariantLimit(db, params, 'cat-d', 1), 'cat-d').itemLimit, 20);
  });

  it('minimum `P` to jedna pozycja na wariant', () => {
    const narrowed = withVariantLimit(db, makeParams([['cat-d', 1]]), 'cat-d', 3);
    assert.equal(categoryEntry(withItemLimit(db, narrowed, 'cat-d', 1), 'cat-d').itemLimit, 3);
  });

  it('wartości spoza zakresu i nieliczbowe wracają do krańca', () => {
    const params = makeParams([['cat-d', 1]]);
    assert.equal(categoryEntry(withVariantLimit(db, params, 'cat-d', 99), 'cat-d').variantLimit, 5);
    assert.equal(categoryEntry(withVariantLimit(db, params, 'cat-d', 0), 'cat-d').variantLimit, 1);
    assert.equal(categoryEntry(withVariantLimit(db, params, 'cat-d', 'abc'), 'cat-d').variantLimit, 5);
    assert.equal(categoryEntry(withItemLimit(db, params, 'cat-d', 999), 'cat-d').itemLimit, 39);
    assert.equal(categoryEntry(withItemLimit(db, params, 'cat-d', -3), 'cat-d').itemLimit, 5);
  });

  it('kategoria bez pozycji trzyma `P` na zerze mimo prób ustawienia', () => {
    const params = makeParams([['cat-c', 2]]);
    assert.equal(categoryEntry(withItemLimit(db, params, 'cat-c', 9), 'cat-c').itemLimit, 0);
  });

  it('tryb doboru przyjmuje tylko znane wartości i pozostaje wspólny', () => {
    const params = makeParams([['cat-a', 1]]);
    assert.equal(withPick(params, 'losowo').pick, 'losowo');
    assert.equal(withPick(params, 'byle-co').pick, params.pick);
  });

  it('clampParams uzupełnia brakujące limity krańcami kategorii', () => {
    const clamped = clampParams(db, {
      date: '2026-09-10',
      level: 4,
      categories: [{ id: 'cat-d', count: 1 }, { id: 'cat-c', count: 1 }],
    });
    assert.deepEqual(
      clamped.categories.map((entry) => [entry.variantLimit, entry.itemLimit]),
      [
        [5, 39],
        [2, 0],
      ],
    );
    assert.equal(clamped.pick, DEFAULT_PICK);
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

  it('wyłączenie kategorii ustawia zero, włączenie wszystkie dostępne', () => {
    assert.equal(withCategoryActive(db, params, 'cat-a', false).categories[0].count, 0);
    assert.equal(withCategoryActive(db, params, 'cat-b', true).categories[1].count, 3);
  });

  it('wyłączona kategoria zachowuje pozycję oraz własne `W` i `P`', () => {
    const narrowed = withVariantLimit(db, params, 'cat-c', 1);
    const disabled = withCategoryActive(db, narrowed, 'cat-c', false);
    assert.deepEqual(
      disabled.categories.map((entry) => entry.id),
      ['cat-a', 'cat-b', 'cat-c'],
    );
    assert.equal(categoryEntry(disabled, 'cat-c').count, 0);
    assert.equal(categoryEntry(disabled, 'cat-c').variantLimit, 1);
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
    const clamped = clampParams(
      db,
      makeParams([['cat-a', 10], ['cat-b', 10], ['cat-c', 10], ['cat-d', 10], ['cat-e', 10]], { level: 2 }),
    );
    assert.deepEqual(
      clamped.categories.map((entry) => entry.count),
      [4, 3, 2, 1, 1],
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

  it('nie zależy od kolejności kategorii ani od limitów', () => {
    const params = makeParams([
      ['cat-a', 2],
      ['cat-b', 1],
      ['cat-d', 1],
    ]);
    const reordered = withMovedCategory(withMovedCategory(params, 'cat-d', -1), 'cat-d', -1);
    assert.deepEqual(
      reordered.categories.map((entry) => entry.id),
      ['cat-d', 'cat-a', 'cat-b'],
    );
    assert.equal(buildSeedString(params, '1.0'), buildSeedString(reordered, '1.0'));

    const narrowed = withItemLimit(db, withVariantLimit(db, params, 'cat-d', 1), 'cat-d', 3);
    assert.equal(buildSeedString(params, '1.0'), buildSeedString({ ...narrowed, pick: 'losowo' }, '1.0'));
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
  it('kodowanie i dekodowanie zachowuje wybór, kolejność oraz limity kategorii', () => {
    const params = makeParams(
      [
        ['cat-c', 2],
        ['cat-a', 1],
        ['cat-b', 0],
      ],
      { pick: 'losowo' },
    );
    const encoded = encodeParams(params);
    assert.deepEqual(encoded, {
      d: '2026-09-10',
      l: '4',
      c: 'cat-c:2:2:0,cat-a:1:1:12',
      o: 'losowo',
    });

    const decoded = decodeParams(query(`d=${encoded.d}&l=${encoded.l}&c=${encoded.c}&o=${encoded.o}`), db);
    assert.equal(decoded.date, params.date);
    assert.equal(decoded.level, params.level);
    assert.equal(decoded.pick, 'losowo');
    assert.deepEqual(activeSelections(decoded), [
      { id: 'cat-c', count: 2, variantLimit: 2, itemLimit: 0 },
      { id: 'cat-a', count: 1, variantLimit: 1, itemLimit: 12 },
    ]);
    assert.equal(paramsSignature(decoded), paramsSignature(params));
  });

  it('adres niesie komplet `id:ćwiczenia:W:P`, także dla pól ukrytych w formularzu', () => {
    const encoded = encodeParams(makeParams([['cat-e', 1]]));
    assert.equal(encoded.c, 'cat-e:1:1:0');
  });

  it('brak parametrów daje pustą sesję na dziś z krańcami limitów', () => {
    const decoded = decodeParams(query(''), db);
    assert.equal(decoded.date, todayIso());
    assert.equal(decoded.level, DEFAULT_LEVEL);
    assert.equal(decoded.pick, DEFAULT_PICK);
    assert.equal(totalExercises(decoded), 0);
    assert.equal(categoryEntry(decoded, 'cat-d').variantLimit, 5);
    assert.equal(categoryEntry(decoded, 'cat-d').itemLimit, 39);
  });

  it('pomija nieznane kategorie, zera i duplikaty', () => {
    const decoded = decodeParams(query('c=cat-a:2,nieznana:3,cat-b:0,cat-a:5&l=4'), db);
    assert.deepEqual(activeSelections(decoded).map((entry) => [entry.id, entry.count]), [['cat-a', 2]]);
  });

  it('urwany wpis przyjmuje krańce swojej kategorii', () => {
    const decoded = decodeParams(query('c=cat-b,cat-d:1:2&l=4'), db);
    assert.deepEqual(
      activeSelections(decoded).map((entry) => [entry.id, entry.count, entry.variantLimit, entry.itemLimit]),
      [
        ['cat-b', 3, 1, 20],
        ['cat-d', 1, 2, 32],
      ],
    );
  });

  it('przycina liczby przekraczające limit poziomu', () => {
    const decoded = decodeParams(query('c=cat-a:6&l=1'), db);
    assert.deepEqual(activeSelections(decoded).map((entry) => [entry.id, entry.count]), [['cat-a', 3]]);
  });

  it('błędne wartości w adresie wracają do krańców', () => {
    const decoded = decodeParams(query('d=2026-02-30&l=17&c=cat-d:1:99:0,cat-c:1:9:9&o=byle-co'), db);
    assert.equal(decoded.date, todayIso());
    assert.equal(decoded.level, DEFAULT_LEVEL);
    assert.equal(decoded.pick, DEFAULT_PICK);
    assert.deepEqual(
      activeSelections(decoded).map((entry) => [entry.id, entry.variantLimit, entry.itemLimit]),
      [
        ['cat-d', 5, 5],
        ['cat-c', 2, 0],
      ],
    );
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

  it('rozróżnia limity pojedynczej kategorii i tryb doboru', () => {
    const params = makeParams([['cat-d', 1], ['cat-a', 1]]);
    assert.notEqual(paramsSignature(params), paramsSignature(withVariantLimit(db, params, 'cat-d', 2)));
    assert.notEqual(paramsSignature(params), paramsSignature(withItemLimit(db, params, 'cat-d', 5)));
    assert.notEqual(paramsSignature(params), paramsSignature({ ...params, pick: 'losowo' }));
  });
});
