import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { browseHref, filterExercises, matchesQuery, readFilters } from '../src/webapp/js/browse.js';
import { loadDatabaseFixture } from './helpers.js';

const db = loadDatabaseFixture();
const ids = (list) => list.map((exercise) => exercise.id);

describe('wyszukiwanie w bazie', () => {
  it('pomija znaki diakrytyczne i wielkość liter', () => {
    const exercise = db.exerciseById.get('adam-andrzejewski');
    assert.ok(matchesQuery(exercise, 'ANDRZEJEWSKI'));
    assert.ok(matchesQuery(exercise, 'aptekarzem'));
    assert.ok(matchesQuery(exercise, 'urodziny'));
    assert.ok(!matchesQuery(exercise, 'kosmonauta'));
  });

  it('wymaga wystąpienia wszystkich słów zapytania', () => {
    const exercise = db.exerciseById.get('adam-andrzejewski');
    assert.ok(matchesQuery(exercise, 'adam tort'));
    assert.ok(!matchesQuery(exercise, 'adam kosmonauta'));
  });

  it('puste zapytanie pasuje do każdego ćwiczenia', () => {
    assert.ok(db.exercises.every((exercise) => matchesQuery(exercise, '   ')));
  });

  it('przeszukuje tytuł, polecenie i treść', () => {
    const found = filterExercises(db, { query: 'szlachta', category: '', level: '' });
    assert.ok(ids(found).includes('alsza-szla-roznicowanie-sz-l'));
  });
});

describe('filtrowanie bazy', () => {
  it('filtruje po kategorii', () => {
    const found = filterExercises(db, { query: '', category: 'artykulacja-i-roznicowanie-glosek', level: '' });
    assert.ok(found.length > 0);
    assert.ok(found.every((exercise) => exercise.categoryId === 'artykulacja-i-roznicowanie-glosek'));
  });

  it('filtruje po dokładnym poziomie', () => {
    const found = filterExercises(db, { query: '', category: '', level: '2' });
    assert.ok(found.length > 0);
    assert.ok(found.every((exercise) => exercise.level === 2));
  });

  it('wybiera ćwiczenia bez określonego poziomu', () => {
    const found = filterExercises(db, { query: '', category: '', level: 'none' });
    assert.equal(found.length, 54);
    assert.ok(found.every((exercise) => exercise.level === null));
  });

  it('łączy kryteria', () => {
    const found = filterExercises(db, {
      query: 'samogłoski',
      category: 'teksty-do-czytania-terapeutycznego',
      level: '2',
    });
    assert.ok(found.length > 0);
    assert.ok(
      found.every(
        (exercise) => exercise.categoryId === 'teksty-do-czytania-terapeutycznego' && exercise.level === 2,
      ),
    );
  });

  it('brak filtrów zwraca całą bazę', () => {
    assert.equal(filterExercises(db, { query: '', category: '', level: '' }).length, db.stats.exerciseCount);
  });
});

describe('adresy trybu przeglądania', () => {
  it('czyta filtry z parametrów adresu', () => {
    const filters = readFilters(new URLSearchParams('q=sz&cat=artykulacja-i-roznicowanie-glosek&level=none'));
    assert.deepEqual(filters, { query: 'sz', category: 'artykulacja-i-roznicowanie-glosek', level: 'none' });
    assert.deepEqual(readFilters(new URLSearchParams('')), { query: '', category: '', level: '' });
  });

  it('buduje adres listy i podglądu z zachowaniem filtrów', () => {
    assert.equal(browseHref({ query: '', category: '', level: '' }), '#/browse');
    assert.equal(browseHref({ query: 'sz cz', category: 'artykulacja-i-roznicowanie-glosek', level: '2' }), '#/browse?q=sz%20cz&cat=artykulacja-i-roznicowanie-glosek&level=2');
    assert.equal(
      browseHref({ query: '', category: 'artykulacja-i-roznicowanie-glosek', level: '' }, 'adam-andrzejewski'),
      '#/browse/adam-andrzejewski?cat=artykulacja-i-roznicowanie-glosek',
    );
  });

  it('adres podglądu jest odwracalny', () => {
    const filters = { query: 'ą & ź', category: '', level: '' };
    const href = browseHref(filters, 'adam-andrzejewski');
    const queryString = href.slice(href.indexOf('?') + 1);
    assert.equal(readFilters(new URLSearchParams(queryString)).query, filters.query);
  });
});
