import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRng, hashSeed, mulberry32, randomToken } from '../src/webapp/js/rng.js';

const sequence = (seed, length) => {
  const next = mulberry32(hashSeed(seed));
  return Array.from({ length }, () => next());
};

describe('rng', () => {
  it('hashSeed jest deterministyczny i różnicuje ziarna', () => {
    assert.equal(hashSeed('logopedium'), hashSeed('logopedium'));
    assert.notEqual(hashSeed('logopedium'), hashSeed('logopedium '));
    assert.ok(Number.isInteger(hashSeed('x')) && hashSeed('x') >= 0);
  });

  it('generator zwraca tę samą sekwencję dla tego samego ziarna', () => {
    assert.deepEqual(sequence('a', 20), sequence('a', 20));
    assert.notDeepEqual(sequence('a', 20), sequence('b', 20));
  });

  it('wartości mieszczą się w przedziale [0, 1)', () => {
    const values = sequence('rozkład', 5000);
    assert.ok(values.every((value) => value >= 0 && value < 1));
    const mean = values.reduce((total, value) => total + value, 0) / values.length;
    assert.ok(Math.abs(mean - 0.5) < 0.02, `średnia poza zakresem: ${mean}`);
  });

  it('int zwraca liczby z zadanego zakresu', () => {
    const rng = createRng('int');
    const values = Array.from({ length: 500 }, () => rng.int(7));
    assert.ok(values.every((value) => Number.isInteger(value) && value >= 0 && value < 7));
    assert.equal(new Set(values).size, 7);
    assert.throws(() => rng.int(0), RangeError);
  });

  it('sample losuje bez zwracania', () => {
    const pool = Array.from({ length: 30 }, (unused, index) => index);
    const drawn = createRng('sample').sample(pool, 8);
    assert.equal(drawn.length, 8);
    assert.equal(new Set(drawn).size, 8);
    assert.ok(drawn.every((value) => pool.includes(value)));
    assert.deepEqual(pool, Array.from({ length: 30 }, (unused, index) => index));
  });

  it('sample przycina rozmiar do długości listy', () => {
    const drawn = createRng('cap').sample([1, 2, 3], 10);
    assert.equal(drawn.length, 3);
    assert.deepEqual([...drawn].sort(), [1, 2, 3]);
  });

  it('sample z tym samym ziarnem daje ten sam wynik', () => {
    const pool = Array.from({ length: 50 }, (unused, index) => `e${index}`);
    assert.deepEqual(createRng('seed-1').sample(pool, 10), createRng('seed-1').sample(pool, 10));
    assert.notDeepEqual(createRng('seed-1').sample(pool, 10), createRng('seed-2').sample(pool, 10));
  });

  it('shuffle zachowuje zawartość listy', () => {
    const pool = Array.from({ length: 40 }, (unused, index) => index);
    const shuffled = createRng('shuffle').shuffle(pool);
    assert.equal(shuffled.length, pool.length);
    assert.deepEqual([...shuffled].sort((a, b) => a - b), pool);
    assert.notDeepEqual(shuffled, pool);
  });

  it('randomToken zwraca niepusty, zmienny identyfikator', () => {
    const first = randomToken();
    const second = randomToken();
    assert.ok(first.length > 0);
    assert.notEqual(first, second);
  });
});
