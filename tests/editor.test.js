import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { JSDOM } from 'jsdom';
import { applyMark, createDraft, mountEditor, prepareExport } from '../src/webapp/js/editor.js';
import { MARKS, sanitizeHtml, visitHtml } from '../src/webapp/js/html.js';
import { buildDatabase, validateDatabase } from '../src/webapp/js/data.js';
import { loadDatabaseFixture } from './helpers.js';
import { bootApp, tick } from './dom-helpers.js';

const db = loadDatabaseFixture();
let app;
afterEach(()=>{app?.teardown();app=null;});

describe('bezpieczny HTML',()=>{
  for(const input of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>','<span class="target" onclick="alert(1)">x</span>', '<span class="unknown">x</span>', '<svg><foreignObject>test</foreignObject></svg>', '<a href="javascript:alert(1)">x</a>', '<span style="color:red">x</span>', '<p><p>x</p></p>', '<strong><em>x</strong></em>']) {
    it(`odrzuca ${input}`,()=>{
      const result=sanitizeHtml(input); assert.ok(result.issues.length); assert.ok(!result.html.includes('<'));
    });
  }
  it('akceptuje wszystkie treści oryginalnej bazy, zachowując tekst',()=>{
    const draft=createDraft(db); let count=0;
    const dom=new JSDOM(); const doc=dom.window.document;
    visitHtml(draft,(object,key)=>{
      const result=sanitizeHtml(object[key]); assert.deepEqual(result.issues,[]);
      const a=doc.createElement('div');const b=doc.createElement('div');a.innerHTML=object[key];b.innerHTML=result.html;
      assert.equal(a.textContent,b.textContent);count++;
    });
    assert.ok(count>735);dom.window.close();
  });
  it('usuwa puste znaczniki bez usuwania semantycznych pustych oznaczeń',()=>{
    assert.equal(sanitizeHtml('<p><span class="target"></span></p><span class="blank"></span><span class="exhale"></span>').html,'<span class="blank"></span><span class="exhale"></span>');
  });
  it('walidacja całej bazy wykrywa niebezpieczny HTML również poza aktualnym ćwiczeniem',()=>{
    const draft=createDraft(db);draft.exercises.at(-1).variants[0].instructionHtml='<script>bad()</script>';
    assert.ok(validateDatabase(draft).some(s=>s.includes('HTML')));assert.ok(prepareExport(draft).issues.length);
  });
});

describe('zaznaczenie i klasy semantyczne',()=>{
  for(const mark of Object.keys(MARKS)) it(`nakłada ${mark} na zaznaczone litery, zachowując resztę`,()=>{
    const dom=new JSDOM('<div id="edit" contenteditable="true"><p>aptekarz</p><p>drugi wiersz</p></div>');
    const doc=dom.window.document;const el=doc.querySelector('#edit');const range=doc.createRange();const text=el.firstChild.firstChild;
    range.setStart(text,2);range.setEnd(text,5);
    const next=applyMark(el,range,mark);assert.equal(next.toString(),'tek');
    assert.equal(el.innerHTML,`<p>ap<span class="${mark}">tek</span>arz</p><p>drugi wiersz</p>`);dom.window.close();
  });
  it('zaznaczenie przez akapity nie tworzy nieprawidłowego HTML',()=>{
    const dom=new JSDOM('<div id="edit"><p>pierwszy <em>wiersz</em></p><p>drugi</p></div>');
    const doc=dom.window.document;const el=doc.querySelector('#edit');const range=doc.createRange();
    range.setStart(el.firstChild.firstChild,3);range.setEnd(el.lastChild.firstChild,2);
    const before=el.textContent;applyMark(el,range,'target');
    assert.equal(el.textContent,before);assert.deepEqual(sanitizeHtml(el.innerHTML).issues,[]);dom.window.close();
  });
  it('puste i obce zaznaczenie pozostaje nietknięte',()=>{
    const dom=new JSDOM('<div id="edit">tekst</div><p>inne</p>');const el=dom.window.document.querySelector('#edit');
    const range=dom.window.document.createRange();range.selectNodeContents(dom.window.document.querySelector('p'));
    assert.equal(applyMark(el,range,'target'),null);assert.equal(el.innerHTML,'tekst');dom.window.close();
  });
});

describe('eksport kompletnej bazy',()=>{
  it('otwiera wszystkie 70 ćwiczeń bez zmiany danych i z aktywnym eksportem',()=>{
    const dom = new JSDOM('<main></main>'); const root = dom.window.document.querySelector('main');
    for (const exercise of db.exercises) {
      const state = { db };
      const cleanup = mountEditor(root, state, exercise.id, null, '#/browse');
      assert.ok(!root.querySelector('[data-action="export"]').disabled, exercise.id);
      assert.equal(root.querySelectorAll('#editor-fields details').length, exercise.variants.length);
      assert.deepEqual(state.editorDraft.raw, db.raw);
      cleanup();
    }
    dom.window.close();
  });
  it('modyfikuje wyłącznie kopię, zachowuje identyfikatory i nieznane metadane',()=>{
    const draft=createDraft(db);draft.extra={preserved:true};draft.exercises[0].title='Poprawiony tytuł';
    const result=prepareExport(draft,new Date('2026-09-21T12:34:56Z'));
    assert.deepEqual(result.issues,[]);assert.equal(JSON.parse(result.json).exercises[0].title,'Poprawiony tytuł');
    assert.notEqual(db.raw.exercises[0].title,'Poprawiony tytuł');
    assert.deepEqual(result.raw.extra,{preserved:true});
    assert.deepEqual(result.raw.exercises.map(e=>e.id),db.raw.exercises.map(e=>e.id));
    assert.equal(result.raw.generated,'2026-09-21T12:34:56.000Z');
    assert.equal(buildDatabase(JSON.parse(result.json)).stats.exerciseCount,70);
  });
  it('nie eksportuje niekompletnej bazy',()=>{
    const draft=createDraft(db);draft.exercises[0].title='';
    assert.equal(prepareExport(draft).raw,null);
  });
  it('puste znaczniki nie zastępują wymaganej treści',()=>{
    const draft=createDraft(db);
    draft.exercises.find(e=>e.variants.some(v=>v.type==='text')).variants.find(v=>v.type==='text').textHtml='<p><span class="target"></span><br>&nbsp;</p>';
    assert.equal(prepareExport(draft).raw,null);
    assert.ok(validateDatabase(draft).some(s=>s.includes('wymaga treści')));
    const other=createDraft(db);
    other.exercises.find(e=>e.variants.some(v=>v.items.length)).variants.find(v=>v.items.length).items[0].html='';
    assert.equal(prepareExport(other).raw,null);
  });
});

const editHash='#/browse/adam-andrzejewski?edit=1';
const input=(el,value)=>{el.value=value;el.dispatchEvent(new app.window.Event('input',{bubbles:true}));};
const richInput=(el,html)=>{el.innerHTML=html;el.dispatchEvent(new app.window.Event('input',{bubbles:true}));};
const field=(label)=>app.queryAll('label.field').find(el=>el.firstChild.textContent===label)?.querySelector('textarea,select');

describe('przebieg pracy w edytorze',()=>{
  it('wchodzi z podglądu do edycji ćwiczenia i wybranego wariantu',async()=>{
    app=await bootApp({hash:'#/browse/adam-andrzejewski'});
    const variantLink=app.queryAll('a').find(el=>el.textContent==='Edytuj wariant').getAttribute('href');
    await app.click('a[href*="edit=1"]');assert.match(app.text(),/Edycja ćwiczenia/);
    assert.ok(field('Tytuł'));assert.equal(app.queryAll('[data-mark]').length,8);
    await app.goto(variantLink);assert.match(app.text(),/Edycja wariantu/);assert.equal(field('Tytuł'),undefined);
  });
  it('pola tekstowe i HTML aktualizują podgląd na każdym input',async()=>{
    app=await bootApp({hash:editHash});input(field('Tytuł'),'Nowy tytuł');
    assert.equal(app.query('#editor-preview .exercise-card__title').textContent,'Nowy tytuł');
    const rich=app.query('[data-rich]');richInput(rich,'<p>Treść <span class="target">sz</span></p>');
    assert.match(app.query('#editor-preview').innerHTML,/class="target">sz/);
    assert.match(app.query('#editor-status').textContent,/Niezapisane/);
  });
  it('pasek zachowuje zaznaczenie po przejściu klawiaturą do przycisku',async()=>{
    app=await bootApp({hash:editHash});const rich=app.query('[data-rich]');richInput(rich,'abc def');
    const range=app.document.createRange();range.setStart(rich.firstChild,1);range.setEnd(rich.firstChild,3);
    const selection=app.window.getSelection();selection.removeAllRanges();selection.addRange(range);
    app.document.dispatchEvent(new app.window.Event('selectionchange'));
    const button=app.query('[data-mark="legato"]');button.focus();button.click();
    assert.equal(rich.innerHTML,'a<span class="legato">bc</span> def');
    assert.equal(selection.toString(),'bc');assert.match(app.query('#editor-preview').innerHTML,/class="legato">bc/);
  });
  it('wklejenie HTML trafia do pola jako tekst, bez wykonania kodu',async()=>{
    app=await bootApp({hash:editHash});const rich=app.query('[data-rich]');richInput(rich,'');
    const event=new app.window.Event('paste',{bubbles:true,cancelable:true});
    Object.defineProperty(event,'clipboardData',{value:{getData:()=>'<img src=x onerror=alert(1)>'}});rich.dispatchEvent(event);
    assert.equal(rich.querySelector('img'),null);assert.equal(rich.textContent,'<img src=x onerror=alert(1)>');
    assert.ok(!app.query('[data-action="export"]').disabled);
  });
  it('niepoprawne dane blokują podgląd i eksport, poprawienie je odblokowuje',async()=>{
    app=await bootApp({hash:editHash});const title=field('Tytuł');input(title,'');
    assert.ok(app.query('[data-action="export"]').disabled);assert.ok(app.query('#editor-errors [role="alert"]'));
    input(title,'Tytuł');assert.ok(!app.query('[data-action="export"]').disabled);
    richInput(app.query('[data-rich]'),'<img src=x onerror="alert(1)">');
    assert.ok(app.query('[data-action="export"]').disabled);assert.equal(app.query('#editor-preview img'),null);
  });
  it('Enter i wielowierszowe wklejenie używają bezpiecznych łamań wiersza',async()=>{
    app=await bootApp({hash:editHash});const rich=app.query('[data-rich]');richInput(rich,'abc');
    const range=app.document.createRange();range.selectNodeContents(rich);range.collapse(false);
    const selection=app.window.getSelection();selection.removeAllRanges();selection.addRange(range);
    rich.dispatchEvent(new app.window.InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true}));
    assert.ok(rich.querySelector('br'));assert.equal(rich.querySelector('div'),null);
    const event=new app.window.Event('paste',{bubbles:true,cancelable:true});
    Object.defineProperty(event,'clipboardData',{value:{getData:()=> 'drugi\ntrzeci'}});rich.dispatchEvent(event);
    assert.match(rich.innerHTML,/abc<br>drugi<br>trzeci/);
    assert.ok(!app.query('[data-action="export"]').disabled);
  });
  it('anulowanie wyjścia chroni dane, potwierdzenie przywraca źródło',async()=>{
    app=await bootApp({hash:editHash});input(field('Tytuł'),'Niezapisane');let calls=0;
    app.window.confirm=()=>{calls++;return false;};await app.goto('#/browse');
    assert.equal(app.hash(),editHash);assert.equal(field('Tytuł').value,'Niezapisane');assert.equal(calls,1);
    app.window.confirm=()=>true;await app.goto('#/browse');assert.equal(app.hash(),'#/browse');
    await app.goto(editHash);assert.equal(field('Tytuł').value,'Adam Andrzejewski');
  });
  it('beforeunload ostrzega tylko przy niezapisanych zmianach',async()=>{
    app=await bootApp({hash:editHash});let event=new app.window.Event('beforeunload',{cancelable:true});app.window.dispatchEvent(event);assert.ok(!event.defaultPrevented);
    input(field('Tytuł'),'Zmiana');event=new app.window.Event('beforeunload',{cancelable:true});app.window.dispatchEvent(event);assert.ok(event.defaultPrevented);
  });
  it('udany eksport pobiera JSON, aktualizuje podgląd, a kolejna edycja znów jest niezapisana',async()=>{
    app=await bootApp({hash:editHash});let blob;let download;
    app.window.URL.createObjectURL=(value)=>{blob=value;return 'blob:test';};app.window.URL.revokeObjectURL=()=>{};
    app.window.HTMLAnchorElement.prototype.click=function(){download={name:this.download,href:this.href};};
    input(field('Tytuł'),'Zapisany tytuł');await app.click('[data-action="export"]');
    assert.ok(blob.size>1000);assert.match(app.query('#editor-status').textContent,/Pobrano database.json/);
    assert.deepEqual(download,{name:'database.json',href:'blob:test'});
    const json = await new Promise((resolve,reject)=>{
      const reader = new app.window.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(blob);
    });
    const exported = buildDatabase(JSON.parse(json));
    assert.equal(exported.stats.exerciseCount,70);assert.equal(exported.exerciseById.get('adam-andrzejewski').title,'Zapisany tytuł');
    let confirms=0;app.window.confirm=()=>{confirms++;return false;};await app.goto('#/browse/adam-andrzejewski');
    assert.equal(confirms,0);assert.equal(app.query('.exercise-card__title').textContent,'Zapisany tytuł');
    await app.goto(editHash);input(field('Tytuł'),'Druga zmiana');await app.goto('#/browse');
    assert.equal(confirms,1);assert.equal(field('Tytuł').value,'Druga zmiana');
  });
  it('błąd pobrania pliku pozostawia zmiany niezapisane',async()=>{
    app=await bootApp({hash:editHash});input(field('Tytuł'),'Zmiana');
    app.window.URL.createObjectURL=()=>{throw Error('Zapis niedostępny');};await app.click('[data-action="export"]');
    assert.match(app.query('#editor-errors').textContent,/Zapis niedostępny/);assert.match(app.query('#editor-status').textContent,/Niezapisane/);
  });
  it('odrzucenie zmian wraca do podglądu',async()=>{
    app=await bootApp({hash:editHash});input(field('Tytuł'),'Zmiana');app.window.confirm=()=>true;
    await app.click('[data-action="discard"]');await tick();assert.equal(app.hash(),'#/browse/adam-andrzejewski');
    assert.equal(app.query('.exercise-card__title').textContent,'Adam Andrzejewski');
  });
});
