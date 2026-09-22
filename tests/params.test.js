import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as p from '../src/webapp/js/blocks.js';
import { buildPlan } from '../src/webapp/js/picker.js';
import { makeFixtureDatabase, makeParams, loadDatabaseFixture } from './helpers.js';

const db = makeFixtureDatabase();
const defaults = () => p.createDefaultParams(db, '2026-09-21');
const ids = (plan) => plan.steps.map((s) => s.exercise.id);
const roundTrip = (params) => p.decodeParams(new URLSearchParams(`d=${params.date}&l=${params.level}&c=${p.encodeParams(params).c}`), db);

describe('daty i poziom', () => {
  it('używa lokalnej daty i odrzuca nieistniejące daty', () => {
    assert.equal(p.todayIso(new Date(2026, 0, 2)), '2026-01-02');
    for (const value of ['2026-02-30', '2026-13-01', '', null]) assert.equal(p.isValidIsoDate(value), false);
    assert.ok(p.isValidIsoDate('2024-02-29'));
    assert.equal(p.withDate(defaults(), 'jutro').date, '2026-09-21');
    assert.equal(p.withDate(defaults(), '2026-12-01').date, '2026-12-01');
  });
  it('poziom jest limitem górnym, brak poziomu przechodzi', () => {
    assert.ok(p.isExerciseEligible({ level: null }, 1));
    assert.ok(!p.isExerciseEligible({ level: 3 }, 1));
    assert.equal(p.withLevel(db, defaults(), 1).blocks[0].count, 3);
    assert.equal(p.withLevel(db, defaults(), 99).level, 4);
    assert.equal(p.withLevel(db, defaults(), -1).level, 1);
  });
});

describe('bloki i krańce', () => {
  it('domyślnie obejmuje całą bazę bez ograniczeń', () => {
    const params = defaults();
    assert.equal(p.totalExercises(params), 13);
    assert.equal(params.blocks.length, 5);
    assert.ok(params.blocks.every((b) => b.wholeCategory && b.pick === 'kolejnosc'));
    assert.deepEqual(params.blocks.map((b) => [b.count,b.variantLimit,b.itemLimit]), [[6,1,12],[3,1,20],[2,2,0],[1,5,39],[1,1,0]]);
  });
  it('W i P wynikają z aktywnej zawartości danego bloku', () => {
    let params = p.withExerciseActive(db, defaults(), 'cat-b', 'b1', false);
    assert.equal(p.blockEntry(params, 'cat-b').itemLimit, 5);
    params = p.withExerciseActive(db, params, 'cat-c', 'c2', false);
    assert.equal(p.blockEntry(params, 'cat-c').variantLimit, 1);
    assert.equal(p.blockEntry(params, 'cat-c').itemLimit, 0);
  });
  it('P zależy od W i przycina się do krańca', () => {
    const params = p.withVariantLimit(db, defaults(), 'cat-d', 2);
    assert.equal(p.blockEntry(params, 'cat-d').itemLimit, 32);
    assert.equal(p.blockEntry(p.withItemLimit(db, params, 'cat-d', 0), 'cat-d').itemLimit, 2);
    assert.deepEqual(p.itemBounds(db, 'cat-e', 4, 1), { min: 0, max: 0 });
    assert.deepEqual(p.variantBounds(db, 'cat-d', 4), { min: 1, max: 5 });
  });
  it('wyłączenie bloku zachowuje ustawienia i pozycję', () => {
    const params = p.withPick(p.withVariantLimit(db, defaults(), 'cat-d', 2), 'cat-d', 'losowo');
    const off = p.withBlockActive(db, params, 'cat-d', false);
    assert.deepEqual(off.blocks.map((b) => b.key), params.blocks.map((b) => b.key));
    assert.deepEqual(p.blockEntry(off, 'cat-d'), { ...p.blockEntry(params, 'cat-d'), count: 0 });
    assert.equal(p.blockEntry(p.withBlockActive(db, off, 'cat-d', true), 'cat-d').count, 1);
  });
  it('brak aktywnych ćwiczeń wyłącza blok', () => {
    let params = defaults();
    for (const e of params.blocks[0].exercises) params = p.withExerciseActive(db, params, 'cat-a', e.id, false);
    assert.equal(params.blocks[0].count, 0);
    assert.ok(!p.activeSelections(params).some((b) => b.id === 'cat-a'));
  });
  it('podział dziedziczy dobór i resetuje liczby do własnych krańców', () => {
    const params = p.withMovedExercise(db, p.withPick(defaults(), 'cat-b', 'losowo'), 'cat-b', 'b2');
    const [source, split] = params.blocks.filter((b) => b.id === 'cat-b');
    assert.equal(params.blocks.indexOf(split), params.blocks.indexOf(source) + 1);
    assert.deepEqual([split.count,split.variantLimit,split.itemLimit,split.pick], [1,1,5,'losowo']);
    assert.ok(!source.exercises.some((e) => e.id === 'b2'));
    assert.equal(p.totalExercises(params), 13);
  });
  it('przenoszenie usuwa pusty blok i nie kopiuje ćwiczenia', () => {
    const split = p.withMovedExercise(db, defaults(), 'cat-a', 'a2');
    const merged = p.withMovedExercise(db, split, 'cat-a-block', 'a2', 'cat-a', 0);
    assert.equal(merged.blocks.length, 5);
    assert.equal(merged.blocks[0].exercises[0].id, 'a2');
    assert.equal(merged.blocks.flatMap((b) => b.exercises).filter((e) => e.id === 'a2').length, 1);
  });
  it('obca kategoria nie przyjmuje ćwiczenia', () => {
    const params = defaults();
    assert.equal(p.withMovedExercise(db, params, 'cat-a', 'a1', 'cat-b'), params);
  });
  it('przestawianie bloku i ćwiczeń zachowuje krańce', () => {
    const params = defaults();
    const moved = p.withMovedBlock(params, 'cat-d', 0);
    assert.deepEqual(moved.blocks[0], params.blocks[3]);
    assert.equal(p.withMovedBlock(params, 'cat-a', -1), params);
    const reversed = p.withMovedExercise(db, params, 'cat-a', 'a1', 'cat-a', 5);
    assert.equal(reversed.blocks[0].itemLimit, params.blocks[0].itemLimit);
  });
  it('nieznany tryb i nieznane ćwiczenia nie trafiają do bloku', () => {
    assert.equal(p.withPick(defaults(), 'cat-a', 'invalid').blocks[0].pick, 'kolejnosc');
    const result = p.clampParams(db, { ...defaults(), blocks: [{ id: 'cat-a', exercises: [{id:'b1'}, {id:'a1'}, {id:'a1'}, {id:'no'}] }] });
    assert.deepEqual(result.blocks[0].exercises, [{ id:'a1', active:true }]);
  });
});

describe('adres, ziarno i sesja', () => {
  it('domyślna pełna kategoria pomija identyfikatory ćwiczeń', () => {
    assert.equal(p.encodeParams(makeParams([['cat-e', 1]])).c, 'cat-e:1:1:0:kolejnosc');
    assert.equal(p.encodeParams(defaults()).o, undefined);
  });
  it('podział i różne tryby przetrwają ponowne wczytanie adresu', () => {
    const split = p.withMovedExercise(db, defaults(), 'cat-a', 'a1');
    const params = p.withPick(split, 'cat-a-block', 'losowo');
    const restored = roundTrip(params);
    assert.equal(p.paramsSignature(restored), p.paramsSignature(params));
    assert.deepEqual(ids(buildPlan(db, restored)), ids(buildPlan(db, params)));
    assert.equal(restored.blocks.filter((b) => b.id === 'cat-a').length, 2);
  });
  it('kolejność ćwiczeń pełnej kategorii też przetrwa adres', () => {
    const params = p.withMovedExercise(db, defaults(), 'cat-a', 'a1', 'cat-a', 5);
    assert.equal(params.blocks[0].wholeCategory, false);
    assert.deepEqual(ids(buildPlan(db, roundTrip(params))), ids(buildPlan(db, params)));
  });
  it('adres pomija wyłączone ćwiczenia i nigdy nie przywraca ich do losowania', () => {
    const params = p.withExerciseActive(db, defaults(), 'cat-a', 'a1', false);
    assert.ok(!ids(buildPlan(db, roundTrip(params))).includes('a1'));
    assert.equal(p.paramsSignature(roundTrip(params)), p.paramsSignature(params));
  });
  it('nieznane i powtórzone ćwiczenia są pomijane w całej sesji', () => {
    const params = p.decodeParams(new URLSearchParams('c=cat-a:9:1:12:losowo:a1+a2+no+b1,cat-a:9:1:12:kolejnosc:a2+a3'), db);
    assert.deepEqual(ids(buildPlan(db, params)), ['a1','a2','a3']);
  });
  it('urwane wpisy i liczby spoza zakresu używają krańców', () => {
    const params = p.decodeParams(new URLSearchParams('c=cat-d:99:2,cat-a:999:99:-5&l=4'), db);
    assert.deepEqual(params.blocks.filter((b) => b.count).map((b) => [b.id,b.count,b.variantLimit,b.itemLimit]), [['cat-d',1,2,32],['cat-a',6,1,1]]);
    assert.equal(p.totalExercises(p.decodeParams(new URLSearchParams(),db)),0);
  });
  it('kolejność, W, P i dobór nie zmieniają ziarna ani wybranych ćwiczeń', () => {
    const base = makeParams([['cat-a',3],['cat-b',2],['cat-d',1]]);
    const changed = p.withPick(p.withVariantLimit(db,p.withMovedBlock(base,'cat-d',0),'cat-d',1),'cat-a','losowo');
    assert.equal(p.buildSeedString(base,'1'),p.buildSeedString(changed,'1'));
    assert.deepEqual(new Set(ids(buildPlan(db,base))),new Set(ids(buildPlan(db,changed))));
    assert.notEqual(p.paramsSignature(base),p.paramsSignature(changed));
  });
  it('przestawienie ćwiczeń zmienia układ, a nie wybór', () => {
    const base = makeParams([['cat-a',3]]);
    const changed = p.withMovedExercise(db,base,'cat-a','a1','cat-a',5);
    assert.equal(p.buildSeedString(base,'1'),p.buildSeedString(changed,'1'));
    assert.deepEqual(new Set(ids(buildPlan(db,base))),new Set(ids(buildPlan(db,changed))));
  });
  it('aktywność, podział, data i poziom zmieniają ziarno', () => {
    const base = defaults(); const seed = p.buildSeedString(base,'1');
    for (const changed of [p.withExerciseActive(db,base,'cat-a','a1',false),p.withMovedExercise(db,base,'cat-a','a1'),p.withDate(base,'2026-09-22'),p.withLevel(db,base,1)]) assert.notEqual(seed,p.buildSeedString(changed,'1'));
    assert.notEqual(seed,p.buildSeedString(base,'2'));
  });
  it('blok ma własny budżet nawet przy wspólnej kategorii', () => {
    let params = p.withMovedExercise(db,makeParams([['cat-a',6]]),'cat-a','a1');
    params = p.withItemLimit(db,params,'cat-a',2);
    params = p.withItemLimit(db,params,'cat-a-block',7);
    for (const step of buildPlan(db,params).steps) assert.equal(step.variants[0].items.length,step.exercise.id==='a1'?7:2);
  });
  it('100 konfiguracji prawdziwej bazy zachowuje plan po serializacji i nie dubluje ćwiczeń', () => {
    const real = loadDatabaseFixture();
    for (let i=0;i<100;i++) {
      let params = p.createDefaultParams(real,'2026-09-21');
      const source = params.blocks.find((b) => b.exercises.length>2);
      const id = source.exercises[i % source.exercises.length].id;
      params = p.withMovedExercise(real,params,source.key,id);
      params = p.withPick(params,`${source.key}-block`, i%2 ? 'losowo':'kolejnosc');
      params = p.withLevel(real,params,i%4+1);
      params = p.withMovedBlock(params,`${source.key}-block`,i%params.blocks.length);
      const encoded = p.encodeParams(params);
      const restored = p.decodeParams(new URLSearchParams(`d=${encoded.d}&l=${encoded.l}&c=${encoded.c}`),real);
      const before = buildPlan(real,params); const after = buildPlan(real,restored);
      assert.deepEqual(after.steps.map((s) => [s.exercise.id,s.variants.map((v) => [v.variant.id,v.items.map((item)=>item.id)])]),before.steps.map((s) => [s.exercise.id,s.variants.map((v) => [v.variant.id,v.items.map((item)=>item.id)])]));
      assert.equal(new Set(ids(before)).size,before.steps.length);
    }
  });
});
