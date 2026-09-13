import { activeSelections, buildSeedString, isExerciseEligible, paramsSignature } from './params.js';
import { createRng } from './rng.js';

export const PREFERRED_ITEMS_PER_VARIANT = 2;

const compareIds = (a, b) => {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
};

function eligibleExercises(db, categoryId, level) {
  return (db.exercisesByCategory.get(categoryId) ?? [])
    .filter((exercise) => isExerciseEligible(exercise, level))
    .sort((a, b) => compareIds(a.id, b.id));
}

/**
 * Podzbiór N elementów zgodnie z trybem doboru (APPLICATION §3.4).
 * `kolejnosc` — N kolejnych elementów od losowego punktu startowego, w kolejności z bazy.
 * `losowo` — N wylosowanych elementów, w kolejności losowania.
 */
export function pickSubset(list, count, pick, rng) {
  const size = Math.max(0, Math.min(count, list.length));
  if (size === 0) {
    return [];
  }
  if (pick === 'losowo') {
    return rng.sample(list, size);
  }
  const start = rng.int(list.length - size + 1);
  return list.slice(start, start + size);
}

/**
 * Podział budżetu pozycji między warianty mające pozycje (APPLICATION §3.3).
 * Najpierw po jednej pozycji na wariant, potem druga tam, gdzie wariant ma czym ją pokryć,
 * a reszta losowymi porcjami — nie proporcjonalnie do zasobu wariantu.
 */
export function shareItemBudget(capacities, budget, rng) {
  const shares = capacities.map(() => 0);
  let left = Math.max(0, Math.min(budget, capacities.reduce((total, size) => total + size, 0)));

  for (let index = 0; index < shares.length && left > 0; index += 1) {
    shares[index] = 1;
    left -= 1;
  }
  for (let index = 0; index < shares.length && left > 0; index += 1) {
    if (capacities[index] >= PREFERRED_ITEMS_PER_VARIANT && shares[index] < PREFERRED_ITEMS_PER_VARIANT) {
      shares[index] += 1;
      left -= 1;
    }
  }

  while (left > 0) {
    const hungry = capacities.map((unused, index) => index).filter((index) => shares[index] < capacities[index]);
    if (hungry.length === 0) {
      break;
    }
    const target = hungry[rng.int(hungry.length)];
    const take = 1 + rng.int(Math.min(capacities[target] - shares[target], left));
    shares[target] += take;
    left -= take;
  }

  return shares;
}

/** `limits` to wpis kategorii, z której pochodzi ćwiczenie (APPLICATION §3.1). */
function buildVariantViews(exercise, limits, pick, rng) {
  const chosen = pickSubset(exercise.variants, limits.variantLimit, pick, rng);

  if (!exercise.randomizable) {
    return chosen.map((variant) => ({ variant, items: [...variant.items] }));
  }

  const views = chosen.map((variant) => ({ variant, items: [] }));
  const withItems = views.filter((view) => view.variant.items.length > 0);
  const shares = shareItemBudget(
    withItems.map((view) => view.variant.items.length),
    limits.itemLimit,
    rng,
  );
  withItems.forEach((view, index) => {
    view.items = pickSubset(view.variant.items, shares[index], pick, rng);
  });

  return views;
}

export function buildPlan(db, params, seedOverride = null) {
  const seed = seedOverride ?? buildSeedString(params, db.schemaVersion);
  const rng = createRng(seed);
  const selections = activeSelections(params);

  const limitsByCategory = new Map(selections.map((selection) => [selection.id, selection]));

  const drawnByCategory = new Map();
  [...selections]
    .sort((a, b) => compareIds(a.id, b.id))
    .forEach((selection) => {
      const candidates = eligibleExercises(db, selection.id, params.level);
      drawnByCategory.set(selection.id, rng.sample(candidates, selection.count));
    });

  const variantViews = new Map();
  [...drawnByCategory.values()]
    .flat()
    .sort((a, b) => compareIds(a.id, b.id))
    .forEach((exercise) => {
      // Ziarno pochodne: limity i tryb doboru działają w osobnej fazie, więc ich zmiana
      // przekształca zawartość kroku, ale nie przesuwa sekwencji w pozostałych krokach.
      const limits = limitsByCategory.get(exercise.categoryId);
      variantViews.set(
        exercise.id,
        buildVariantViews(exercise, limits, params.pick, createRng(`${seed}|${exercise.id}`)),
      );
    });

  const steps = [];
  selections.forEach((selection) => {
    (drawnByCategory.get(selection.id) ?? []).forEach((exercise) => {
      steps.push({
        exercise,
        category: db.categoryById.get(exercise.categoryId),
        variants: variantViews.get(exercise.id),
      });
    });
  });

  return {
    seed,
    seedOverride,
    signature: paramsSignature(params),
    params,
    steps,
  };
}
