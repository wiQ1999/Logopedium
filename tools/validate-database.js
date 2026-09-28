import { validateDatabase } from '../src/webapp/js/data.js';
import { DATABASE_FILE, readDatabaseFile } from './database-file.js';

const file = process.argv[2] ?? DATABASE_FILE;
let issues;
try {
  issues = validateDatabase(await readDatabaseFile(file));
} catch (error) {
  issues = [`Nie można odczytać bazy (${error.message}).`];
}
if (issues.length) {
  console.error(`Baza niezgodna ze schematem (${issues.length}):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}
console.log('Baza zgodna ze schematem.');
