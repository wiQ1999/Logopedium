import { readFileSync } from 'node:fs';
import { buildDatabase } from '../src/webapp/js/data.js';

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
    order: 1,
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
      { id: 'cat-a', name: 'Kategoria A', order: 1 },
      { id: 'cat-b', name: 'Kategoria B', order: 2 },
      { id: 'cat-c', name: 'Kategoria C', order: 3 },
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
          makeVariant({ id: 'c2-w2', order: 2, type: 'prompt', instructionHtml: '<p>Zadanie długoterminowe</p>' }),
          makeVariant({ id: 'c2-w1', order: 1, type: 'syllables', syllablesHtml: 'ma me my mo mu' }),
        ],
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

export function makeParams(entries, overrides = {}) {
  return {
    date: '2026-09-10',
    level: 4,
    categories: entries.map(([id, count]) => ({ id, count })),
    ...overrides,
  };
}
