import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Sortable from '../src/webapp/vendor/sortable.esm.js';
import { sanitizeHtml, truncateHtml } from '../src/webapp/js/html.js';
import { PREVIEW_LIMITS, renderExercisePreview } from '../src/webapp/js/render.js';
import { bootApp, tick } from './dom-helpers.js';
import { makeExercise, makeItems, makeVariant } from './helpers.js';

const text = (html) => html.replace(/<[^>]*>/g, '');

describe('skracanie treści HTML', () => {
  it('krótką treść zostawia bez zmian', () => {
    const html = '<p>Ala <span class="target">sz</span>umi.</p>';
    assert.deepEqual(truncateHtml(html), { html, truncated: false });
  });

  it('tnie na granicy słowa, dodaje wielokropek i zamyka otwarte znaczniki', () => {
    const { html, truncated } = truncateHtml('<p>Szumi <span class="target">szosa szeroko</span> w szuwarach.</p>', { chars: 18 });
    assert.ok(truncated);
    assert.equal(html, '<p>Szumi <span class="target">szosa…</span></p>');
    assert.deepEqual(sanitizeHtml(html).issues, []);
  });

  it('liczy encję jako jeden znak i nie tnie jej w połowie', () => {
    const { html } = truncateHtml('a&amp;b&amp;cdefgh', { chars: 4 });
    assert.equal(html, 'a&amp;b&amp;…');
  });

  it('ogranicza liczbę wierszy przy <br> i akapitach', () => {
    assert.equal(truncateHtml('raz<br>dwa<br>trzy<br>cztery', { lines: 2 }).html, 'raz<br>dwa…');
    assert.equal(truncateHtml('<p>raz</p><p>dwa</p><p>trzy</p>', { lines: 2 }).html, '<p>raz</p><p>dwa…</p>');
    assert.equal(truncateHtml('raz<br>dwa<br>', { lines: 2 }).truncated, false);
  });

  it('zachowuje puste oznaczenia i uwzględnia je jako dalszą treść', () => {
    assert.equal(truncateHtml('raz<br><span class="blank"></span>', { lines: 1 }).html, 'raz…');
    assert.equal(truncateHtml('raz <span class="exhale"></span>').html, 'raz <span class="exhale"></span>');
  });
});

describe('podgląd ćwiczenia', () => {
  it('pokazuje opis, polecenie i treść, skracając długi tekst', () => {
    const long = `<p>${'słowo '.repeat(100)}</p>`;
    const html = renderExercisePreview(makeExercise({
      level: 2, readQuality: 'do_weryfikacji', contextHtml: '<p>Opis metodyczny</p>', instructionHtml: '<p>Powtórz</p>',
      variants: [makeVariant({ id: 'x-w1', type: 'text', textHtml: long })],
    }));
    assert.match(html, /Opis metodyczny/);
    assert.match(html, /Powtórz/);
    assert.match(html, /poziom 2/);
    assert.match(html, /odczyt do weryfikacji/);
    const words = (text(html).match(/słowo/g) ?? []).length;
    assert.ok(words > 10 && words <= PREVIEW_LIMITS.text.chars / 'słowo '.length, String(words));
    assert.match(html, /…<\/p>/);
  });

  it('przy wielu wariantach i pozycjach pokazuje początek i liczbę całości', () => {
    const variants = Array.from({ length: 5 }, (unused, i) => makeVariant({ id: `x-w${i + 1}`, label: `Zadanie ${i + 1}`, items: makeItems(`x-w${i + 1}`, 12) }));
    const html = renderExercisePreview(makeExercise({ variants }));
    assert.equal((html.match(/items__item/g) ?? []).length, PREVIEW_LIMITS.variants * PREVIEW_LIMITS.items);
    assert.match(html, /Zadanie 2/);
    assert.doesNotMatch(html, /Zadanie 3/);
    assert.match(html, /…i 9 kolejnych pozycji \(razem 12\)/);
    assert.match(html, /Pokazano 2 z 5 wariantów/);
    assert.match(html, /5 wariantów/);
    assert.match(html, /60 pozycji/);
  });

  it('polecenie wspólne pokazuje raz, a własne polecenie wariantu przy wariancie', () => {
    const html = renderExercisePreview(makeExercise({
      instructionHtml: '<p>Wspólne</p>',
      variants: [makeVariant({ id: 'x-w1', items: makeItems('x-w1', 1) }), makeVariant({ id: 'x-w2', instructionHtml: '<p>Własne</p>', type: 'prompt' })],
    }));
    assert.equal((html.match(/Wspólne/g) ?? []).length, 1);
    assert.match(html, /exercise-preview__instruction[^>]*><p>Własne/);
  });

  it('treść przechodzi sanitację', () => {
    const html = renderExercisePreview(makeExercise({ contextHtml: '<img src=x onerror=alert(1)>' }));
    assert.doesNotMatch(html, /<img/);
  });
});

describe('rozwijanie ćwiczeń w parametrach sesji', () => {
  let app;
  afterEach(() => { app?.teardown(); app = null; });
  const block = () => app.query('[data-block]');
  const openBlock = () => app.click('[data-block] [data-role="expand"]');
  const previewButtons = () => [...block().querySelectorAll('[data-role="preview"]')];
  const openPreviews = () => app.queryAll('.exercise-preview');

  it('kliknięcie rozwija ćwiczenie z opisem i treścią, ponowne zwija', async () => {
    app = await bootApp();
    await openBlock();
    const [first] = previewButtons();
    const id = first.closest('[data-exercise]').dataset.exercise;
    assert.equal(first.getAttribute('aria-expanded'), 'false');
    first.click(); await tick(4);
    const button = previewButtons()[0];
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    const panel = app.query(`#${button.getAttribute('aria-controls')}`);
    assert.ok(panel.closest(`[data-exercise="${id}"]`));
    assert.match(panel.textContent, /Treść/);
    assert.equal(app.document.activeElement, button);
    button.click(); await tick(4);
    assert.equal(openPreviews().length, 0);
    assert.equal(previewButtons()[0].getAttribute('aria-expanded'), 'false');
  });

  it('rozwinięcie drugiego ćwiczenia zwija poprzednie, także w innym bloku', async () => {
    app = await bootApp();
    await openBlock();
    previewButtons()[0].click(); await tick(4);
    previewButtons()[1].click(); await tick(4);
    assert.equal(openPreviews().length, 1);
    assert.equal(previewButtons()[1].getAttribute('aria-expanded'), 'true');
    await app.click('[data-block]:nth-child(2) [data-role="expand"]');
    app.query('[data-block]:nth-child(2) [data-role="preview"]').click(); await tick(4);
    assert.equal(openPreviews().length, 1);
    assert.ok(openPreviews()[0].closest('[data-block]:nth-child(2)'));
  });

  it('pole wyboru ćwiczenia działa niezależnie od podglądu, a podgląd zostaje otwarty', async () => {
    app = await bootApp();
    await openBlock();
    previewButtons()[0].click(); await tick(4);
    const box = block().querySelector('[data-role="exercise-active"]');
    assert.match(box.getAttribute('aria-label'), /^Ćwiczenie w sesji: /);
    box.click(); await tick(4);
    assert.equal(block().querySelector('[data-role="exercise-active"]').checked, false);
    assert.equal(openPreviews().length, 1);
  });

  it('rozwinięte ćwiczenie da się przeciągnąć, a na czas przeciągania chowa podgląd', async () => {
    app = await bootApp();
    await openBlock();
    previewButtons()[0].click(); await tick(4);
    const item = block().querySelector('.exercise-row');
    const id = item.dataset.exercise;
    const { options } = Sortable.get(item.parentElement);
    options.onChoose({ item });
    assert.ok(item.classList.contains('exercise-row--lifted'));
    options.onStart({ item, from: item.parentElement });
    item.parentElement.append(item);
    options.onUnchoose({ item });
    options.onEnd({ item, from: item.parentElement, to: item.parentElement, originalEvent: { clientX: 5, clientY: 5 } });
    await tick();
    const rows = [...block().querySelectorAll('[data-exercise]')];
    assert.equal(rows.at(-1).dataset.exercise, id);
    assert.ok(rows.at(-1).querySelector('.exercise-preview'));
    assert.ok(!app.query('.exercise-row--lifted'));
  });

  it('rozwinięcie nie zmienia parametrów sesji', async () => {
    app = await bootApp();
    await app.click('#params-submit');
    const plain = app.hash();
    app.teardown();
    app = await bootApp();
    await openBlock();
    previewButtons()[2].click(); await tick(4);
    await app.click('#params-submit');
    assert.equal(app.hash(), plain);
  });

  it('przywrócenie domyślnych zwija podgląd', async () => {
    app = await bootApp();
    await openBlock();
    previewButtons()[0].click(); await tick(4);
    await app.click('[data-role="reset"]');
    assert.equal(openPreviews().length, 0);
  });
});
