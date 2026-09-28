import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATABASE_FILE, acceptDatabase, readDatabaseFile, saveDatabaseFile } from './database-file.js';

const USAGE = 'Użycie: npm run import -- <plik.json> [--dry-run]';

/** Appends transcribed material; ids must be new, so an import never overwrites existing content. */
export function mergeExercises(current, addition) {
  const issues = [];
  if (!addition || typeof addition !== 'object' || Array.isArray(addition)) {
    return { issues: ['Plik importu musi zawierać obiekt z tablicą "exercises".'], raw: null };
  }
  const categories = addition.categories ?? [];
  const exercises = addition.exercises;
  if (!Array.isArray(categories)) issues.push('categories: oczekiwano tablicy.');
  if (!Array.isArray(exercises) || exercises.length === 0) issues.push('exercises: oczekiwano niepustej tablicy ćwiczeń.');
  if (issues.length) return { issues, raw: null };
  const knownCategories = new Set(current.categories.map((c) => c.id));
  const knownExercises = new Set(current.exercises.map((e) => e.id));
  categories.forEach((c) => { if (knownCategories.has(c?.id)) issues.push(`categories: kategoria "${c.id}" już istnieje.`); });
  exercises.forEach((e) => { if (knownExercises.has(e?.id)) issues.push(`exercises: ćwiczenie "${e.id}" już istnieje; import nie nadpisuje treści.`); });
  if (issues.length) return { issues, raw: null };
  return { issues: [], raw: { ...current, categories: [...current.categories, ...categories], exercises: [...current.exercises, ...exercises] } };
}

export async function importExercises(path, { file = DATABASE_FILE, dryRun = false, now } = {}) {
  let addition;
  try {
    addition = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    return { status: 'invalid', issues: [`Nie można odczytać pliku importu (${error.message}).`] };
  }
  const current = await readDatabaseFile(file);
  const merged = mergeExercises(current, addition);
  if (merged.issues.length) return { status: 'invalid', issues: merged.issues };
  const added = addition.exercises.length;
  if (dryRun) {
    const result = acceptDatabase(merged.raw, current, { now });
    return result.status === 'accepted' ? { status: 'checked', added } : result;
  }
  const result = await saveDatabaseFile(merged.raw, { file, baseRevision: current.generated, now });
  return result.status === 'accepted' ? { status: 'saved', added, generated: result.raw.generated } : result;
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
  const args = process.argv.slice(2);
  const path = args.find((arg) => !arg.startsWith('--'));
  if (!path) {
    console.error(USAGE);
    process.exit(2);
  }
  const result = await importExercises(path, { dryRun: args.includes('--dry-run') });
  if (result.status === 'saved') {
    console.log(`Dodano ćwiczeń: ${result.added}. Nowa rewizja bazy: ${result.generated}.`);
  } else if (result.status === 'checked') {
    console.log(`Plik poprawny, ćwiczenia gotowe do importu: ${result.added}. Baza nie została zmieniona.`);
  } else {
    console.error(result.status === 'conflict' ? 'Baza zmieniła się w trakcie importu; uruchom go ponownie.' : 'Import odrzucony, baza bez zmian:');
    (result.issues ?? []).forEach((issue) => console.error(`- ${issue}`));
    process.exit(1);
  }
}
