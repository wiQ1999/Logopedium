import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import * as p from '../src/webapp/js/blocks.js';
import { STORAGE_KEY, SETTINGS_VERSION, readSettings, writeSettings } from '../src/webapp/js/settings.js';
import { makeStorage } from './dom-helpers.js';
import { makeFixtureDatabase, makeExercise } from './helpers.js';
const db=makeFixtureDatabase();
const storage=(value)=>globalThis.localStorage=makeStorage(value ? {[STORAGE_KEY]:JSON.stringify(value)} : {});
afterEach(()=>delete globalThis.localStorage);

it('wersja 3 zapisuje bloki, a pełne kategorie pomijają listę ćwiczeń',()=>{
  const s=storage(); p.storeParams(p.createDefaultParams(db));
  const raw=JSON.parse(s.data.get(STORAGE_KEY));
  assert.equal(raw.version,3); assert.equal(SETTINGS_VERSION,3);
  assert.equal(raw.blocks[0].exercises,undefined);
  assert.equal(raw.date,undefined); assert.equal(raw.seed,undefined);
});
it('zapis zachowuje podział, aktywność, kolejność i dobór każdego bloku',()=>{
  storage(); let params=p.withMovedExercise(db,p.createDefaultParams(db),'cat-a','a1');
  params=p.withExerciseActive(db,params,'cat-a','a2',false);
  params=p.withPick(params,'cat-a-block','losowo');
  params=p.withMovedBlock(params,'cat-a-block',4);
  p.storeParams(params); const restored=p.loadStoredParams(db,'2026-12-01');
  assert.equal(restored.date,'2026-12-01');
  const comparable=(b)=>({id:b.id,count:b.count,pick:b.pick,exercises:b.exercises,variantLimit:b.variantLimit,itemLimit:b.itemLimit});
  assert.deepEqual(restored.blocks.map(comparable),params.blocks.map(comparable));
});
it('nowe ćwiczenie trafia do pierwszego bloku kategorii, nowa kategoria na koniec',()=>{
  storage(); const params=p.withMovedExercise(db,p.createDefaultParams(db),'cat-a','a1'); p.storeParams(params);
  const changed=makeFixtureDatabase({exercises:[...db.raw.exercises,makeExercise({id:'a7'}),makeExercise({id:'z1',categoryId:'cat-z'})],categories:[...db.raw.categories,{id:'cat-z',name:'Z'}]});
  const restored=p.loadStoredParams(changed);
  assert.ok(restored.blocks[0].exercises.some((e)=>e.id==='a7'&&e.active));
  assert.equal(restored.blocks.at(-1).id,'cat-z');
});
it('stare wersje, nieprawidłowy JSON i uszkodzone listy są odrzucane',()=>{
  for(const value of [{version:2,blocks:[]},{version:4,blocks:[]},{version:3},{version:3,blocks:[{id:'cat-a',exercises:'bad'}]},{version:3,blocks:[null]},{version:3,blocks:[[]]},{version:3,blocks:[{}]}]){
    storage(value); assert.equal(p.loadStoredParams(db),null);
  }
  globalThis.localStorage=makeStorage({[STORAGE_KEY]:'bad json'}); assert.equal(readSettings(),null);
});
it('nieznane dane są pomijane, zakresy przycinane, nowe kategorie dopisywane',()=>{
  storage({version:3,level:99,blocks:[{id:'unknown'}, {id:'cat-d',count:999,variantLimit:99,itemLimit:-1,pick:'bad'}]});
  const params=p.loadStoredParams(db); assert.equal(params.level,4);
  assert.deepEqual(params.blocks.map((b)=>b.id),['cat-d','cat-a','cat-b','cat-c','cat-e']);
  assert.deepEqual([params.blocks[0].count,params.blocks[0].variantLimit,params.blocks[0].itemLimit,params.blocks[0].pick],[1,5,5,'kolejnosc']);
});
it('brak i niedostępność magazynu nie przerywają pracy',()=>{
  assert.equal(p.loadStoredParams(db),null); assert.equal(writeSettings({}),false);
  globalThis.localStorage={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};
  assert.equal(readSettings(),null); assert.equal(p.storeParams(p.createDefaultParams(db)),false); assert.equal(p.forgetParams(),false);
});
it('przywrócenie domyślnych usuwa zapis',()=>{
  const s=storage(); p.storeParams(p.createDefaultParams(db)); assert.ok(s.data.has(STORAGE_KEY));
  assert.ok(p.forgetParams()); assert.equal(p.loadStoredParams(db),null);
});
