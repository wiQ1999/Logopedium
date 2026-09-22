import { sanitizeHtml, visitHtml } from './html.js';

const DATABASE_URL = 'data/database.json';
const SUPPORTED_SCHEMA_MAJOR = '1';
const VARIANT_TYPES = ['items', 'text', 'syllables', 'prompt'];
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 4;

const MAX_REPORTED_ISSUES = 25;

export class DatabaseError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'DatabaseError';
    this.issues = issues;
  }
}

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
const isNullableString = (value) => value === null || typeof value === 'string';
const isStringArray = (value) => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const hasHtmlContent = (value) => {
  if (typeof value !== 'string') return false;
  const html = sanitizeHtml(value).html;
  return html.replace(/<[^>]*>/g, '').replace(/&(?:nbsp|#0*160|#x0*a0);/gi, ' ').trim() !== '' ||
    /<span class="[^"]*\b(?:blank|exhale)\b/.test(html);
};

function validateCategories(raw, issues) {
  const ids = new Set();

  if (!Array.isArray(raw.categories) || raw.categories.length === 0) {
    issues.push('categories: oczekiwano niepustej tablicy kategorii.');
    return ids;
  }

  raw.categories.forEach((category, index) => {
    const path = `categories[${index}]`;
    if (!isPlainObject(category)) {
      issues.push(`${path}: oczekiwano obiektu.`);
      return;
    }
    if (!isNonEmptyString(category.id)) {
      issues.push(`${path}.id: oczekiwano niepustego tekstu.`);
    } else if (ids.has(category.id)) {
      issues.push(`${path}.id: identyfikator "${category.id}" powtarza się.`);
    } else {
      ids.add(category.id);
    }
    if (!isNonEmptyString(category.name)) {
      issues.push(`${path}.name: oczekiwano niepustego tekstu.`);
    }
  });

  return ids;
}

function validateItems(variant, path, issues, ids) {
  if (!Array.isArray(variant.items)) {
    issues.push(`${path}.items: oczekiwano tablicy.`);
    return;
  }
  if (variant.type === 'items' && variant.items.length === 0) {
    issues.push(`${path}.items: wariant typu "items" musi mieć co najmniej jedną pozycję.`);
  }
  variant.items.forEach((item, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isPlainObject(item)) {
      issues.push(`${itemPath}: oczekiwano obiektu.`);
      return;
    }
    if (!isNonEmptyString(item.id)) {
      issues.push(`${itemPath}.id: oczekiwano niepustego tekstu.`);
    } else if (ids.has(item.id)) {
      issues.push(`${itemPath}.id: identyfikator "${item.id}" powtarza się.`);
    } else {
      ids.add(item.id);
    }
    if (!hasHtmlContent(item.html)) {
      issues.push(`${itemPath}.html: oczekiwano niepustej treści.`);
    }
  });
}

function validateVariants(exercise, path, issues, ids) {
  if (!Array.isArray(exercise.variants) || exercise.variants.length === 0) {
    issues.push(`${path}.variants: oczekiwano co najmniej jednego wariantu.`);
    return;
  }

  exercise.variants.forEach((variant, index) => {
    const variantPath = `${path}.variants[${index}]`;
    if (!isPlainObject(variant)) {
      issues.push(`${variantPath}: oczekiwano obiektu.`);
      return;
    }
    if (!isNonEmptyString(variant.id)) {
      issues.push(`${variantPath}.id: oczekiwano niepustego tekstu.`);
    } else if (ids.has(variant.id)) {
      issues.push(`${variantPath}.id: identyfikator "${variant.id}" powtarza się.`);
    } else {
      ids.add(variant.id);
    }
    if (!isNullableString(variant.label)) {
      issues.push(`${variantPath}.label: oczekiwano tekstu albo null.`);
    }
    if (!VARIANT_TYPES.includes(variant.type)) {
      issues.push(`${variantPath}.type: nieznany typ "${variant.type}"; dozwolone: ${VARIANT_TYPES.join(', ')}.`);
    }
    ['instructionHtml', 'syllablesHtml', 'textHtml', 'noteHtml'].forEach((field) => {
      if (!isNullableString(variant[field])) {
        issues.push(`${variantPath}.${field}: oczekiwano tekstu albo null.`);
      }
    });
    if (!isStringArray(variant.examples)) {
      issues.push(`${variantPath}.examples: oczekiwano tablicy tekstów.`);
    }
    if (variant.type === 'text' && !hasHtmlContent(variant.textHtml)) {
      issues.push(`${variantPath}.textHtml: wariant typu "text" wymaga treści.`);
    }
    if (variant.type === 'syllables' && !hasHtmlContent(variant.syllablesHtml)) {
      issues.push(`${variantPath}.syllablesHtml: wariant typu "syllables" wymaga treści.`);
    }
    validateItems(variant, variantPath, issues, ids);
  });
}

function validateExercises(raw, categoryIds, issues) {
  const ids = new Set();

  if (!Array.isArray(raw.exercises) || raw.exercises.length === 0) {
    issues.push('exercises: oczekiwano niepustej tablicy ćwiczeń.');
    return;
  }

  raw.exercises.forEach((exercise, index) => {
    const path = `exercises[${index}]`;
    if (!isPlainObject(exercise)) {
      issues.push(`${path}: oczekiwano obiektu.`);
      return;
    }
    if (!isNonEmptyString(exercise.id)) {
      issues.push(`${path}.id: oczekiwano niepustego tekstu.`);
    } else if (ids.has(exercise.id)) {
      issues.push(`${path}.id: identyfikator "${exercise.id}" powtarza się.`);
    } else {
      ids.add(exercise.id);
    }
    if (!isNonEmptyString(exercise.title)) {
      issues.push(`${path}.title: oczekiwano niepustego tekstu.`);
    }
    if (!isNonEmptyString(exercise.categoryId)) {
      issues.push(`${path}.categoryId: oczekiwano niepustego tekstu.`);
    } else if (categoryIds.size > 0 && !categoryIds.has(exercise.categoryId)) {
      issues.push(`${path}.categoryId: brak kategorii "${exercise.categoryId}" w categories[].`);
    }
    if (!isStringArray(exercise.phonemes)) {
      issues.push(`${path}.phonemes: oczekiwano tablicy tekstów.`);
    }
    if (!isStringArray(exercise.positions)) {
      issues.push(`${path}.positions: oczekiwano tablicy tekstów.`);
    }
    if (exercise.level !== null && (!Number.isInteger(exercise.level) || exercise.level < MIN_LEVEL || exercise.level > MAX_LEVEL)) {
      issues.push(`${path}.level: oczekiwano liczby ${MIN_LEVEL}–${MAX_LEVEL} albo null.`);
    }
    if (typeof exercise.randomizable !== 'boolean') {
      issues.push(`${path}.randomizable: oczekiwano wartości logicznej.`);
    }
    if (!isNonEmptyString(exercise.readQuality)) {
      issues.push(`${path}.readQuality: oczekiwano niepustego tekstu.`);
    }
    if (!isPlainObject(exercise.source)) {
      issues.push(`${path}.source: oczekiwano obiektu.`);
    } else {
      if (!isNonEmptyString(exercise.source.file)) {
        issues.push(`${path}.source.file: oczekiwano niepustego tekstu.`);
      }
      if (!isNonEmptyString(exercise.source.kind)) {
        issues.push(`${path}.source.kind: oczekiwano niepustego tekstu.`);
      }
      if (!isNullableString(exercise.source.publication)) {
        issues.push(`${path}.source.publication: oczekiwano tekstu albo null.`);
      }
    }
    ['notes', 'headerHtml', 'contextHtml', 'instructionHtml'].forEach((field) => {
      if (!isNullableString(exercise[field])) {
        issues.push(`${path}.${field}: oczekiwano tekstu albo null.`);
      }
    });
    validateVariants(exercise, path, issues, ids);
  });
}

export function validateDatabase(raw) {
  const issues = [];

  if (!isPlainObject(raw)) {
    return ['Plik bazy nie zawiera obiektu JSON.'];
  }
  if (!isNonEmptyString(raw.schemaVersion)) {
    issues.push('schemaVersion: oczekiwano niepustego tekstu.');
  } else if (raw.schemaVersion.split('.')[0] !== SUPPORTED_SCHEMA_MAJOR) {
    issues.push(
      `schemaVersion: baza w wersji "${raw.schemaVersion}" nie jest obsługiwana; aplikacja obsługuje wersję ${SUPPORTED_SCHEMA_MAJOR}.x.`,
    );
  }
  if (!isNonEmptyString(raw.generated)) {
    issues.push('generated: oczekiwano daty wygenerowania bazy.');
  }

  const categoryIds = validateCategories(raw, issues);
  validateExercises(raw, categoryIds, issues);
  if (Array.isArray(raw.exercises)) visitHtml(raw, (object, key, path) => {
    sanitizeHtml(object[key]).issues.forEach((message) => issues.push(`${path}: ${message}`));
  });

  ['duplicates', 'nonTextMaterials'].forEach((field) => {
    if (raw[field] !== undefined && !Array.isArray(raw[field])) {
      issues.push(`${field}: oczekiwano tablicy.`);
    }
  });

  return issues;
}

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export function stripHtml(html) {
  if (typeof html !== 'string' || html === '') {
    return '';
  }
  return html
    .replace(/<\s*\/?\s*(?:p|br|div|li|tr|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-zA-Z#0-9]+;/g, (entity) => ENTITIES[entity] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeText(text) {
  return String(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function exercisePlainText(exercise) {
  const parts = [stripHtml(exercise.headerHtml), stripHtml(exercise.contextHtml), stripHtml(exercise.instructionHtml)];
  exercise.variants.forEach((variant) => {
    parts.push(variant.label ?? '');
    parts.push(stripHtml(variant.instructionHtml));
    parts.push(stripHtml(variant.syllablesHtml));
    parts.push(stripHtml(variant.textHtml));
    parts.push(stripHtml(variant.noteHtml));
    variant.examples.forEach((example) => parts.push(stripHtml(example)));
    variant.items.forEach((item) => parts.push(stripHtml(item.html)));
  });
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function normalizeExercise(raw) {
  const variants = raw.variants.map((variant) => ({ ...variant, items: [...variant.items], examples: [...variant.examples] }));

  const exercise = { ...raw, variants, raw };
  exercise.plainText = exercisePlainText(exercise);
  exercise.searchText = normalizeText(`${exercise.title} ${exercise.plainText} ${exercise.id}`);
  exercise.itemCount = variants.reduce((total, variant) => total + variant.items.length, 0);
  return exercise;
}

export function buildDatabase(raw) {
  const issues = validateDatabase(raw);
  if (issues.length > 0) {
    const reported = issues.slice(0, MAX_REPORTED_ISSUES);
    if (issues.length > reported.length) {
      reported.push(`…oraz ${issues.length - reported.length} innych niezgodności.`);
    }
    throw new DatabaseError(`Baza ćwiczeń nie odpowiada schematowi ${SUPPORTED_SCHEMA_MAJOR}.x.`, reported);
  }

  const byId = (a, b) => (a.id === b.id ? 0 : a.id < b.id ? -1 : 1);
  const categories = [...raw.categories];
  const exercises = raw.exercises.map(normalizeExercise).sort(byId);

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const exercisesByCategory = new Map(categories.map((category) => [category.id, []]));
  exercises.forEach((exercise) => {
    exercisesByCategory.get(exercise.categoryId).push(exercise);
  });

  const variantCount = exercises.reduce((total, exercise) => total + exercise.variants.length, 0);
  const itemCount = exercises.reduce((total, exercise) => total + exercise.itemCount, 0);

  return {
    raw,
    schemaVersion: raw.schemaVersion,
    generated: raw.generated,
    categories,
    categoryById,
    exercises,
    exerciseById,
    exercisesByCategory,
    duplicates: raw.duplicates ?? [],
    nonTextMaterials: raw.nonTextMaterials ?? [],
    stats: {
      categoryCount: categories.length,
      exerciseCount: exercises.length,
      variantCount,
      itemCount,
    },
  };
}

export async function loadDatabase(url = DATABASE_URL) {
  let response;
  try {
    response = await fetch(url, { cache: 'no-cache' });
  } catch (error) {
    throw new DatabaseError('Nie udało się pobrać pliku bazy ćwiczeń.', [
      `Zapytanie o "${url}" nie powiodło się (${error.message}).`,
      'Aplikacja wymaga lokalnego serwera HTTP uruchomionego w katalogu src/webapp/.',
    ]);
  }

  if (!response.ok) {
    throw new DatabaseError('Nie udało się pobrać pliku bazy ćwiczeń.', [
      `Serwer odpowiedział kodem ${response.status} ${response.statusText} dla "${url}".`,
    ]);
  }

  let raw;
  try {
    raw = await response.json();
  } catch (error) {
    throw new DatabaseError('Plik bazy ćwiczeń nie jest poprawnym dokumentem JSON.', [error.message]);
  }

  return buildDatabase(raw);
}
