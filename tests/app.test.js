import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { bootApp, errorResponse, jsonResponse, makeStorage, networkFailure } from './dom-helpers.js';
import { STORAGE_KEY } from '../src/webapp/js/settings.js';
import { clampParams, decodeSessionState, encodeSessionState } from '../src/webapp/js/blocks.js';
import { loadDatabaseFixture, loadRawDatabase } from './helpers.js';

const apps = [];

async function boot(options) {
  const app = await bootApp(options);
  apps.push(app);
  return app;
}

after(() => {
  apps.forEach((app) => app.teardown());
});

const db = loadDatabaseFixture();
const sessionParams = clampParams(db, {
  date: '2026-09-10',
  level: 4,
  blocks: [
    { id: 'samogloski', count: 1, variantLimit: 2, itemLimit: 5, pick: 'kolejnosc' },
    { id: 'artykulacja-i-roznicowanie-glosek', count: 1, variantLimit: 4, itemLimit: 29, pick: 'kolejnosc' },
    { id: 'wprawki-artykulacyjne', count: 2, variantLimit: 1, itemLimit: 8, pick: 'kolejnosc' },
  ],
});
const sessionQuery = (params = sessionParams, seedOverride = null) => `s=${encodeSessionState(params, db, seedOverride)}`;
const SESSION_QUERY = sessionQuery();
const stateFromHash = (app) => decodeSessionState(new URLSearchParams(app.hash().split('?')[1]).get('s'), db);
const blockSettings = (params, id) => {
  const { count, variantLimit, itemLimit, pick } = params.blocks.find((block) => block.id === id);
  return { count, variantLimit, itemLimit, pick };
};

describe('start aplikacji', () => {
  it('wczytuje bazę i pokazuje parametry sesji', async () => {
    const app = await boot();
    assert.match(app.text(), /Parametry sesji/);
    assert.equal(app.queryAll('.params-row').length, 7);
    assert.equal(app.query('#params-total').textContent.trim(), '70 ćwiczeń z 7 bloków');
    assert.match(app.query('#app-footer-info').textContent, /schemat 2\.0/);
  });

  it('nieznany adres wraca do parametrów', async () => {
    const app = await boot({ hash: '#/nieistniejacy' });
    assert.match(app.text(), /Parametry sesji/);
    assert.equal(app.hash(), '#/params');
  });

  it('pokazuje przyczynę, gdy bazy nie da się pobrać', async () => {
    const app = await boot({ response: errorResponse(404) });
    assert.match(app.text(), /Nie można uruchomić aplikacji/);
    assert.match(app.text(), /404/);
    assert.equal(app.queryAll('.params-row').length, 0);
  });

  it('podpowiada uruchomienie serwera, gdy zapytanie nie dochodzi', async () => {
    const app = await boot({ response: networkFailure() });
    assert.match(app.text(), /Nie udało się pobrać pliku bazy/);
    assert.match(app.text(), /serwera HTTP/);
  });

  it('pokazuje przyczynę niezgodności bazy ze schematem', async () => {
    const broken = loadRawDatabase();
    broken.exercises[0].variants[0].type = 'obrazek';
    const app = await boot({ response: jsonResponse(broken) });
    assert.match(app.text(), /nie odpowiada schematowi/);
    assert.match(app.text(), /nieznany typ "obrazek"/);
  });
});

describe('przebieg sesji', () => {
  it('zatwierdzenie parametrów rozpoczyna sesję od pierwszego ćwiczenia', async () => {
    const app = await boot();
    await app.click('#params-submit');
    assert.match(app.hash(), /^#\/session\/1\?/);
    assert.match(app.hash(), /\?s=[A-Za-z0-9_-]+$/);
    assert.match(stateFromHash(app).params.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(app.text(), /Ćwiczenie 1 z 70/);
  });

  it('przechodzi kolejno przez ćwiczenia i kończy podsumowaniem', async () => {
    const app = await boot({ hash: `#/session/1?${SESSION_QUERY}` });
    assert.match(app.text(), /Ćwiczenie 1 z 4/);
    assert.ok(app.query('[data-role="prev"]').disabled);

    await app.click('[data-role="next"]');
    assert.match(app.hash(), /#\/session\/2/);
    assert.match(app.text(), /Ćwiczenie 2 z 4/);

    await app.click('[data-role="prev"]');
    assert.match(app.hash(), /#\/session\/1/);

    await app.goto(`#/session/4?${SESSION_QUERY}`);
    assert.equal(app.query('[data-role="next"]').textContent.trim(), 'Zakończ sesję');
    await app.click('[data-role="next"]');
    assert.match(app.hash(), /^#\/summary/);
    assert.match(app.text(), /Sesja zakończona/);
    assert.equal(app.queryAll('.summary-list__item').length, 4);
  });

  it('strzałki na klawiaturze przechodzą między ćwiczeniami', async () => {
    const app = await boot({ hash: `#/session/2?${SESSION_QUERY}` });
    await app.press('ArrowRight');
    assert.match(app.hash(), /#\/session\/3/);
    await app.press('ArrowLeft');
    assert.match(app.hash(), /#\/session\/2/);
  });

  it('numer kroku spoza zakresu jest przycinany', async () => {
    const app = await boot({ hash: `#/session/99?${SESSION_QUERY}` });
    assert.match(app.hash(), /#\/session\/4/);
    assert.match(app.text(), /Ćwiczenie 4 z 4/);
  });

  it('uszkodzony lub stary stan sesji uruchamia ustawienia domyślne', async () => {
    const app = await boot({ hash: '#/session/1?d=2026-09-10&l=4&c=stary-format&s=uszkodzone' });
    assert.match(app.text(), /Ćwiczenie 1 z 70/);
  });

  it('ten sam adres po odświeżeniu daje ten sam zestaw ćwiczeń', async () => {
    const first = await boot({ hash: `#/session/1?${SESSION_QUERY}` });
    const titles = [];
    for (let step = 1; step <= 4; step += 1) {
      await first.goto(`#/session/${step}?${SESSION_QUERY}`);
      titles.push(first.query('.exercise-card__title').textContent);
    }

    const second = await boot({ hash: `#/session/1?${SESSION_QUERY}` });
    const reloaded = [];
    for (let step = 1; step <= 4; step += 1) {
      await second.goto(`#/session/${step}?${SESSION_QUERY}`);
      reloaded.push(second.query('.exercise-card__title').textContent);
    }

    assert.deepEqual(reloaded, titles);
  });

  it('kolejność kroków odpowiada kolejności kategorii w adresie', async () => {
    const app = await boot({ hash: `#/session/1?${SESSION_QUERY}` });
    const categories = [];
    for (let step = 1; step <= 4; step += 1) {
      await app.goto(`#/session/${step}?${SESSION_QUERY}`);
      categories.push(app.query('.exercise-card .chip').textContent);
    }
    assert.deepEqual(categories, [
      'samogłoski',
      'artykulacja i różnicowanie głosek',
      'wprawki artykulacyjne',
      'wprawki artykulacyjne',
    ]);
  });

  it('ziarno z adresu zmienia zestaw, a jego brak przywraca zestaw dnia', async () => {
    const params = clampParams(db, { date: '2026-09-10', level: 4,
      blocks: [{ id: 'teksty-do-czytania-terapeutycznego', count: 3, variantLimit: 1, itemLimit: 0, pick: 'kolejnosc' }] });
    const titles = async (app, seedOverride) => {
      const result = [];
      for (let step = 1; step <= 3; step += 1) {
        await app.goto(`#/session/${step}?${sessionQuery(params, seedOverride)}`);
        result.push(app.query('.exercise-card__title').textContent);
      }
      return result;
    };

    const app = await boot({ hash: `#/session/1?${sessionQuery(params)}` });
    const fromDate = await titles(app, null);
    const fromSeed = await titles(app, 'inne-ziarno');
    const backToDate = await titles(app, null);

    assert.notDeepEqual(fromSeed, fromDate);
    assert.deepEqual(backToDate, fromDate);
  });

  it('przełącznik oznaczeń zmienia tryb wyświetlania treści', async () => {
    const app = await boot({ hash: `#/session/1?${SESSION_QUERY}` });
    assert.equal(app.query('.exercise-card').dataset.marks, 'full');
    await app.click('[data-mark-mode="plain"]');
    assert.equal(app.query('.exercise-card').dataset.marks, 'plain');
    assert.equal(app.query('[data-mark-mode="plain"]').getAttribute('aria-pressed'), 'true');

    await app.goto(`#/session/2?${SESSION_QUERY}`);
    assert.equal(app.query('.exercise-card').dataset.marks, 'plain');
  });

  it('podsumowanie pozwala powtórzyć zestaw i wylosować nowy', async () => {
    const app = await boot({ hash: `#/summary?${SESSION_QUERY}` });
    await app.click('[data-role="repeat"]');
    assert.match(app.hash(), /#\/session\/1/);

    await app.goto(`#/summary?${SESSION_QUERY}`);
    await app.click('[data-role="reroll"]');
    assert.ok(stateFromHash(app).seedOverride);
  });
});

describe('parametry sesji', () => {
  it('zmiana poziomu przelicza limity kategorii', async () => {
    const app = await boot();
    const select = app.query('#param-level');
    select.value = '1';
    select.dispatchEvent(new app.window.Event('change', { bubbles: true }));

    const row = app.queryAll('.params-row').find((item) => item.dataset.category === 'teksty-do-czytania-terapeutycznego');
    assert.equal(row.querySelector('[data-role="count"]').max, '8');
    assert.match(row.textContent, /dostępnych: 8/);
  });

  it('wyłączenie kategorii zeruje licznik i zachowuje pozycję', async () => {
    const app = await boot();
    const before = app.queryAll('.params-row').map((row) => row.dataset.category);
    const row = app.queryAll('.params-row')[0];
    row.querySelector('[data-role="toggle"]').click();

    assert.equal(row.dataset.active, 'false');
    assert.equal(row.querySelector('[data-role="count"]').value, '0');
    assert.equal(app.query('#params-total').textContent.trim(), '64 ćwiczenia z 6 bloków');
    assert.deepEqual(app.queryAll('.params-row').map((item) => item.dataset.category), before);
  });

  it('liczba ćwiczeń jest przycinana do dostępnych', async () => {
    const app = await boot();
    const row = app.queryAll('.params-row').find((item) => item.dataset.category === 'artykulacja-i-roznicowanie-glosek');
    const input = row.querySelector('[data-role="count"]');
    input.value = '99';
    input.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    input.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    assert.equal(input.value, '21');
  });

  it('uchwyt pozwala przenieść blok klawiaturą', async () => {
    const app = await boot();
    const before = app.queryAll('.params-row').map((row) => row.dataset.category);
    const handle = () => app.query('[data-drag="block"][data-id="oddech-fonacja-i-rezonans"]');
    for (const key of [' ', 'ArrowUp', ' ']) handle().dispatchEvent(new app.window.KeyboardEvent('keydown', { key, bubbles:true }));
    const after = app.queryAll('.params-row').map((row) => row.dataset.category);
    assert.deepEqual(after.slice(0, 2), [before[1], before[0]]);
  });

  it('wyzerowanie wszystkich kategorii blokuje start sesji', async () => {
    const app = await boot();
    app.queryAll('.params-row').forEach((row) => {
      const toggle = row.querySelector('[data-role="toggle"]');
      if (row.dataset.active === 'true') {
        toggle.click();
      }
    });
    assert.ok(app.query('#params-submit').disabled);
    assert.match(app.query('#params-total').textContent, /Brak wybranych ćwiczeń/);
  });

  it('własne ziarno z formularza trafia do adresu sesji', async () => {
    const app = await boot();
    app.query('#param-seed').value = 'moje-ziarno';
    await app.click('#params-submit');
    assert.equal(stateFromHash(app).seedOverride, 'moje-ziarno');
  });

  it('ziarno wylosowanego zestawu wraca do formularza i zachowuje zestaw po zatwierdzeniu', async () => {
    const app = await boot({ hash: `#/summary?${SESSION_QUERY}` });
    await app.click('[data-role="reroll"]');
    const rerolledState = stateFromHash(app);
    const firstTitle = app.query('.exercise-card__title').textContent;
    await app.goto('#/params');
    assert.equal(app.query('#param-seed').value, rerolledState.seedOverride);
    await app.click('#params-submit');
    assert.equal(app.query('.exercise-card__title').textContent, firstTitle);
    assert.equal(stateFromHash(app).seedOverride, rerolledState.seedOverride);
  });

  it('wyczyszczenie ziarna przywraca zestaw domyślny dla daty', async () => {
    const app = await boot({ hash: `#/session/1?${sessionQuery(sessionParams, 'inne-ziarno')}` });
    await app.goto('#/params');
    await app.click('[data-role="seed-clear"]');
    await app.click('#params-submit');
    assert.equal(stateFromHash(app).seedOverride, null);
    const expected = await boot({ hash: `#/session/1?${SESSION_QUERY}` });
    assert.equal(app.query('.exercise-card__title').textContent, expected.query('.exercise-card__title').textContent);
  });

  it('wiersz pokazuje tylko te pola zakresu, które mają co ograniczać', async () => {
    const app = await boot();
    const field = (category, role) => app.query(`#param-${role}-${category}`);

    assert.ok(field('artykulacja-i-roznicowanie-glosek', 'variants'), 'kategoria wielowariantowa z pozycjami');
    assert.ok(field('artykulacja-i-roznicowanie-glosek', 'items'));

    assert.equal(field('wprawki-artykulacyjne', 'variants'), null, 'jeden wariant, są pozycje');
    assert.ok(field('wprawki-artykulacyjne', 'items'));

    assert.equal(field('teksty-do-czytania-terapeutycznego', 'variants'), null, 'nie ma czego ograniczać');
    assert.equal(field('teksty-do-czytania-terapeutycznego', 'items'), null);
  });

  it('pola zakresu startują na krańcach swojej kategorii', async () => {
    const app = await boot();
    const variants = app.query('#param-variants-artykulacja-i-roznicowanie-glosek');
    const items = app.query('#param-items-artykulacja-i-roznicowanie-glosek');
    assert.deepEqual([variants.value, variants.min, variants.max], ['6', '1', '6']);
    assert.deepEqual([items.value, items.max], ['58', '58']);
    assert.equal(app.query('#param-items-wprawki-artykulacyjne').max, '8');
    assert.equal(app.query('#pick-artykulacja-i-roznicowanie-glosek').value, 'kolejnosc');
  });

  it('zmniejszenie liczby wariantów dociąga pozycje tylko w swoim wierszu', async () => {
    const app = await boot();
    const variants = app.query('#param-variants-artykulacja-i-roznicowanie-glosek');
    variants.value = '1';
    variants.dispatchEvent(new app.window.Event('input', { bubbles: true }));

    const items = app.query('#param-items-artykulacja-i-roznicowanie-glosek');
    assert.equal(items.max, '30');
    assert.equal(items.value, '30');
    assert.equal(
      app.query('[data-category="artykulacja-i-roznicowanie-glosek"] [data-role="item-limit-range"]').textContent,
      '1–30',
    );
    assert.equal(app.query('#param-items-wprawki-artykulacyjne').value, '8');
  });

  it('limity kategorii i tryb doboru trafiają do adresu sesji', async () => {
    const app = await boot();
    const variants = app.query('#param-variants-artykulacja-i-roznicowanie-glosek');
    variants.value = '2';
    variants.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    const items = app.query('#param-items-artykulacja-i-roznicowanie-glosek');
    items.value = '5';
    items.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    const pick = app.query('#pick-artykulacja-i-roznicowanie-glosek');
    pick.value = 'losowo';
    pick.dispatchEvent(new app.window.Event('change', { bubbles: true }));

    await app.click('#params-submit');
    const restored = stateFromHash(app).params;
    assert.deepEqual(blockSettings(restored, 'artykulacja-i-roznicowanie-glosek'),
      { count: 21, variantLimit: 2, itemLimit: 5, pick: 'losowo' });
    assert.deepEqual(blockSettings(restored, 'teksty-do-czytania-terapeutycznego'),
      { count: 23, variantLimit: 1, itemLimit: 0, pick: 'kolejnosc' });
  });
});

describe('zapamiętywanie ustawień', () => {
  it('zatwierdzenie parametrów zapisuje ustawienia w przeglądarce', async () => {
    const storage = makeStorage();
    const app = await boot({ storage });
    assert.equal(storage.data.has(STORAGE_KEY), false);

    await app.click('#params-submit');
    assert.ok(storage.data.has(STORAGE_KEY));
    const stored = JSON.parse(storage.data.get(STORAGE_KEY));
    assert.equal(stored.level, 4);
    assert.deepEqual(stored.blocks.find((entry) => entry.id === 'artykulacja-i-roznicowanie-glosek'), {
      id: 'artykulacja-i-roznicowanie-glosek',
      count: 21,
      variantLimit: 6,
      itemLimit: 58,
      pick: 'kolejnosc',
    });
  });

  it('ustawienia wracają przy kolejnym otwarciu aplikacji', async () => {
    const storage = makeStorage();
    const first = await boot({ storage });
    const level = first.query('#param-level');
    level.value = '2';
    level.dispatchEvent(new first.window.Event('change', { bubbles: true }));
    const variants = first.query('#param-variants-artykulacja-i-roznicowanie-glosek');
    variants.value = '1';
    variants.dispatchEvent(new first.window.Event('input', { bubbles: true }));
    await first.click('#params-submit');

    const second = await boot({ storage });
    assert.equal(second.query('#param-level').value, '2');
    assert.equal(second.query('#param-variants-artykulacja-i-roznicowanie-glosek').value, '1');
    assert.equal(second.query('#param-items-artykulacja-i-roznicowanie-glosek').value, '30');
  });

  it('parametry z adresu mają pierwszeństwo przed zapisem', async () => {
    const storage = makeStorage();
    const first = await boot({ storage });
    const variants = first.query('#param-variants-artykulacja-i-roznicowanie-glosek');
    variants.value = '1';
    variants.dispatchEvent(new first.window.Event('input', { bubbles: true }));
    await first.click('#params-submit');
    assert.equal(stateFromHash(first).params.blocks.find((block) => block.id === 'artykulacja-i-roznicowanie-glosek').variantLimit, 1);

    const second = await boot({ storage, hash: `#/session/2?${SESSION_QUERY}` });
    assert.match(second.text(), /Ćwiczenie 2 z 4/);
    assert.match(second.query('.exercise-card .chip').textContent, /artykulacja i różnicowanie głosek/);
  });

  it('przywrócenie domyślnych czyści zapis i formularz', async () => {
    const storage = makeStorage();
    const app = await boot({ storage });
    const level = app.query('#param-level');
    level.value = '1';
    level.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    await app.click('#params-submit');
    assert.ok(storage.data.has(STORAGE_KEY));

    await app.goto('#/params');
    await app.click('[data-role="reset"]');
    assert.equal(storage.data.has(STORAGE_KEY), false);
    assert.equal(app.query('#param-level').value, '4');
    assert.equal(app.query('#param-items-artykulacja-i-roznicowanie-glosek').value, '58');
    assert.equal(app.query('#params-total').textContent.trim(), '70 ćwiczeń z 7 bloków');
  });

  it('uszkodzony zapis jest pomijany bez komunikatu', async () => {
    const storage = makeStorage({ [STORAGE_KEY]: 'to nie jest JSON' });
    const app = await boot({ storage });
    assert.match(app.text(), /Parametry sesji/);
    assert.equal(app.query('#params-total').textContent.trim(), '70 ćwiczeń z 7 bloków');
  });
});

describe('przeglądanie bazy', () => {
  it('pokazuje całą bazę pogrupowaną po kategoriach', async () => {
    const app = await boot({ hash: '#/browse' });
    assert.equal(app.queryAll('.browse-item').length, 70);
    assert.equal(app.queryAll('.browse-group').length, 7);
    assert.match(app.text(), /Znaleziono 70 ćwiczeń/);
  });

  it('wyszukiwanie zawęża listę i zapisuje się w adresie', async () => {
    const app = await boot({ hash: '#/browse' });
    const input = app.query('#browse-query');
    input.value = 'swiderki';
    input.dispatchEvent(new app.window.Event('input', { bubbles: true }));

    assert.equal(app.queryAll('.browse-item').length, 1);
    assert.equal(app.hash(), '#/browse?q=swiderki');
  });

  it('filtruje po kategorii i poziomie', async () => {
    const app = await boot({ hash: '#/browse?cat=teksty-do-czytania-terapeutycznego&level=2' });
    const items = app.queryAll('.browse-item');
    assert.ok(items.length > 0);
    assert.equal(app.queryAll('.browse-group').length, 1);
    assert.ok(items.every((item) => item.textContent.includes('poziom 2')));
  });

  it('informuje o braku wyników', async () => {
    const app = await boot({ hash: '#/browse?q=zupelnie-nieistniejaca-fraza' });
    assert.match(app.text(), /Żadne ćwiczenie nie pasuje/);
  });

  it('otwiera podgląd ćwiczenia z pełną treścią i surowymi danymi', async () => {
    const app = await boot({ hash: '#/browse/adam-andrzejewski' });
    assert.match(app.text(), /Adam Andrzejewski/);
    assert.match(app.text(), /Metryka/);
    assert.match(app.query('.raw-data').textContent, /"id": "adam-andrzejewski"/);
    assert.ok(!app.query('.raw-data').textContent.includes('"source"'));
    assert.ok(!app.query('.raw-data').textContent.includes('"notes"'));
  });

  it('podgląd zachowuje filtry w odnośniku powrotnym', async () => {
    const app = await boot({ hash: '#/browse/adam-andrzejewski?q=adam&cat=teksty-do-czytania-terapeutycznego' });
    const back = app.query('.btn--ghost');
    assert.equal(back.getAttribute('href'), '#/browse?q=adam&cat=teksty-do-czytania-terapeutycznego');
  });

  it('nieznane ćwiczenie kończy się czytelnym komunikatem', async () => {
    const app = await boot({ hash: '#/browse/nie-ma-takiego' });
    assert.match(app.text(), /Nie znaleziono ćwiczenia/);
    assert.match(app.text(), /nie-ma-takiego/);
  });

  it('nie pokazuje usuniętego rejestru audytowego bazy', async () => {
    const app = await boot({ hash: '#/browse' });
    assert.doesNotMatch(app.text(), /Rejestr audytowy bazy/);
    assert.equal(app.queryAll('.audit-table').length, 0);
  });
});
