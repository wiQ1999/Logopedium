import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSeedString, withMovedCategory } from '../src/webapp/js/params.js';
import { MAX_ITEMS_PER_VARIANT, buildPlan } from '../src/webapp/js/picker.js';
import { loadDatabaseFixture, makeFixtureDatabase, makeParams } from './helpers.js';

const db = makeFixtureDatabase();
const realDb = loadDatabaseFixture();

const exerciseIds = (plan) => plan.steps.map((step) => step.exercise.id);
const itemIds = (plan) => plan.steps.flatMap((step) => step.variants.flatMap((view) => view.items.map((item) => item.id)));

describe('budowa planu sesji', () => {
  it('plan ma tyle kroków, ile wskazują parametry', () => {
    const params = makeParams([
      ['cat-a', 3],
      ['cat-b', 2],
      ['cat-c', 1],
    ]);
    const plan = buildPlan(db, params);
    assert.equal(plan.steps.length, 6);
  });

  it('pomija kategorie nieaktywne', () => {
    const plan = buildPlan(db, makeParams([['cat-a', 2], ['cat-b', 0], ['cat-c', 0]]));
    assert.equal(plan.steps.length, 2);
    assert.ok(plan.steps.every((step) => step.exercise.categoryId === 'cat-a'));
  });

  it('nie powtarza ćwiczeń w obrębie sesji', () => {
    const params = makeParams([
      ['cat-a', 6],
      ['cat-b', 3],
      ['cat-c', 2],
    ]);
    const ids = exerciseIds(buildPlan(db, params));
    assert.equal(new Set(ids).size, ids.length);
  });

  it('odrzuca ćwiczenia powyżej ustawionego poziomu', () => {
    const plan = buildPlan(db, makeParams([['cat-a', 6]], { level: 2 }));
    assert.equal(plan.steps.length, 4);
    assert.ok(plan.steps.every((step) => step.exercise.level === null || step.exercise.level <= 2));
  });

  it('nie losuje więcej ćwiczeń, niż jest dostępnych', () => {
    const plan = buildPlan(db, { ...makeParams([['cat-c', 99]]) });
    assert.equal(plan.steps.length, 2);
  });

  it('układa kroki zgodnie z kolejnością kategorii z parametrów', () => {
    const params = makeParams([
      ['cat-c', 2],
      ['cat-a', 2],
      ['cat-b', 1],
    ]);
    const plan = buildPlan(db, params);
    assert.deepEqual(
      plan.steps.map((step) => step.exercise.categoryId),
      ['cat-c', 'cat-c', 'cat-a', 'cat-a', 'cat-b'],
    );
  });

  it('dołącza kategorię do każdego kroku', () => {
    const plan = buildPlan(db, makeParams([['cat-a', 2]]));
    assert.ok(plan.steps.every((step) => step.category.id === step.exercise.categoryId));
    assert.equal(plan.steps[0].category.name, 'Kategoria A');
  });
});

describe('powtarzalność losowania', () => {
  const params = makeParams([
    ['cat-a', 3],
    ['cat-b', 2],
  ]);

  it('ten sam dzień i te same parametry dają ten sam plan', () => {
    const first = buildPlan(db, params);
    const second = buildPlan(db, params);
    assert.deepEqual(exerciseIds(first), exerciseIds(second));
    assert.deepEqual(itemIds(first), itemIds(second));
    assert.equal(first.seed, second.seed);
  });

  it('ziarno planu odpowiada parametrom', () => {
    assert.equal(buildPlan(db, params).seed, buildSeedString(params, db.schemaVersion));
  });

  it('inna data zmienia ziarno i dobór ćwiczeń', () => {
    const other = { ...params, date: '2026-09-11' };
    assert.notEqual(buildPlan(db, params).seed, buildPlan(db, other).seed);

    const dates = ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'];
    const baseline = exerciseIds(buildPlan(realDb, makeParams([['tekst-do-czytania-terapeutycznego', 3]])));
    const different = dates.some((date) => {
      const plan = buildPlan(realDb, makeParams([['tekst-do-czytania-terapeutycznego', 3]], { date }));
      return JSON.stringify(exerciseIds(plan)) !== JSON.stringify(baseline);
    });
    assert.ok(different, 'zmiana daty powinna zmieniać dobór ćwiczeń');
  });

  it('zmiana kolejności kategorii nie zmienia doboru ćwiczeń', () => {
    const base = makeParams([
      ['cat-a', 3],
      ['cat-b', 2],
      ['cat-c', 1],
    ]);
    const reordered = withMovedCategory(withMovedCategory(base, 'cat-c', -1), 'cat-c', -1);

    const basePlan = buildPlan(db, base);
    const reorderedPlan = buildPlan(db, reordered);

    assert.equal(basePlan.seed, reorderedPlan.seed);
    assert.deepEqual(new Set(exerciseIds(basePlan)), new Set(exerciseIds(reorderedPlan)));
    assert.deepEqual(new Set(itemIds(basePlan)), new Set(itemIds(reorderedPlan)));
    assert.notDeepEqual(exerciseIds(basePlan), exerciseIds(reorderedPlan));
  });

  it('dobór w kategorii nie zależy od obecności innych kategorii', () => {
    const alone = buildPlan(db, makeParams([['cat-a', 2]]));
    const withOthers = buildPlan(db, makeParams([['cat-a', 2], ['cat-b', 2]]));
    assert.notEqual(alone.seed, withOthers.seed);

    const sameSeed = buildPlan(db, makeParams([['cat-a', 2], ['cat-b', 2]]), 'wspolne-ziarno');
    const sameSeedReordered = buildPlan(db, makeParams([['cat-b', 2], ['cat-a', 2]]), 'wspolne-ziarno');
    const aFromFirst = sameSeed.steps.filter((step) => step.exercise.categoryId === 'cat-a').map((step) => step.exercise.id);
    const aFromSecond = sameSeedReordered.steps
      .filter((step) => step.exercise.categoryId === 'cat-a')
      .map((step) => step.exercise.id);
    assert.deepEqual(aFromFirst, aFromSecond);
  });

  it('ziarno z adresu nadpisuje ziarno wyliczone z parametrów', () => {
    const withOverride = buildPlan(db, params, 'ziarno-testowe');
    assert.equal(withOverride.seed, 'ziarno-testowe');
    assert.equal(withOverride.seedOverride, 'ziarno-testowe');

    const otherDate = buildPlan(db, { ...params, date: '2030-01-01' }, 'ziarno-testowe');
    assert.deepEqual(exerciseIds(withOverride), exerciseIds(otherDate));
  });

  it('różne ziarna dają różne zestawy', () => {
    const first = exerciseIds(buildPlan(realDb, makeParams([['tekst-do-czytania-terapeutycznego', 4]]), 'ziarno-1'));
    const second = exerciseIds(buildPlan(realDb, makeParams([['tekst-do-czytania-terapeutycznego', 4]]), 'ziarno-2'));
    assert.notDeepEqual(first, second);
  });
});

describe('dobór pozycji w wariantach', () => {
  it('ćwiczenie bez zgody na losowanie zachowuje wszystkie pozycje', () => {
    const plan = buildPlan(db, makeParams([['cat-b', 3]]));
    const notRandomizable = plan.steps.find((step) => step.exercise.id === 'b1');
    assert.ok(notRandomizable);
    assert.equal(notRandomizable.variants[0].items.length, 20);
  });

  it('ćwiczenie losowalne dostaje ograniczoną liczbę pozycji', () => {
    const plan = buildPlan(db, makeParams([['cat-a', 6]]));
    plan.steps.forEach((step) => {
      assert.equal(step.variants[0].items.length, MAX_ITEMS_PER_VARIANT);
    });
  });

  it('krótka lista pozycji pozostaje w całości', () => {
    const plan = buildPlan(db, makeParams([['cat-b', 3]]));
    const short = plan.steps.find((step) => step.exercise.id === 'b3');
    assert.equal(short.variants[0].items.length, 4);
  });

  it('wylosowane pozycje zachowują kolejność z bazy', () => {
    const plan = buildPlan(db, makeParams([['cat-a', 6]]));
    plan.steps.forEach((step) => {
      const source = step.exercise.variants[0].items.map((item) => item.id);
      const drawn = step.variants[0].items.map((item) => item.id);
      const positions = drawn.map((id) => source.indexOf(id));
      assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    });
  });

  it('warianty bez pozycji nie dostają wylosowanej listy', () => {
    const plan = buildPlan(db, makeParams([['cat-c', 2]]));
    plan.steps.forEach((step) => {
      step.variants.forEach((view) => {
        assert.equal(view.items.length, 0);
        assert.ok(['text', 'syllables', 'prompt'].includes(view.variant.type));
      });
    });
  });

  it('warianty są ułożone według pola order', () => {
    const plan = buildPlan(db, makeParams([['cat-c', 2]]));
    const multi = plan.steps.find((step) => step.exercise.id === 'c2');
    assert.deepEqual(
      multi.variants.map((view) => view.variant.id),
      ['c2-w1', 'c2-w2'],
    );
  });
});

describe('plan na pełnej bazie', () => {
  it('obejmuje wszystkie kategorie po jednym ćwiczeniu', () => {
    const params = {
      date: '2026-09-10',
      level: 4,
      categories: realDb.categories.map((category) => ({ id: category.id, count: 1 })),
    };
    const plan = buildPlan(realDb, params);
    assert.equal(plan.steps.length, realDb.categories.length);
    assert.deepEqual(
      plan.steps.map((step) => step.exercise.categoryId),
      realDb.categories.map((category) => category.id),
    );
    assert.equal(new Set(exerciseIds(plan)).size, plan.steps.length);
  });

  it('każdy krok ma co najmniej jedną treść do wykonania', () => {
    const params = {
      date: '2026-09-10',
      level: 4,
      categories: realDb.categories.map((category) => ({ id: category.id, count: 1 })),
    };
    buildPlan(realDb, params).steps.forEach((step) => {
      const hasContent = step.variants.some(
        (view) =>
          view.items.length > 0 ||
          view.variant.textHtml ||
          view.variant.syllablesHtml ||
          view.variant.instructionHtml ||
          step.exercise.instructionHtml,
      );
      assert.ok(hasContent, `krok bez treści: ${step.exercise.id}`);
    });
  });

  it('powtórzone wywołanie na pełnej bazie daje identyczny plan', () => {
    const params = {
      date: '2026-09-10',
      level: 3,
      categories: realDb.categories.map((category) => ({ id: category.id, count: 2 })),
    };
    const first = buildPlan(realDb, params);
    const second = buildPlan(realDb, params);
    assert.deepEqual(exerciseIds(first), exerciseIds(second));
    assert.deepEqual(itemIds(first), itemIds(second));
  });
});
