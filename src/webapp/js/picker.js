import { activeSelections, buildSeedString, isExerciseEligible, paramsSignature } from './params.js';
import { createRng } from './rng.js';

export const MAX_ITEMS_PER_VARIANT = 8;

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

function buildVariantViews(exercise, rng) {
  return exercise.variants.map((variant) => {
    if (variant.type !== 'items' || variant.items.length === 0) {
      return { variant, items: [] };
    }
    if (!exercise.randomizable || variant.items.length <= MAX_ITEMS_PER_VARIANT) {
      return { variant, items: [...variant.items] };
    }
    const pool = [...variant.items].sort((a, b) => compareIds(a.id, b.id));
    const drawn = new Set(rng.sample(pool, MAX_ITEMS_PER_VARIANT).map((item) => item.id));
    return { variant, items: variant.items.filter((item) => drawn.has(item.id)) };
  });
}

export function buildPlan(db, params, seedOverride = null) {
  const seed = seedOverride ?? buildSeedString(params, db.schemaVersion);
  const rng = createRng(seed);
  const selections = activeSelections(params);

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
      variantViews.set(exercise.id, buildVariantViews(exercise, rng));
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
