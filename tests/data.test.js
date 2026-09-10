import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DatabaseError,
  buildDatabase,
  normalizeText,
  stripHtml,
  validateDatabase,
} from '../src/webapp/js/data.js';
import { loadDatabaseFixture, loadRawDatabase, makeRawDatabase, makeVariant } from './helpers.js';

const findIssue = (issues, fragment) => issues.find((issue) => issue.includes(fragment));

describe('walidacja bazy', () => {
  it('akceptuje dołączoną bazę', () => {
    assert.deepEqual(validateDatabase(loadRawDatabase()), []);
  });

  it('odrzuca dokument, który nie jest obiektem', () => {
    assert.deepEqual(validateDatabase([]), ['Plik bazy nie zawiera obiektu JSON.']);
    assert.deepEqual(validateDatabase(null), ['Plik bazy nie zawiera obiektu JSON.']);
  });

  it('wskazuje nieobsługiwaną wersję schematu', () => {
    const issues = validateDatabase(makeRawDatabase({ schemaVersion: '2.0' }));
    assert.ok(findIssue(issues, 'schemaVersion'), issues.join('\n'));
    assert.ok(findIssue(issues, 'nie jest obsługiwana'));
  });

  it('wykrywa brak wymaganych pól korzenia', () => {
    const raw = makeRawDatabase();
    delete raw.generated;
    assert.ok(findIssue(validateDatabase(raw), 'generated'));
  });

  it('wykrywa powtórzone identyfikatory ćwiczeń', () => {
    const raw = makeRawDatabase();
    raw.exercises[1].id = raw.exercises[0].id;
    const issues = validateDatabase(raw);
    assert.ok(findIssue(issues, 'powtarza się'), issues.join('\n'));
  });

  it('wykrywa odwołanie do nieistniejącej kategorii', () => {
    const raw = makeRawDatabase();
    raw.exercises[0].categoryId = 'brak-takiej';
    assert.ok(findIssue(validateDatabase(raw), 'brak kategorii "brak-takiej"'));
  });

  it('wykrywa nieznany typ wariantu', () => {
    const raw = makeRawDatabase();
    raw.exercises[0].variants[0].type = 'obrazek';
    assert.ok(findIssue(validateDatabase(raw), 'nieznany typ "obrazek"'));
  });

  it('wymaga treści dla wariantów text i syllables', () => {
    const withEmptyText = makeRawDatabase();
    withEmptyText.exercises[0].variants = [makeVariant({ id: 'x-w1', type: 'text', textHtml: null })];
    assert.ok(findIssue(validateDatabase(withEmptyText), 'wariant typu "text" wymaga treści'));

    const withEmptySyllables = makeRawDatabase();
    withEmptySyllables.exercises[0].variants = [makeVariant({ id: 'x-w1', type: 'syllables', syllablesHtml: null })];
    assert.ok(findIssue(validateDatabase(withEmptySyllables), 'wariant typu "syllables" wymaga treści'));
  });

  it('wymaga niepustej listy pozycji dla wariantu items', () => {
    const raw = makeRawDatabase();
    raw.exercises[0].variants = [makeVariant({ id: 'x-w1', type: 'items', items: [] })];
    assert.ok(findIssue(validateDatabase(raw), 'musi mieć co najmniej jedną pozycję'));
  });

  it('sprawdza zakres poziomu trudności', () => {
    const raw = makeRawDatabase();
    raw.exercises[0].level = 9;
    assert.ok(findIssue(validateDatabase(raw), '.level'));
  });

  it('wykrywa powtórzoną kolejność wariantów w ćwiczeniu', () => {
    const raw = makeRawDatabase();
    raw.exercises[0].variants = [
      makeVariant({ id: 'x-w1', order: 1, items: [{ id: 'i1', html: 'a' }] }),
      makeVariant({ id: 'x-w2', order: 1, items: [{ id: 'i2', html: 'b' }] }),
    ];
    assert.ok(findIssue(validateDatabase(raw), 'powtarza się w ćwiczeniu'));
  });

  it('buildDatabase zgłasza DatabaseError z listą przyczyn', () => {
    const raw = makeRawDatabase();
    raw.exercises[0].title = '';
    assert.throws(
      () => buildDatabase(raw),
      (error) => {
        assert.ok(error instanceof DatabaseError);
        assert.match(error.message, /schemat/i);
        assert.ok(error.issues.length > 0);
        return true;
      },
    );
  });
});

describe('normalizacja bazy', () => {
  const db = loadDatabaseFixture();

  it('liczy zawartość bazy', () => {
    assert.equal(db.stats.categoryCount, 25);
    assert.equal(db.stats.exerciseCount, 54);
    assert.equal(db.stats.variantCount, 97);
    assert.equal(db.stats.itemCount, 616);
  });

  it('porządkuje kategorie według pola order', () => {
    const orders = db.categories.map((category) => category.order);
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  });

  it('porządkuje ćwiczenia i warianty deterministycznie', () => {
    const ids = db.exercises.map((exercise) => exercise.id);
    assert.deepEqual(ids, [...ids].sort());
    db.exercises.forEach((exercise) => {
      const orders = exercise.variants.map((variant) => variant.order);
      assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
    });
  });

  it('grupuje ćwiczenia po kategoriach bez gubienia pozycji', () => {
    const grouped = [...db.exercisesByCategory.values()].reduce((total, list) => total + list.length, 0);
    assert.equal(grouped, db.stats.exerciseCount);
    db.exercisesByCategory.forEach((list, categoryId) => {
      assert.ok(list.every((exercise) => exercise.categoryId === categoryId));
    });
  });

  it('zachowuje surowe dane ćwiczenia bez pól pochodnych', () => {
    const exercise = db.exercises[0];
    assert.ok(exercise.raw);
    assert.equal(exercise.raw.searchText, undefined);
    assert.equal(exercise.raw.plainText, undefined);
    assert.equal(exercise.raw.id, exercise.id);
  });

  it('buduje tekst do wyszukiwania z treści ćwiczenia', () => {
    const exercise = db.exerciseById.get('adam-andrzejewski');
    assert.ok(exercise.searchText.includes('adam'));
    assert.ok(exercise.searchText.includes('aptekarzem'));
    assert.ok(!exercise.searchText.includes('<span'));
  });
});

describe('pomocnicze operacje na tekście', () => {
  it('stripHtml usuwa znaczniki i encje', () => {
    assert.equal(stripHtml('<p>Ala <span class="target">ma</span>&nbsp;kota</p>'), 'Ala ma kota');
    assert.equal(stripHtml(null), '');
    assert.equal(stripHtml('<br>'), '');
  });

  it('normalizeText usuwa znaki diakrytyczne i ujednolica wielkość liter', () => {
    assert.equal(normalizeText('Świderki ŁÓDŹ ćma'), 'swiderki lodz cma');
    assert.equal(normalizeText('  wiele   spacji  '), 'wiele spacji');
    assert.equal(normalizeText('Zażółć gęślą jaźń'), 'zazolc gesla jazn');
  });
});
