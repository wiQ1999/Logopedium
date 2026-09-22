import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSeedString, withItemLimit, withMovedBlock, withPick, withVariantLimit } from '../src/webapp/js/params.js';
import { buildPlan, pickSubset, shareItemBudget } from '../src/webapp/js/picker.js';
import { createRng } from '../src/webapp/js/rng.js';
import { loadDatabaseFixture, makeDbParams, makeFixtureDatabase, makeParams } from './helpers.js';

const db = makeFixtureDatabase();
const realDb = loadDatabaseFixture();

const exerciseIds = (plan) => plan.steps.map((step) => step.exercise.id);
const itemIds = (plan) => plan.steps.flatMap((step) => step.variants.flatMap((view) => view.items.map((item) => item.id)));
const stepOf = (plan, id) => plan.steps.find((step) => step.exercise.id === id);
const countItems = (step) => step.variants.reduce((total, view) => total + view.items.length, 0);

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
    const plan = buildPlan(db, makeParams([['cat-c', 99]]));
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
    assert.equal(buildPlan(db, params).seed, buildSeedString(params, db.schemaVersion, db.generated));
  });

  it('rewizja treści zmienia ziarno bez zmiany schematu', () => {
    assert.notEqual(buildPlan(db, params).seed, buildPlan({ ...db, generated: '2026-09-22' }, params).seed);
  });

  it('inna data zmienia ziarno i dobór ćwiczeń', () => {
    const other = { ...params, date: '2026-09-11' };
    assert.notEqual(buildPlan(db, params).seed, buildPlan(db, other).seed);

    const dates = ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'];
    const baseline = exerciseIds(buildPlan(realDb, makeDbParams(realDb, [['teksty-do-czytania-terapeutycznego', 3]])));
    const different = dates.some((date) => {
      const plan = buildPlan(realDb, makeDbParams(realDb, [['teksty-do-czytania-terapeutycznego', 3]], { date }));
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
    const reordered = withMovedBlock(base, 'cat-c', 0);

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
    const wide = makeDbParams(realDb, [['teksty-do-czytania-terapeutycznego', 4]]);
    assert.notDeepEqual(exerciseIds(buildPlan(realDb, wide, 'ziarno-1')), exerciseIds(buildPlan(realDb, wide, 'ziarno-2')));
  });

  it('limity i tryb doboru nie wchodzą do ziarna ani nie zmieniają doboru ćwiczeń', () => {
    const base = makeParams([['cat-a', 4], ['cat-b', 2], ['cat-d', 1]]);
    const narrowed = withItemLimit(db, withVariantLimit(db, base, 'cat-d', 2), 'cat-a', 3);
    const narrow = withPick(narrowed, 'cat-a', 'losowo');

    assert.equal(buildPlan(db, base).seed, buildPlan(db, narrow).seed);
    assert.deepEqual(exerciseIds(buildPlan(db, base)), exerciseIds(buildPlan(db, narrow)));
  });

  it('zmiana budżetu jednej kategorii nie przenosi się na pozostałe', () => {
    const base = makeParams([['cat-a', 6], ['cat-d', 1]]);
    const narrower = withItemLimit(db, base, 'cat-a', 7);

    const first = buildPlan(db, base);
    const second = buildPlan(db, narrower);
    assert.deepEqual(exerciseIds(first), exerciseIds(second));

    const itemsFrom = (plan, categoryId) =>
      plan.steps
        .filter((step) => step.exercise.categoryId === categoryId)
        .map((step) => step.variants.flatMap((view) => view.items.map((item) => item.id)));

    assert.notDeepEqual(itemsFrom(first, 'cat-a'), itemsFrom(second, 'cat-a'));
    assert.deepEqual(itemsFrom(first, 'cat-d'), itemsFrom(second, 'cat-d'));
  });
});

describe('dobór podzbioru', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('tryb kolejność bierze elementy kolejno od losowego punktu startowego', () => {
    const drawn = pickSubset(list, 3, 'kolejnosc', createRng('ziarno'));
    assert.equal(drawn.length, 3);
    const start = list.indexOf(drawn[0]);
    assert.ok(start >= 0 && start <= list.length - 3);
    assert.deepEqual(drawn, list.slice(start, start + 3));
  });

  it('tryb kolejność przy pełnym limicie oddaje zbiór w kolejności z bazy', () => {
    assert.deepEqual(pickSubset(list, list.length, 'kolejnosc', createRng('ziarno')), list);
    assert.deepEqual(pickSubset(list, 99, 'kolejnosc', createRng('ziarno')), list);
  });

  it('tryb losowo tasuje także wtedy, gdy limit nie tnie zbioru', () => {
    const drawn = pickSubset(list, list.length, 'losowo', createRng('ziarno'));
    assert.deepEqual(new Set(drawn), new Set(list));
    assert.notDeepEqual(drawn, list);
  });

  it('pusty limit daje pusty zbiór', () => {
    assert.deepEqual(pickSubset(list, 0, 'kolejnosc', createRng('ziarno')), []);
    assert.deepEqual(pickSubset([], 3, 'losowo', createRng('ziarno')), []);
  });
});

describe('podział budżetu pozycji', () => {
  const rng = () => createRng('ziarno-budzetu');

  it('każdy wariant dostaje po jednej pozycji, gdy budżet równa się liczbie wariantów', () => {
    assert.deepEqual(shareItemBudget([20, 12, 6, 1], 4, rng()), [1, 1, 1, 1]);
  });

  it('preferuje dwie pozycje na wariant, o ile wariant ma czym je pokryć', () => {
    assert.deepEqual(shareItemBudget([20, 12, 6, 1], 7, rng()), [2, 2, 2, 1]);
  });

  it('nadwyżka ponad zasób wariantu wraca do podziału', () => {
    assert.deepEqual(shareItemBudget([3, 2], 5, rng()), [3, 2]);
  });

  it('nie rozdaje więcej, niż wynosi budżet i zasób wariantów', () => {
    const shares = shareItemBudget([20, 12, 6, 1], 15, rng());
    assert.equal(shares.reduce((total, share) => total + share, 0), 15);
    shares.forEach((share, index) => assert.ok(share <= [20, 12, 6, 1][index]));
    assert.ok(shares.every((share) => share >= 1));
  });

  it('budżet większy od zasobu oddaje wszystkie pozycje', () => {
    assert.deepEqual(shareItemBudget([4, 2], 99, rng()), [4, 2]);
  });

  it('zerowy budżet i pusta lista wariantów nie dostają nic', () => {
    assert.deepEqual(shareItemBudget([], 10, rng()), []);
    assert.deepEqual(shareItemBudget([5, 3], 0, rng()), [0, 0]);
  });
});

describe('limit wariantów w ćwiczeniu', () => {
  it('ogranicza liczbę pokazanych wariantów', () => {
    const plan = buildPlan(db, makeParams([['cat-d', 1, 2]]));
    assert.equal(stepOf(plan, 'd1').variants.length, 2);
  });

  it('ćwiczenie jednowariantowe pozostaje nietknięte', () => {
    const plan = buildPlan(db, makeParams([['cat-a', 6]]));
    assert.ok(plan.steps.every((step) => step.variants.length === 1));
  });

  it('limit obejmuje także warianty bez pozycji', () => {
    const plan = buildPlan(db, makeParams([['cat-c', 2, 1]]));
    assert.ok(plan.steps.every((step) => step.variants.length === 1));
  });

  it('limit jednej kategorii nie dotyczy ćwiczeń z innej', () => {
    const plan = buildPlan(db, makeParams([['cat-c', 2, 1], ['cat-d', 1]]));
    assert.equal(stepOf(plan, 'c2').variants.length, 1);
    assert.equal(stepOf(plan, 'd1').variants.length, 5);
  });

  it('warianty w trybie kolejność zachowują kolejność z bazy', () => {
    const plan = buildPlan(db, makeParams([['cat-c', 2]]));
    assert.deepEqual(
      stepOf(plan, 'c2').variants.map((view) => view.variant.id),
      ['c2-w1', 'c2-w2'],
    );
  });
});

describe('dobór pozycji w wariantach', () => {
  it('ćwiczenie bez zgody na losowanie zachowuje wszystkie pozycje', () => {
    const plan = buildPlan(db, makeParams([['cat-b', 3, 1, 5]]));
    assert.equal(stepOf(plan, 'b1').variants[0].items.length, 20);
  });

  it('krótka lista pozycji pozostaje w całości', () => {
    const plan = buildPlan(db, makeParams([['cat-b', 3]]));
    assert.equal(stepOf(plan, 'b3').variants[0].items.length, 4);
  });

  it('budżet pozycji obowiązuje na całe ćwiczenie, nie na wariant', () => {
    const plan = buildPlan(db, makeParams([['cat-d', 1, 5, 9]]));
    assert.equal(countItems(stepOf(plan, 'd1')), 9);
  });

  it('budżet jednej kategorii nie dotyczy ćwiczeń z innej', () => {
    const plan = buildPlan(db, makeParams([['cat-a', 6, 1, 3], ['cat-d', 1]]));
    plan.steps
      .filter((step) => step.exercise.categoryId === 'cat-a')
      .forEach((step) => assert.equal(countItems(step), 3));
    assert.equal(countItems(stepOf(plan, 'd1')), 39);
  });

  it('każdy wylosowany wariant z pozycjami dostaje co najmniej jedną pozycję', () => {
    const plan = buildPlan(db, makeParams([['cat-d', 1, 5, 5]]));
    const step = stepOf(plan, 'd1');
    const withItems = step.variants.filter((view) => view.variant.items.length > 0);
    assert.equal(withItems.length, 4);
    assert.ok(withItems.every((view) => view.items.length >= 1));
    assert.equal(countItems(step), 5);
  });

  it('warianty bez pozycji nie zużywają budżetu', () => {
    const plan = buildPlan(db, makeParams([['cat-d', 1, 5, 7]]));
    const step = stepOf(plan, 'd1');
    const empty = step.variants.find((view) => view.variant.type === 'text');
    assert.ok(empty);
    assert.equal(empty.items.length, 0);
    assert.equal(countItems(step), 7);
  });

  it('kategoria bez pozycji nie dostaje ich mimo limitu', () => {
    const plan = buildPlan(db, makeParams([['cat-c', 2], ['cat-e', 1]]));
    plan.steps.forEach((step) => assert.equal(countItems(step), 0));
  });

  it('ćwiczenie o mniejszym zasobie niż budżet podaje wszystko', () => {
    const plan = buildPlan(db, makeParams([['cat-d', 1]]));
    assert.equal(countItems(stepOf(plan, 'd1')), 39);
  });

  it('tryb kolejność bierze pozycje ciągiem z bazy', () => {
    const plan = buildPlan(db, makeParams([['cat-a', 6, 1, 5]]));
    plan.steps.forEach((step) => {
      const source = step.exercise.variants[0].items.map((item) => item.id);
      const positions = step.variants[0].items.map((item) => source.indexOf(item.id));
      assert.deepEqual(positions, positions.map((unused, index) => positions[0] + index));
    });
  });

  it('tryb losowo zmienia kolejność pozycji', () => {
    const plan = buildPlan(db, makeParams([['cat-a', 6]], { pick: 'losowo' }));
    const shuffled = plan.steps.some((step) => {
      const source = step.exercise.variants[0].items.map((item) => item.id);
      const drawn = step.variants[0].items.map((item) => item.id);
      assert.deepEqual(new Set(drawn), new Set(source));
      return JSON.stringify(drawn) !== JSON.stringify(source);
    });
    assert.ok(shuffled, 'tryb losowo powinien zmienić kolejność co najmniej jednego ćwiczenia');
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
});

describe('plan na pełnej bazie', () => {
  const everyCategory = ({ count = 1, ...overrides } = {}) =>
    makeDbParams(
      realDb,
      realDb.categories.map((category) => [category.id, count]),
      overrides,
    );

  it('obejmuje wszystkie kategorie po jednym ćwiczeniu', () => {
    const plan = buildPlan(realDb, everyCategory());
    assert.equal(plan.steps.length, realDb.categories.length);
    assert.deepEqual(
      plan.steps.map((step) => step.exercise.categoryId),
      realDb.categories.map((category) => category.id),
    );
    assert.equal(new Set(exerciseIds(plan)).size, plan.steps.length);
  });

  it('każdy krok ma co najmniej jedną treść do wykonania', () => {
    buildPlan(realDb, everyCategory()).steps.forEach((step) => {
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

  it('domyślne krańce kategorii nie tną żadnego ćwiczenia', () => {
    buildPlan(realDb, everyCategory()).steps.forEach((step) => {
      assert.equal(step.variants.length, step.exercise.variants.length);
      assert.equal(countItems(step), step.exercise.itemCount);
    });
  });

  it('ostrzejsze limity mieszczą się w budżecie', () => {
    const params = everyCategory();
    const narrowed = {
      ...params,
      blocks: params.blocks.map((entry) => ({
        ...entry,
        variantLimit: Math.min(2, entry.variantLimit),
        itemLimit: Math.min(6, entry.itemLimit),
      })),
    };
    buildPlan(realDb, narrowed).steps.forEach((step) => {
      assert.ok(step.variants.length <= 2, `krok ponad limit wariantów: ${step.exercise.id}`);
      if (step.exercise.randomizable) {
        assert.ok(countItems(step) <= 6, `krok ponad budżet: ${step.exercise.id}`);
      }
    });
  });

  it('powtórzone wywołanie na pełnej bazie daje identyczny plan', () => {
    const params = everyCategory({ level: 3, count: 2 });
    const first = buildPlan(realDb, params);
    const second = buildPlan(realDb, params);
    assert.deepEqual(exerciseIds(first), exerciseIds(second));
    assert.deepEqual(itemIds(first), itemIds(second));
  });
});
