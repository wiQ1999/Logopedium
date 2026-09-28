import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Sortable from '../src/webapp/vendor/sortable.esm.js';
import { bootApp, makeStorage, tick } from './dom-helpers.js';

let app;
afterEach(() => { app?.teardown(); app = null; });
const rows = () => app.queryAll('[data-block]');
const exercises = (row) => [...row.querySelectorAll('[data-exercise]')].map(el => el.dataset.exercise);
const handle = (id) => app.query(`[data-drag][data-id="${id}"]`);
const key = (id, value) => handle(id).dispatchEvent(new app.window.KeyboardEvent('keydown', { key: value, bubbles: true }));
const list = () => app.query('#params-list');
const expand = (blockKey) => app.click(`[data-block="${blockKey}"] [data-role="expand"]`);

/**
 * Drives the SortableJS callbacks the way a pointer drag does: pick up, let `place` move the row
 * in the DOM (SortableJS does that live while the pointer moves), then release.
 */
async function pointerDrag(id, place, { release = { clientX: 5, clientY: 5 }, during } = {}) {
  const item = handle(id).closest('.params-block, .exercise-row');
  const from = item.parentElement;
  const { options } = Sortable.get(from);
  options.onChoose({ item });
  options.onStart({ item, from });
  place(item);
  during?.(item);
  options.onUnchoose({ item });
  options.onEnd({ item, from, to: item.parentElement, originalEvent: release });
  await tick();
}
const before = (target) => (item) => target.before(item);
const after = (target) => (item) => target.after(item);

describe('przeciąganie wskaźnikiem', () => {
  it('lista bloków i listy ćwiczeń są połączonymi listami SortableJS z przytrzymaniem na dotyku', async () => {
    app = await bootApp();
    const blocks = Sortable.get(list());
    assert.ok(blocks);
    assert.equal(app.queryAll('.exercise-rows').filter((el) => Sortable.get(el)).length, 7);
    assert.equal(blocks.options.forceFallback, true);
    assert.equal(blocks.options.delay, 350);
    assert.equal(blocks.options.delayOnTouchOnly, true);
    assert.equal(blocks.options.touchStartThreshold, 10);
    assert.ok(blocks.options.animation > 0);
    assert.equal(app.queryAll('[draggable="true"]').length, 0);
    const stale = app.query('.exercise-rows');
    await expand(rows()[0].dataset.block);
    assert.ok(!Sortable.get(stale));
  });

  it('blok przyjmuje tylko ćwiczenia swojej kategorii, a lista bloków — każde ćwiczenie', async () => {
    app = await bootApp();
    const [first, second] = rows();
    const own = Sortable.get(first.querySelector('.exercise-rows'));
    const foreign = Sortable.get(second.querySelector('.exercise-rows'));
    const item = first.querySelector('.exercise-row');
    const block = rows()[2];
    assert.equal(foreign.options.group.checkPut(foreign, own, item), false);
    assert.equal(own.options.group.checkPut(own, foreign, second.querySelector('.exercise-row')), false);
    assert.equal(foreign.options.group.checkPut(foreign, Sortable.get(list()), block), false);
    const blocks = Sortable.get(list());
    assert.equal(blocks.options.group.checkPut(blocks, own, item), true);
    assert.equal(own.options.group.checkPull(blocks, own, item), true);
    assert.equal(blocks.options.group.checkPull(own, blocks, block), false);
  });

  it('blok ląduje w przerwie, w której go upuszczono, i zwija się na czas przeciągania', async () => {
    app = await bootApp();
    const order = rows().map((row) => row.dataset.block);
    await expand(order[0]);
    await pointerDrag(order[0], after(rows()[4]), {
      during: (item) => assert.ok(item.classList.contains('params-block--lifted')),
    });
    assert.deepEqual(rows().map((row) => row.dataset.block), [...order.slice(1, 5), order[0], ...order.slice(5)]);
    assert.match(app.query('#drag-status').textContent, /^Upuszczono\. Blok 5, /);
    assert.ok(!app.query('.params-block--lifted'));
    assert.equal(app.query(`[data-block="${order[0]}"] [data-role="expand"]`).getAttribute('aria-expanded'), 'true');
  });

  it('ćwiczenie zmienia miejsce w bloku i przechodzi do innego bloku tej samej kategorii', async () => {
    app = await bootApp();
    const blockKey = rows()[0].dataset.block;
    await expand(blockKey);
    const [a, b, c] = exercises(rows()[0]);
    await pointerDrag(a, after(app.query(`[data-exercise="${c}"]`)));
    assert.deepEqual(exercises(rows()[0]).slice(0, 3), [b, c, a]);
    await pointerDrag(b, after(rows()[2]));
    const splitKey = rows()[3].dataset.block;
    assert.deepEqual(exercises(rows()[3]), [b]);
    await pointerDrag(c, before(app.query(`[data-block="${splitKey}"] [data-exercise="${b}"]`)));
    assert.deepEqual(exercises(rows()[3]), [c, b]);
    assert.equal(app.queryAll(`[data-exercise="${c}"]`).length, 1);
  });

  it('ćwiczenie wyciągnięte między bloki tworzy kopię kategorii w miejscu upuszczenia', async () => {
    app = await bootApp();
    const source = rows()[0];
    const category = source.querySelector('.params-row').dataset.category;
    const pick = source.querySelector('select');
    pick.value = 'losowo'; pick.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    await expand(source.dataset.block);
    const id = exercises(rows()[0])[0];
    await pointerDrag(id, after(rows().at(-1)), {
      during: (item) => {
        assert.equal(item.parentElement, list());
        assert.equal(item.dataset.categoryName, source.querySelector('.params-row__name').firstChild.textContent.trim());
      },
    });
    assert.equal(rows().length, 8);
    const split = rows().at(-1);
    assert.deepEqual(exercises(split), [id]);
    assert.equal(split.querySelector('.params-row').dataset.category, category);
    assert.equal(split.querySelector('select').value, 'losowo');
    assert.equal(split.querySelector('[data-role="count"]').value, '1');
    assert.ok(!exercises(rows()[0]).includes(id));
    assert.match(app.query('#drag-status').textContent, /^Upuszczono\. Blok 8, /);
    await pointerDrag(split.dataset.block, before(rows()[1]));
    assert.deepEqual(exercises(rows()[1]), [id]);
  });

  it('wyciągnięcie jedynego ćwiczenia bloku przenosi blok', async () => {
    app = await bootApp();
    await expand(rows()[0].dataset.block);
    const id = exercises(rows()[0])[0];
    await pointerDrag(id, after(rows().at(-1)));
    const splitKey = rows().at(-1).dataset.block;
    await pointerDrag(id, before(rows()[2]));
    assert.equal(rows().length, 8);
    assert.deepEqual(exercises(rows()[2]), [id]);
    assert.ok(!rows().some((row) => row.dataset.block === splitKey));
  });

  it('Escape i upuszczenie poza listą przywracają poprzedni układ', async () => {
    app = await bootApp();
    const layout = () => rows().map((row) => [row.dataset.block, ...exercises(row)]);
    const initial = layout();
    await expand(rows()[0].dataset.block);
    const id = exercises(rows()[0])[0];
    await pointerDrag(id, after(rows()[3]), {
      during: () => app.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    });
    assert.deepEqual(layout(), initial);
    assert.match(app.query('#drag-status').textContent, /Wycofano/);
    list().getBoundingClientRect = () => ({ left: 0, right: 300, top: 100, bottom: 600, width: 300, height: 500 });
    await pointerDrag(rows()[0].dataset.block, after(rows()[3]), { release: { clientX: 900, clientY: 200 } });
    assert.deepEqual(layout(), initial);
    await pointerDrag(rows()[0].dataset.block, after(rows()[3]), { release: { clientX: 100, clientY: 40 } });
    assert.deepEqual(layout(), initial);
    // Over the sticky header the list still lies underneath, so the drop lands in the gap.
    app.document.elementFromPoint = () => app.query('.app-header');
    await pointerDrag(rows()[0].dataset.block, after(rows()[3]), { release: { changedTouches: [{ clientX: 10, clientY: 110 }] } });
    assert.equal(rows()[3].dataset.block, initial[0][0]);
  });
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
  await expand(rows()[0].dataset.block);
  const id = exercises(rows()[0])[0];
  await pointerDrag(id, after(rows()[0]));
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
