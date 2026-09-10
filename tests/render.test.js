import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  escapeHtml,
  formatCount,
  formatDate,
  levelLabel,
  plural,
  renderExerciseCard,
  renderMarksLegend,
  renderMarksToolbar,
  renderMetaGrid,
  renderNotice,
  renderProgress,
  renderRawData,
} from '../src/webapp/js/render.js';
import { loadDatabaseFixture } from './helpers.js';

const db = loadDatabaseFixture();

describe('formatowanie tekstu', () => {
  it('escapeHtml zabezpiecza znaki specjalne', () => {
    assert.equal(escapeHtml('<script>"x"&\'y\'</script>'), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
    assert.equal(escapeHtml(null), '');
  });

  it('plural dobiera polskie formy liczebnika', () => {
    const forms = ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'];
    assert.equal(plural(1, forms), 'ćwiczenie');
    assert.equal(plural(2, forms), 'ćwiczenia');
    assert.equal(plural(4, forms), 'ćwiczenia');
    assert.equal(plural(5, forms), 'ćwiczeń');
    assert.equal(plural(12, forms), 'ćwiczeń');
    assert.equal(plural(22, forms), 'ćwiczenia');
    assert.equal(plural(25, forms), 'ćwiczeń');
    assert.equal(plural(0, forms), 'ćwiczeń');
    assert.equal(formatCount(3, forms), '3 ćwiczenia');
  });

  it('formatDate zapisuje datę po polsku', () => {
    assert.equal(formatDate('2026-09-10'), '10 września 2026');
    assert.equal(formatDate('2026-01-01'), '1 stycznia 2026');
    assert.equal(formatDate('nieznana'), 'nieznana');
  });

  it('levelLabel opisuje brak poziomu', () => {
    assert.equal(levelLabel(3), 'poziom 3');
    assert.equal(levelLabel(null), 'poziom nieokreślony');
  });
});

describe('karta ćwiczenia', () => {
  const exercise = db.exerciseById.get('adam-andrzejewski');
  const views = exercise.variants.map((variant) => ({ variant, items: variant.items }));

  it('zawiera kategorię, tytuł i treść wariantu', () => {
    const html = renderExerciseCard(exercise, views, { categoryName: 'tekst do czytania', markMode: 'full' });
    assert.ok(html.includes('tekst do czytania'));
    assert.ok(html.includes('Adam Andrzejewski'));
    assert.ok(html.includes('data-marks="full"'));
    assert.ok(html.includes('class="target"'));
    assert.ok(html.includes('poziom 2'));
  });

  it('przenosi tryb oznaczeń do atrybutu karty', () => {
    assert.ok(renderExerciseCard(exercise, views, { markMode: 'plain' }).includes('data-marks="plain"'));
  });

  it('nie pokazuje uwag redakcyjnych w sesji', () => {
    const inSession = renderExerciseCard(exercise, views, { showEditorial: false });
    const inBrowse = renderExerciseCard(exercise, views, { showEditorial: true });
    assert.ok(!inSession.includes('Uwagi redakcyjne'));
    assert.ok(inBrowse.includes('Uwagi redakcyjne'));
    assert.ok(inBrowse.includes('Wydawnictwo Harmonia'));
  });

  it('informuje o wylosowaniu podzbioru pozycji', () => {
    const withItems = db.exercises.find((item) => item.variants.some((variant) => variant.items.length > 5));
    const variant = withItems.variants.find((entry) => entry.items.length > 5);
    const full = renderExerciseCard(withItems, [{ variant, items: variant.items }], {});
    const partial = renderExerciseCard(withItems, [{ variant, items: variant.items.slice(0, 3) }], {});
    assert.ok(!full.includes('Wylosowano'));
    assert.ok(partial.includes(`Wylosowano 3 z ${variant.items.length} pozycji.`));
  });

  it('pokazuje polecenie ćwiczenia, gdy wariant go nie nadpisuje', () => {
    const inherited = db.exercises.find(
      (item) => item.instructionHtml && item.variants.some((variant) => variant.instructionHtml === null),
    );
    assert.ok(inherited, 'baza powinna zawierać ćwiczenie z dziedziczonym poleceniem');
    const html = renderExerciseCard(
      inherited,
      inherited.variants.map((variant) => ({ variant, items: variant.items })),
      {},
    );
    assert.ok(html.includes(inherited.instructionHtml));
  });

  it('powtórzone polecenie wariantów pokazuje raz, nad wariantami', () => {
    const repeated = db.exerciseById.get('uderz-mocnym-dzwiekiem-nosowym');
    const html = renderExerciseCard(
      repeated,
      repeated.variants.map((variant) => ({ variant, items: variant.items })),
      {},
    );
    assert.equal(html.split('block--instruction').length - 1, 1);
    assert.ok(html.indexOf('block--instruction') < html.indexOf('variant__label'));
  });

  it('różne polecenia wariantów pokazuje przy każdym wariancie', () => {
    const mixed = db.exercises.find(
      (item) =>
        item.variants.length > 1 &&
        new Set(item.variants.map((variant) => variant.instructionHtml ?? item.instructionHtml)).size > 1,
    );
    const views = mixed.variants.map((variant) => ({ variant, items: variant.items }));
    const html = renderExerciseCard(mixed, views, {});
    const blocks = html.split('block--instruction').length - 1;
    assert.equal(blocks, views.filter((view) => view.variant.instructionHtml ?? mixed.instructionHtml).length);
  });

  it('oznacza ćwiczenia o niepewnym odczycie', () => {
    const uncertain = db.exercises.find((item) => item.readQuality === 'do_weryfikacji');
    const html = renderExerciseCard(uncertain, [], {});
    assert.ok(html.includes('odczyt do weryfikacji'));
  });

  it('nie przepuszcza znaczników z tytułu', () => {
    const html = renderExerciseCard({ ...exercise, title: '<img src=x onerror=alert(1)>' }, [], {});
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img'));
  });
});

describe('elementy pomocnicze interfejsu', () => {
  it('pasek postępu opisuje pozycję w sesji', () => {
    const html = renderProgress(3, 12, 'głoska dż');
    assert.ok(html.includes('Ćwiczenie 3 z 12'));
    assert.ok(html.includes('aria-valuenow="3"'));
    assert.ok(html.includes('aria-valuemax="12"'));
    assert.ok(html.includes('width: 25%'));
  });

  it('przełącznik oznaczeń wskazuje aktywny tryb', () => {
    const html = renderMarksToolbar('target');
    assert.ok(html.includes('data-mark-mode="target"'));
    assert.match(html, /data-mark-mode="target"[\s\S]*?aria-pressed="true"/);
    assert.match(html, /data-mark-mode="plain"[\s\S]*?aria-pressed="false"/);
  });

  it('legenda opisuje wszystkie oznaczenia', () => {
    const html = renderMarksLegend();
    ['target', 'legato', 'phonetic', 'uncertain', 'breath', 'exhale', 'juncture', 'blank'].forEach((mark) => {
      assert.ok(html.includes(`class="${mark}"`), `brak oznaczenia ${mark}`);
    });
  });

  it('komunikat błędu wypisuje przyczyny', () => {
    const html = renderNotice('Błąd', 'Nie wczytano bazy.', 'notice--error', ['pierwsza przyczyna']);
    assert.ok(html.includes('role="alert"'));
    assert.ok(html.includes('pierwsza przyczyna'));
  });

  it('metryka pomija puste wartości', () => {
    const html = renderMetaGrid([
      ['Kategoria', 'A'],
      ['Publikacja', null],
    ]);
    assert.ok(html.includes('Kategoria'));
    assert.ok(!html.includes('Publikacja'));
  });

  it('surowe dane są wypisywane jako tekst', () => {
    const html = renderRawData({ id: 'x', html: '<span class="target">a</span>' });
    assert.ok(html.includes('&lt;span class=\\&quot;target\\&quot;&gt;'));
    assert.ok(!html.includes('<span'));
    assert.ok(html.includes('class="raw-data"'));
  });
});
