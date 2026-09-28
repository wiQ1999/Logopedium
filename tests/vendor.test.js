import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { it } from 'node:test';

const require = createRequire(import.meta.url);
const read = (url) => readFileSync(url, 'utf8').replace(/\r\n/g, '\n');

it('dołączony SortableJS jest niezmienioną kopią przypiętej wersji pakietu', () => {
  const pinned = JSON.parse(read(new URL('../package.json', import.meta.url))).devDependencies.sortablejs;
  const installed = require('sortablejs/package.json').version;
  assert.equal(installed, pinned);
  const vendored = read(new URL('../src/webapp/vendor/sortable.esm.js', import.meta.url));
  assert.equal(vendored, read(require.resolve('sortablejs/modular/sortable.esm.js')));
  assert.match(vendored, new RegExp(`Sortable ${pinned.replaceAll('.', '\.')}`));
  assert.match(read(new URL('../src/webapp/vendor/README.txt', import.meta.url)), new RegExp(`SortableJS ${pinned.replaceAll('.', '\.')}`));
  assert.match(read(new URL('../src/webapp/vendor/sortable.LICENSE.txt', import.meta.url)), /MIT License/);
});
