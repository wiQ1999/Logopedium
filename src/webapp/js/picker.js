import { activeSelections, blockExercises, blockSeedKey, buildSeedString, paramsSignature } from './blocks.js';
import { createRng } from './rng.js';

export const PREFERRED_ITEMS_PER_VARIANT = 2;

const compareIds = (a, b) => {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
};

/**
 * Podzbiór N elementów zgodnie z trybem doboru (APPLICATION §3.5).
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
 * Podział budżetu pozycji między warianty mające pozycje (APPLICATION §3.4).
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

/** `limits` to blok, z którego pochodzi ćwiczenie (APPLICATION §3.1). */
function buildVariantViews(exercise, limits, pick, rng) {
  const chosen = pickSubset(exercise.variants, limits.variantLimit, pick, rng);

  if (!exercise.randomizable) {
    return chosen.map((variant) => ({ variant, items: [...variant.items] }));
  }

  const views = chosen.map((variant) => ({ variant, items: [] }));
  const withItems = views.filter((view) => view.variant.type === 'items' && view.variant.items.length > 0);
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
  const seed = seedOverride ?? buildSeedString(params, db.schemaVersion, db.generated);
  const rng = createRng(seed);
  const selections = activeSelections(params);

  const drawnByBlock = new Map();
  [...selections]
    .sort((a, b) => compareIds(blockSeedKey(a), blockSeedKey(b)))
    .forEach((selection) => {
      const ordered = blockExercises(db, selection, params.level);
      const drawn = new Set(rng.sample([...ordered].sort((a, b) => compareIds(a.id, b.id)), selection.count).map((e) => e.id));
      drawnByBlock.set(selection.key, ordered.filter((e) => drawn.has(e.id)));
    });

  const steps = [];
  selections.forEach((selection) => {
    (drawnByBlock.get(selection.key) ?? []).forEach((exercise) => {
      steps.push({
        exercise,
        category: db.categoryById.get(exercise.categoryId),
        variants: buildVariantViews(exercise, selection, selection.pick, createRng(`${seed}|${exercise.id}`)),
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
