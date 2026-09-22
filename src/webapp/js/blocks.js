import { MAX_LEVEL, MIN_LEVEL } from './data.js';
import { clearSettings, readSettings, writeSettings } from './settings.js';

export const DEFAULT_LEVEL = MAX_LEVEL;
export const PICK_MODES = ['kolejnosc', 'losowo'];
export const DEFAULT_PICK = 'kolejnosc';

export function todayIso(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const isExerciseEligible = (exercise, level) => exercise.level == null || exercise.level <= level;
const categoryIds = (db, id) => (db.exercisesByCategory.get(id) ?? []).map((e) => e.id);
const clamp = (value, min, max) => {
  const number = value == null || value === '' ? NaN : Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : max;
};

export function blockExercises(db, block, level) {
  const entries = typeof block === 'string' ? categoryIds(db, block).map((id) => ({ id, active: true })) : block.exercises;
  return entries.filter((e) => e.active).map((e) => db.exerciseById.get(e.id))
    .filter((e) => e && isExerciseEligible(e, level));
}

export function variantBounds(db, block, level) {
  return { min: 1, max: blockExercises(db, block, level).reduce((n, e) => Math.max(n, e.variants.length), 1) };
}

export function itemBounds(db, block, level, variantLimit) {
  const max = blockExercises(db, block, level).reduce((best, e) => Math.max(best,
    e.variants.filter((v) => v.type === 'items').map((v) => v.items.length)
      .sort((a, b) => b - a).slice(0, variantLimit).reduce((sum, n) => sum + n, 0)), 0);
  return { min: Math.min(variantLimit, max), max };
}

function clampBlock(db, block, level) {
  const variants = variantBounds(db, block, level);
  const variantLimit = clamp(block.variantLimit, variants.min, variants.max);
  const items = itemBounds(db, block, level, variantLimit);
  const ids = categoryIds(db, block.id);
  return { ...block, count: clamp(block.count, 0, blockExercises(db, block, level).length), variantLimit,
    itemLimit: clamp(block.itemLimit, items.min, items.max),
    pick: PICK_MODES.includes(block.pick) ? block.pick : DEFAULT_PICK,
    wholeCategory: block.exercises.length === ids.length && block.exercises.every((e, i) => e.active && e.id === ids[i]) };
}

/** Validates membership globally: an exercise belongs to exactly one block. */
export function clampParams(db, params) {
  const level = clamp(params.level, MIN_LEVEL, MAX_LEVEL);
  const seen = new Set();
  const keys = new Set();
  const blocks = [];
  for (const entry of params.blocks ?? []) {
    if (!entry || !db.categoryById.has(entry.id)) continue;
    const exercises = (entry.exercises ?? categoryIds(db, entry.id).map((id) => ({ id, active: true })))
      .filter((e) => {
        if (!e || seen.has(e.id) || db.exerciseById.get(e.id)?.categoryId !== entry.id) return false;
        seen.add(e.id);
        return true;
      }).map((e) => ({ id: e.id, active: e.active !== false }));
    if (!exercises.length) continue;
    let key = entry.key ?? entry.id;
    while (keys.has(key)) key += '-block';
    keys.add(key);
    blocks.push(clampBlock(db, { ...entry, key, exercises }, level));
  }
  return { date: isValidIsoDate(params.date) ? params.date : todayIso(), level, blocks };
}

export function createDefaultParams(db, date = todayIso()) {
  return clampParams(db, { date, level: DEFAULT_LEVEL, blocks: db.categories.map(({ id }) => ({ id })) });
}

export const blockEntry = (params, key) => params.blocks.find((b) => b.key === key);
const changeBlock = (params, key, change) => ({ ...params, blocks: params.blocks.map((b) => b.key === key ? { ...b, ...change } : b) });
export const withDate = (params, date) => ({ ...params, date: isValidIsoDate(date) ? date : params.date });
export const withLevel = (db, params, level) => clampParams(db, { ...params, level });
export const withPick = (params, key, pick) => PICK_MODES.includes(pick) ? changeBlock(params, key, { pick }) : params;
export const withBlockCount = (db, params, key, count) => clampParams(db, changeBlock(params, key, { count }));
export const withBlockActive = (db, params, key, active) => withBlockCount(db, params, key, active ? undefined : 0);
export const withVariantLimit = (db, params, key, variantLimit) => clampParams(db, changeBlock(params, key, { variantLimit }));
export const withItemLimit = (db, params, key, itemLimit) => clampParams(db, changeBlock(params, key, { itemLimit }));

export function withExerciseActive(db, params, key, id, active) {
  const block = blockEntry(params, key);
  if (!block) return params;
  return clampParams(db, changeBlock(params, key, { exercises: block.exercises.map((e) => e.id === id ? { ...e, active } : e) }));
}

export function withMovedBlock(params, key, target) {
  const blocks = [...params.blocks];
  const index = blocks.findIndex((b) => b.key === key);
  if (index < 0 || target < 0 || target >= blocks.length) return params;
  blocks.splice(target, 0, blocks.splice(index, 1)[0]);
  return { ...params, blocks };
}

/** A null destination splits off a new block directly below the source. */
export function withMovedExercise(db, params, sourceKey, id, targetKey = null, position = Infinity) {
  const source = blockEntry(params, sourceKey);
  const target = blockEntry(params, targetKey);
  const exercise = source?.exercises.find((e) => e.id === id);
  if (!exercise || (targetKey !== null && (!target || source.id !== target.id))) return params;
  const blocks = params.blocks.map((b) => ({ ...b, exercises: b.exercises.filter((e) => e.id !== id) }));
  if (target) {
    const destination = blocks.find((b) => b.key === targetKey);
    destination.exercises.splice(Math.min(position, destination.exercises.length), 0, exercise);
  } else {
    let key = `${source.key}-block`;
    while (blocks.some((b) => b.key === key)) key += '-block';
    blocks.splice(blocks.findIndex((b) => b.key === sourceKey) + 1, 0,
      { id: source.id, key, pick: source.pick, exercises: [exercise] });
  }
  return clampParams(db, { ...params, blocks });
}

export const activeSelections = (params) => params.blocks.filter((b) => b.count > 0 && b.exercises.some((e) => e.active));
export const totalExercises = (params) => activeSelections(params).reduce((n, b) => n + b.count, 0);
export const blockSeedKey = (b) => JSON.stringify([b.id, b.exercises.filter((e) => e.active).map((e) => e.id).sort(), b.count]);
export function buildSeedString(params, version, revision = '') {
  return `logopedium|v=${version}|r=${revision}|d=${params.date}|l=${params.level}|b=${activeSelections(params).map(blockSeedKey).sort().join(';')}`;
}

const encodeSelection = (params) => activeSelections(params).map((b) => {
  const base = `${encodeURIComponent(b.id)}:${b.count}:${b.variantLimit}:${b.itemLimit}:${b.pick}`;
  return b.wholeCategory ? base : `${base}:${b.exercises.filter((e) => e.active).map((e) => encodeURIComponent(e.id)).join('+')}`;
}).join(',');
export const paramsSignature = (params) => `${params.date}|${params.level}|${encodeSelection(params)}`;
export const SESSION_STATE_VERSION = 1;

function base64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Nieprawidłowy zapis stanu sesji.');
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function encodeSessionState(params, db, seedOverride = null) {
  const categoryIndexes = new Map(db.categories.map((category, index) => [category.id, index]));
  const exerciseIndexes = new Map(db.exercises.map((exercise, index) => [exercise.id, index]));
  const blocks = activeSelections(params).map((block) => {
    const encoded = [categoryIndexes.get(block.id), block.count, block.variantLimit, block.itemLimit,
      PICK_MODES.indexOf(block.pick)];
    if (!block.wholeCategory) encoded.push(block.exercises.filter((exercise) => exercise.active)
      .map((exercise) => exerciseIndexes.get(exercise.id)));
    return encoded;
  });
  return base64UrlEncode(JSON.stringify([
    SESSION_STATE_VERSION,
    db.schemaVersion,
    db.generated,
    params.date,
    params.level,
    blocks,
    seedOverride,
  ]));
}

function defaultSessionState(db) {
  return { params: createDefaultParams(db), seedOverride: null, valid: false };
}

export function decodeSessionState(value, db) {
  if (typeof value !== 'string' || !value) return defaultSessionState(db);
  try {
    const payload = JSON.parse(base64UrlDecode(value));
    if (!Array.isArray(payload) || payload.length !== 7) return defaultSessionState(db);
    const [version, schemaVersion, generated, date, level, encodedBlocks, seedOverride] = payload;
    if (version !== SESSION_STATE_VERSION || schemaVersion !== db.schemaVersion || generated !== db.generated ||
        !isValidIsoDate(date) || !Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL ||
        !Array.isArray(encodedBlocks) || !encodedBlocks.length ||
        !(seedOverride === null || (typeof seedOverride === 'string' && seedOverride.length > 0))) {
      return defaultSessionState(db);
    }

    const seenExercises = new Set();
    const blocks = encodedBlocks.map((encoded) => {
      if (!Array.isArray(encoded) || ![5, 6].includes(encoded.length) || encoded.some((part, index) => index < 5 && !Number.isInteger(part))) {
        throw new Error('Nieprawidłowy blok sesji.');
      }
      const [categoryIndex, count, variantLimit, itemLimit, pickIndex, exerciseIndexes] = encoded;
      const category = db.categories[categoryIndex];
      if (!category || !PICK_MODES[pickIndex] || count < 1 || variantLimit < 1 || itemLimit < 0) {
        throw new Error('Nieprawidłowe ustawienia bloku.');
      }
      let exercises;
      if (exerciseIndexes !== undefined) {
        if (!Array.isArray(exerciseIndexes) || !exerciseIndexes.length || exerciseIndexes.some((index) => !Number.isInteger(index))) {
          throw new Error('Nieprawidłowa lista ćwiczeń.');
        }
        exercises = exerciseIndexes.map((index) => {
          const exercise = db.exercises[index];
          if (!exercise || exercise.categoryId !== category.id || seenExercises.has(exercise.id)) {
            throw new Error('Nieprawidłowe ćwiczenie w bloku.');
          }
          seenExercises.add(exercise.id);
          return { id: exercise.id, active: true };
        });
      } else {
        exercises = categoryIds(db, category.id).map((id) => {
          if (seenExercises.has(id)) throw new Error('Ćwiczenie występuje w kilku blokach.');
          seenExercises.add(id);
          return { id, active: true };
        });
      }
      return { id: category.id, count, variantLimit, itemLimit, pick: PICK_MODES[pickIndex], exercises };
    });

    let params = clampParams(db, { date, level, blocks });
    if (encodeSessionState(params, db, seedOverride) !== value) return defaultSessionState(db);

    // Omitted material is retained as inactive, so returning to parameters allows re-enabling it.
    const seen = new Set(params.blocks.flatMap((block) => block.exercises.map((exercise) => exercise.id)));
    for (const category of db.categories) {
      const first = params.blocks.find((block) => block.id === category.id);
      const missing = categoryIds(db, category.id).filter((id) => !seen.has(id));
      if (first) first.exercises.push(...missing.map((id) => ({ id, active: false })));
      else if (missing.length) {
        const block = { id: category.id, count: 0 };
        // Inactive categories return to their default slots without changing active block order.
        const index = Math.min(db.categories.indexOf(category), params.blocks.length);
        params.blocks.splice(index, 0, block);
      }
    }
    params = clampParams(db, params);
    return { params, seedOverride, valid: true };
  } catch {
    return defaultSessionState(db);
  }
}

export function storeParams(params) {
  return writeSettings({ level: params.level, blocks: params.blocks.map((b) => ({ id: b.id, count: b.count,
    variantLimit: b.variantLimit, itemLimit: b.itemLimit, pick: b.pick,
    ...(b.wholeCategory ? {} : { exercises: b.exercises }) })) });
}
export const forgetParams = () => clearSettings();

export function loadStoredParams(db, date = todayIso()) {
  const stored = readSettings();
  if (!stored || !Array.isArray(stored.blocks) || stored.blocks.some((b) => !b || typeof b !== 'object' || Array.isArray(b) || typeof b.id !== 'string' ||
      (b.exercises !== undefined && (!Array.isArray(b.exercises) || b.exercises.some((e) => !e || typeof e.id !== 'string' || typeof e.active !== 'boolean'))))) return null;
  let params = clampParams(db, { date, level: stored.level, blocks: stored.blocks });
  const seen = new Set(params.blocks.flatMap((b) => b.exercises.map((e) => e.id)));
  for (const category of db.categories) {
    const missing = categoryIds(db, category.id).filter((id) => !seen.has(id)).map((id) => ({ id, active: true }));
    const first = params.blocks.find((b) => b.id === category.id);
    if (first) first.exercises.push(...missing);
    else if (missing.length) params.blocks.push({ id: category.id, exercises: missing });
  }
  return clampParams(db, params);
}
