import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { bootApp, makeStorage } from './dom-helpers.js';

let app;
afterEach(() => { app?.teardown(); app = null; });
const rows = () => app.queryAll('[data-block]');
const exercises = (row) => [...row.querySelectorAll('[data-exercise]')].map(el => el.dataset.exercise);
const handle = (id) => app.query(`[data-drag][data-id="${id}"]`);
const key = (id, value) => handle(id).dispatchEvent(new app.window.KeyboardEvent('keydown', { key: value, bubbles: true }));
const drag = (id, destination) => {
  handle(id).dispatchEvent(new app.window.Event('dragstart', { bubbles: true }));
  destination.dispatchEvent(new app.window.Event('drop', { bubbles: true, cancelable: true }));
};
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const touchEvent = (target, type, current = [], changed = current) => {
  const event = new app.window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { value: current },
    changedTouches: { value: changed },
  });
  target.dispatchEvent(event);
};
const touchDrag = async (id, destination) => {
  const button = handle(id);
  const start = { identifier: 1, clientX: 10, clientY: 10 };
  const end = { identifier: 1, clientX: 20, clientY: 80 };
  app.document.elementFromPoint = () => destination;
  touchEvent(button, 'touchstart', [start]);
  await wait(380);
  touchEvent(button, 'touchmove', [end]);
  touchEvent(button, 'touchend', [], [end]);
};

it('przeciągnięcie dzieli blok, zachowuje tryb i pozwala połączyć go ponownie', async () => {
  app = await bootApp();
  const id = exercises(rows()[0])[0];
  const pick = rows()[0].querySelector('select');
  pick.value = 'losowo'; pick.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  drag(id, rows()[0].querySelector('[data-split]'));
  assert.equal(rows().length, 8);
  assert.deepEqual(exercises(rows()[1]), [id]);
  assert.equal(rows()[1].querySelector('select').value, 'losowo');
  assert.equal(rows()[1].querySelector('[data-role="count"]').value, '1');
  assert.equal(rows()[1].querySelector('[data-role="item-limit"]').value, rows()[1].querySelector('[data-role="item-limit"]').max);
  drag(id, rows()[0]);
  assert.equal(rows().length, 7);
  assert.equal(exercises(rows()[0]).at(-1), id);
  assert.equal(app.queryAll(`[data-exercise="${id}"]`).length, 1);
});

it('upuszczenie na obcej kategorii nie zmienia przynależności ani ustawień', async () => {
  app = await bootApp();
  const before = rows().map(exercises);
  drag(before[0][0], rows()[1]);
  assert.deepEqual(rows().map(exercises), before);
});

it('dotyk przenosi bloki i ćwiczenia między blokami po przytrzymaniu uchwytu', async () => {
  app = await bootApp();
  const firstBlock = rows()[0].dataset.block;
  await touchDrag(firstBlock, rows()[1]);
  assert.equal(rows()[1].dataset.block, firstBlock);

  let source = rows().find((row) => row.dataset.block === firstBlock);
  await app.click(`[data-block="${firstBlock}"] [data-role="expand"]`);
  source = rows().find((row) => row.dataset.block === firstBlock);
  const [firstExercise, secondExercise] = exercises(source);
  await touchDrag(firstExercise, source.querySelector('[data-split]'));
  const categoryBlocks = rows().filter((row) => row.querySelector(`[data-exercise="${firstExercise}"]`));
  assert.equal(categoryBlocks.length, 1);
  const splitKey = categoryBlocks[0].dataset.block;
  assert.notEqual(splitKey, firstBlock);

  await touchDrag(secondExercise, app.query(`[data-block="${splitKey}"] [data-exercise="${firstExercise}"]`));
  const split = rows().find((row) => row.dataset.block === splitKey);
  assert.deepEqual(exercises(split).slice(0, 2), [secondExercise, firstExercise]);
  assert.equal(app.queryAll(`[data-exercise="${secondExercise}"]`).length, 1);
});

it('ruch palca przed przytrzymaniem przewija listę bez rozpoczęcia przenoszenia', async () => {
  app = await bootApp();
  const before = rows().map((row) => row.dataset.block);
  const id = before[0];
  const button = handle(id);
  const start = { identifier: 2, clientX: 10, clientY: 10 };
  const move = { identifier: 2, clientX: 10, clientY: 40 };
  touchEvent(button, 'touchstart', [start]);
  touchEvent(button, 'touchmove', [move]);
  await wait(380);
  touchEvent(button, 'touchend', [], [move]);
  assert.deepEqual(rows().map((row) => row.dataset.block), before);
  assert.equal(handle(id).getAttribute('aria-pressed'), 'false');
  assert.equal(app.query('#drag-status').textContent, '');
});

it('klawiatura porządkuje ćwiczenia, tworzy blok, przenosi do sąsiedniego i wycofuje całą operację', async () => {
  app = await bootApp();
  const before = rows().map(exercises); const id = before[0][0];
  await app.click('[data-block="motoryka-orofacjalna-i-polykanie"] [data-role="expand"]');
  for (const value of [' ', 'ArrowDown', 'ArrowLeft']) key(id, value);
  assert.equal(rows().length, 8);
  assert.equal(app.document.activeElement.dataset.id, id);
  assert.equal(handle(id).getAttribute('aria-pressed'), 'true');
  key(id, 'ArrowRight');
  assert.equal(rows().length, 7);
  assert.equal(exercises(rows()[0]).at(-1), id);
  key(id, 'Escape');
  assert.deepEqual(rows().map(exercises), before);
  assert.match(app.query('#drag-status').textContent, /Wycofano/);
  assert.equal(handle(id).getAttribute('aria-pressed'), 'false');
});

it('podział, wyłączenie ćwiczenia i różny dobór wracają po uruchomieniu z zapisu', async () => {
  const storage = makeStorage(); app = await bootApp({ storage });
  const id = exercises(rows()[0])[0];
  drag(id, rows()[0].querySelector('[data-split]'));
  rows()[0].querySelector('[data-role="exercise-active"]').click();
  const pick = rows()[1].querySelector('select');
  pick.value = 'losowo'; pick.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  const expected = rows().map(row => ({ ids: exercises(row), pick: row.querySelector('select').value,
    active: [...row.querySelectorAll('[data-role="exercise-active"]')].map(el => el.checked) }));
  await app.click('#params-submit'); const sessionHash = app.hash();
  assert.match(sessionHash, /^#\/session\/1\?s=[A-Za-z0-9_-]+$/);
  app.teardown(); app = null; app = await bootApp({ storage });
  assert.deepEqual(rows().map(row => ({ ids: exercises(row), pick: row.querySelector('select').value,
    active: [...row.querySelectorAll('[data-role="exercise-active"]')].map(el => el.checked) })), expected);
});

it('uszkodzone kodowanie adresu nie przerywa routingu', async () => {
  app = await bootApp({ hash: '#/browse/%E0%A4%A' });
  assert.match(app.text(), /Nie znaleziono ćwiczenia/);
});
