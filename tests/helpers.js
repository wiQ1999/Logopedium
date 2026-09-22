import { readFileSync } from 'node:fs';
import { buildDatabase } from '../src/webapp/js/data.js';
import { clampParams } from '../src/webapp/js/blocks.js';

const DATABASE_PATH = new URL('../src/webapp/data/database.json', import.meta.url);

export function loadRawDatabase() {
  return JSON.parse(readFileSync(DATABASE_PATH, 'utf8'));
}

export function loadDatabaseFixture() {
  return buildDatabase(loadRawDatabase());
}

export function makeItems(prefix, count) {
  return Array.from({ length: count }, (unused, index) => ({
    id: `${prefix}-p${String(index + 1).padStart(2, '0')}`,
    html: `pozycja ${index + 1}`,
  }));
}

export function makeVariant(overrides = {}) {
  return {
    id: 'v1',
    label: null,
    type: 'items',
    instructionHtml: null,
    syllablesHtml: null,
    textHtml: null,
    noteHtml: null,
    examples: [],
    items: [],
    ...overrides,
  };
}

export function makeExercise(overrides = {}) {
  const id = overrides.id ?? 'ex-1';
  return {
    id,
    title: `Ćwiczenie ${id}`,
    categoryId: 'cat-a',
    phonemes: [],
    positions: [],
    level: null,
    randomizable: true,
    readQuality: 'pewny',
    source: { file: `${id}.jpg`, kind: 'zdjecie', publication: null },
    notes: null,
    headerHtml: null,
    contextHtml: null,
    instructionHtml: null,
    variants: [makeVariant({ id: `${id}-w1`, items: makeItems(`${id}-w1`, 12) })],
    ...overrides,
  };
}

export function makeRawDatabase(overrides = {}) {
  return {
    schemaVersion: '1.0',
    generated: '2026-01-01',
    categories: [
      { id: 'cat-a', name: 'Kategoria A' },
      { id: 'cat-b', name: 'Kategoria B' },
      { id: 'cat-c', name: 'Kategoria C' },
      { id: 'cat-d', name: 'Kategoria D' },
      { id: 'cat-e', name: 'Kategoria E' },
    ],
    exercises: [
      makeExercise({ id: 'a1', categoryId: 'cat-a', level: 1 }),
      makeExercise({ id: 'a2', categoryId: 'cat-a', level: 2 }),
      makeExercise({ id: 'a3', categoryId: 'cat-a', level: 3 }),
      makeExercise({ id: 'a4', categoryId: 'cat-a', level: 4 }),
      makeExercise({ id: 'a5', categoryId: 'cat-a', level: null }),
      makeExercise({ id: 'a6', categoryId: 'cat-a', level: null }),
      makeExercise({
        id: 'b1',
        categoryId: 'cat-b',
        randomizable: false,
        variants: [makeVariant({ id: 'b1-w1', items: makeItems('b1-w1', 20) })],
      }),
      makeExercise({
        id: 'b2',
        categoryId: 'cat-b',
        randomizable: false,
        variants: [makeVariant({ id: 'b2-w1', items: makeItems('b2-w1', 5) })],
      }),
      makeExercise({
        id: 'b3',
        categoryId: 'cat-b',
        variants: [makeVariant({ id: 'b3-w1', items: makeItems('b3-w1', 4) })],
      }),
      makeExercise({
        id: 'c1',
        categoryId: 'cat-c',
        variants: [makeVariant({ id: 'c1-w1', type: 'text', textHtml: '<p>Tekst pierwszy</p>' })],
      }),
      makeExercise({
        id: 'c2',
        categoryId: 'cat-c',
        variants: [
          makeVariant({ id: 'c2-w1', type: 'syllables', syllablesHtml: 'ma me my mo mu' }),
          makeVariant({ id: 'c2-w2', type: 'prompt', instructionHtml: '<p>Zadanie długoterminowe</p>' }),
        ],
      }),
      makeExercise({
        id: 'd1',
        categoryId: 'cat-d',
        variants: [
          makeVariant({ id: 'd1-w1', label: 'Zadanie 1', items: makeItems('d1-w1', 20) }),
          makeVariant({ id: 'd1-w2', label: 'Zadanie 2', type: 'text', textHtml: '<p>Tekst bez pozycji</p>' }),
          makeVariant({ id: 'd1-w3', label: 'Zadanie 3', items: makeItems('d1-w3', 12) }),
          makeVariant({ id: 'd1-w4', label: 'Zadanie 4', items: makeItems('d1-w4', 6) }),
          makeVariant({ id: 'd1-w5', label: 'Zadanie 5', items: makeItems('d1-w5', 1) }),
        ],
      }),
      makeExercise({
        id: 'e1',
        categoryId: 'cat-e',
        variants: [makeVariant({ id: 'e1-w1', type: 'text', textHtml: '<p>Sam tekst</p>' })],
      }),
    ],
    duplicates: [],
    nonTextMaterials: [],
    ...overrides,
  };
}

export function makeFixtureDatabase(overrides = {}) {
  return buildDatabase(makeRawDatabase(overrides));
}

/**
 * Krańce `W` i `P` kategorii bazy testowej. Pokryte są wszystkie cztery układy pól
 * z APPLICATION §3.3: oba pola (`cat-d`), samo `P` (`cat-a`, `cat-b`), samo `W` (`cat-c`),
 * żadnego (`cat-e`).
 */
export const FIXTURE_BOUNDS = {
  'cat-a': { variants: 1, items: 12 },
  'cat-b': { variants: 1, items: 20 },
  'cat-c': { variants: 2, items: 0 },
  'cat-d': { variants: 5, items: 39 },
  'cat-e': { variants: 1, items: 0 },
};

/** Wpis kategorii: `[id, ćwiczenia]` albo `[id, ćwiczenia, W, P]`; brak limitu = kraniec. */
export function makeParams(entries, overrides = {}) {
  return makeDbParams(makeFixtureDatabase(), entries, overrides);
}

/** To samo dla dołączonej bazy, gdzie krańców nie da się wypisać ręcznie. */
export function makeDbParams(db, entries, overrides = {}) {
  return clampParams(db, {
    date: '2026-09-10',
    level: 4,
    blocks: entries.map(([id, count, variantLimit, itemLimit]) => ({ id, count, variantLimit, itemLimit, pick: overrides.pick })),
    ...overrides,
  });
}
