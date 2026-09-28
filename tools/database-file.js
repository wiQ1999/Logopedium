import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizeDatabase } from '../src/webapp/js/data.js';

export const DATABASE_FILE = fileURLToPath(new URL('../src/webapp/data/database.json', import.meta.url));

export const serializeDatabase = (raw) => `${JSON.stringify(raw, null, 2)}\n`;

/**
 * Decides whether a proposed base may replace the current one. Pure, so the dev server,
 * the import tool and the browser tests share one rule set.
 */
export function acceptDatabase(proposed, current, { baseRevision, now = new Date() } = {}) {
  if (baseRevision !== undefined && baseRevision !== current?.generated) {
    return { status: 'conflict', generated: current?.generated ?? null };
  }
  const { issues, raw } = normalizeDatabase(proposed);
  if (issues.length) return { status: 'invalid', issues };
  // The revision is stamped here, never trusted from the client, and always moves forward.
  const stamp = now.toISOString();
  raw.generated = current?.generated && stamp <= current.generated ? new Date(Date.parse(current.generated) + 1).toISOString() : stamp;
  return { status: 'accepted', raw };
}

export async function readDatabaseFile(file = DATABASE_FILE) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** Atomic replace: a crash mid-write leaves the previous file intact. */
export async function writeDatabaseFile(raw, file = DATABASE_FILE) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, serializeDatabase(raw), 'utf8');
  try {
    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

/** Serializes concurrent writers inside one process, so a revision check and its write are one step. */
let queue = Promise.resolve();
export function saveDatabaseFile(proposed, options = {}) {
  const { file = DATABASE_FILE, ...rest } = options;
  const run = queue.then(async () => {
    const result = acceptDatabase(proposed, await readDatabaseFile(file), rest);
    if (result.status === 'accepted') await writeDatabaseFile(result.raw, file);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}
