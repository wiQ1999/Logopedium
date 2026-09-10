const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

export function hashSeed(text) {
  const input = String(text);
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function mulberry32(seedNumber) {
  let state = seedNumber >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seedText) {
  const next = mulberry32(hashSeed(seedText));

  function int(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('Zakres losowania musi być dodatnią liczbą całkowitą.');
    }
    return Math.floor(next() * maxExclusive);
  }

  function sample(list, count) {
    const pool = [...list];
    const size = Math.max(0, Math.min(count, pool.length));
    for (let i = 0; i < size; i += 1) {
      const j = i + int(pool.length - i);
      const swap = pool[i];
      pool[i] = pool[j];
      pool[j] = swap;
    }
    return pool.slice(0, size);
  }

  function shuffle(list) {
    return sample(list, list.length);
  }

  return { next, int, sample, shuffle };
}

export function randomToken() {
  const source = globalThis.crypto;
  if (source && typeof source.getRandomValues === 'function') {
    const buffer = new Uint32Array(2);
    source.getRandomValues(buffer);
    return `${buffer[0].toString(36)}${buffer[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
}
