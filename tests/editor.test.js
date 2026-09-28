import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { JSDOM } from 'jsdom';
import { applyMark, createDraft, EDIT_SETTLE_MS, mountEditor, prepareSave } from '../src/webapp/js/editor.js';
import { MARKS, sanitizeHtml, visitHtml } from '../src/webapp/js/html.js';
import { buildDatabase, validateDatabase, validateExercise } from '../src/webapp/js/data.js';
import { loadDatabaseFixture } from './helpers.js';
import { bootApp, devServer, tick } from './dom-helpers.js';

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
    const draft=structuredClone(db.raw); let count=0;
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

describe('zapis kompletnej bazy',()=>{
  it('otwiera wszystkie 70 ćwiczeń bez zmiany danych i z aktywnym zapisem',()=>{
    const dom = new JSDOM('<main></main>'); const root = dom.window.document.querySelector('main');
    for (const exercise of db.exercises) {
      const state = { db: { ...db, writable: true } };
      const cleanup = mountEditor(root, state, exercise.id, null, '#/browse');
      assert.ok(!root.querySelector('[data-action="save"]').disabled, exercise.id);
      assert.equal(root.querySelectorAll('#editor-fields details').length, exercise.variants.length);
      assert.deepEqual(state.editorDraft.exercise, exercise.raw);
      cleanup();
    }
    dom.window.close();
  });
  it('bufor obejmuje jedno ćwiczenie, a nie kopię całej bazy',()=>{
    const draft=createDraft(db,'adam-andrzejewski');
    assert.equal(draft.id,'adam-andrzejewski');assert.ok(Array.isArray(draft.variants));assert.equal(draft.exercises,undefined);
    draft.title='Zmiana';assert.notEqual(db.raw.exercises.find(e=>e.id==='adam-andrzejewski').title,'Zmiana');
    assert.equal(createDraft(db,'brak'),null);
  });
  it('składa bazę z bufora, zachowuje identyfikatory i nieznane metadane',()=>{
    const source={raw:{...db.raw,extra:{preserved:true}}};
    const draft=createDraft(db,db.raw.exercises[0].id);draft.title='Poprawiony tytuł';
    const result=prepareSave(source,draft);
    assert.deepEqual(result.issues,[]);assert.equal(result.raw.exercises[0].title,'Poprawiony tytuł');
    assert.notEqual(db.raw.exercises[0].title,'Poprawiony tytuł');
    assert.deepEqual(result.raw.extra,{preserved:true});
    assert.deepEqual(result.raw.exercises.map(e=>e.id),db.raw.exercises.map(e=>e.id));
    assert.equal(buildDatabase(result.raw).stats.exerciseCount,70);
  });
  it('zapis sprawdza całą bazę, także ćwiczenia spoza bufora',()=>{
    const raw=structuredClone(db.raw);raw.exercises.at(-1).variants[0].instructionHtml='<script>bad()</script>';
    const draft=createDraft(db,raw.exercises[0].id);
    assert.deepEqual(validateExercise(raw,draft),[]);
    assert.ok(prepareSave({raw},draft).issues.some(s=>s.includes('HTML')));
    const duplicate=createDraft(db,raw.exercises[0].id);duplicate.variants[0].id=raw.exercises[1].variants[0].id;
    assert.deepEqual(validateExercise(db.raw,duplicate),[]);
    assert.ok(prepareSave(db,duplicate).issues.some(s=>s.includes('powtarza')));
  });
  it('nie zapisuje niekompletnej bazy',()=>{
    const draft=createDraft(db,db.raw.exercises[0].id);draft.title='';
    assert.equal(prepareSave(db,draft).raw,null);
    assert.ok(validateExercise(db.raw,draft).some(s=>s.startsWith('title')));
  });
  it('puste znaczniki nie zastępują wymaganej treści',()=>{
    const text=createDraft(db,db.raw.exercises.find(e=>e.variants.some(v=>v.type==='text')).id);
    text.variants.find(v=>v.type==='text').textHtml='<p><span class="target"></span><br>&nbsp;</p>';
    assert.equal(prepareSave(db,text).raw,null);
    assert.ok(validateExercise(db.raw,text).some(s=>s.includes('wymaga treści')));
    const other=createDraft(db,db.raw.exercises.find(e=>e.variants.some(v=>v.items.length)).id);
    other.variants.find(v=>v.items.length).items[0].html='';
    assert.equal(prepareSave(db,other).raw,null);
  });
  it('sprawdzenie przy pisaniu kosztuje ułamek walidacji całej bazy także w najdłuższym ćwiczeniu',()=>{
    const longest=[...db.raw.exercises].sort((a,b)=>JSON.stringify(b).length-JSON.stringify(a).length)[0];
    const time=(fn)=>{fn();const start=performance.now();for(let i=0;i<10;i++)fn();return performance.now()-start;};
    const one=time(()=>validateExercise(db.raw,longest));const all=time(()=>validateDatabase(db.raw));
    assert.ok(one*4<all,`ćwiczenie ${one.toFixed(1)} ms, baza ${all.toFixed(1)} ms`);
  });
});

const editHash='#/browse/adam-andrzejewski?edit=1';
const input=(el,value)=>{el.value=value;el.dispatchEvent(new app.window.Event('input',{bubbles:true}));};
const richInput=(el,html)=>{el.innerHTML=html;el.dispatchEvent(new app.window.Event('input',{bubbles:true}));};
const settle=()=>new Promise(resolve=>setTimeout(resolve,EDIT_SETTLE_MS+30));
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
    assert.match(app.query('#editor-status').textContent,/Niezapisane/);await settle();
    assert.equal(app.query('#editor-preview .exercise-card__title').textContent,'Nowy tytuł');
    const rich=app.query('[data-rich]');richInput(rich,'<p>Treść <span class="target">sz</span></p>');await settle();
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
    assert.equal(selection.toString(),'bc');await settle();assert.match(app.query('#editor-preview').innerHTML,/class="legato">bc/);
  });
  it('wklejenie HTML trafia do pola jako tekst, bez wykonania kodu',async()=>{
    app=await bootApp({hash:editHash});const rich=app.query('[data-rich]');richInput(rich,'');
    const event=new app.window.Event('paste',{bubbles:true,cancelable:true});
    Object.defineProperty(event,'clipboardData',{value:{getData:()=>'<img src=x onerror=alert(1)>'}});rich.dispatchEvent(event);
    assert.equal(rich.querySelector('img'),null);assert.equal(rich.textContent,'<img src=x onerror=alert(1)>');
    assert.ok(!app.query('[data-action="save"]').disabled);
  });
  it('niepoprawne dane blokują podgląd i eksport, poprawienie je odblokowuje',async()=>{
    app=await bootApp({hash:editHash});const title=field('Tytuł');input(title,'');await settle();
    assert.ok(app.query('[data-action="save"]').disabled);assert.ok(app.query('#editor-errors [role="alert"]'));
    input(title,'Tytuł');await settle();assert.ok(!app.query('[data-action="save"]').disabled);
    richInput(app.query('[data-rich]'),'<img src=x onerror="alert(1)">');await settle();
    assert.ok(app.query('[data-action="save"]').disabled);assert.equal(app.query('#editor-preview img'),null);
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
    assert.ok(!app.query('[data-action="save"]').disabled);
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
  it('zapis trafia wprost do pliku bazy, a wszystkie widoki pokazują nową rewizję',async()=>{
    app=await bootApp({hash:editHash});const before=app.server.raw.generated;
    const footer=app.query('[data-revision]').textContent;
    input(field('Tytuł'),'Tytuł kwarcowy');await app.click('[data-action="save"]');await tick();
    assert.equal(app.server.saves.length,1);assert.equal(app.server.saves[0].status,'accepted');
    assert.equal(app.server.raw.exercises.find(e=>e.id==='adam-andrzejewski').title,'Tytuł kwarcowy');
    assert.ok(app.server.raw.generated>before);assert.equal(app.server.reads,2);
    assert.match(app.query('#editor-status').textContent,/Zapisano w pliku bazy\. Rewizja zmieniona z .+ na .+\./);
    assert.notEqual(app.query('[data-revision]').textContent,footer);
    assert.equal(app.query('[data-revision]').getAttribute('datetime'),app.server.raw.generated);
    assert.equal(field('Tytuł').value,'Tytuł kwarcowy');
    let confirms=0;app.window.confirm=()=>{confirms++;return false;};await app.goto('#/browse/adam-andrzejewski');
    assert.equal(confirms,0);assert.equal(app.query('.exercise-card__title').textContent,'Tytuł kwarcowy');
    await app.goto('#/browse?q=kwarcowy');assert.match(app.text(),/Znaleziono 1 ćwiczenie/);
    await app.goto(editHash);input(field('Tytuł'),'Druga zmiana');await app.goto('#/browse');
    assert.equal(confirms,1);assert.equal(field('Tytuł').value,'Druga zmiana');
  });
  it('po zapisie sesja losuje z bazy odczytanej z pliku',async()=>{
    app=await bootApp();await app.click('#params-submit');const oldSession=app.hash();
    await app.goto(editHash);input(field('Tytuł'),'Tytuł po zapisie');await app.click('[data-action="save"]');await tick();
    await app.goto('#/params');await app.click('#params-submit');
    const titles=[];
    for(let step=1;step<=70;step++){await app.goto(app.hash().replace(/session\/\d+/,`session/${step}`));titles.push(app.query('.exercise-card__title').textContent);}
    assert.ok(titles.includes('Tytuł po zapisie'));assert.ok(!titles.includes('Adam Andrzejewski'));
    await app.goto(oldSession);assert.match(app.hash(),/^#\/session\/1\?s=/);assert.ok(app.query('.exercise-card__title'));
  });
  it('zmiana kategorii ćwiczenia w edycji nie psuje startu sesji ułożonej wcześniej',async()=>{
    app=await bootApp();await app.click('#params-submit');
    await app.goto(editHash);
    const select=field('Kategoria');select.value='samogloski';select.dispatchEvent(new app.window.Event('change',{bubbles:true}));
    await app.click('[data-action="save"]');await tick();
    await app.goto('#/params');
    assert.ok(app.query('[data-block="samogloski"] [data-exercise="adam-andrzejewski"]'));
    assert.equal(app.queryAll('[data-exercise="adam-andrzejewski"]').length,1);
    await app.click('#params-submit');assert.match(app.hash(),/^#\/session\/1\?s=/);assert.ok(app.query('.exercise-card__title'));
  });
  it('pisanie nie czeka na sprawdzanie; błąd wpisany tuż przed zapisem i tak go wstrzymuje',async()=>{
    app=await bootApp({hash:editHash});const preview=app.query('#editor-preview').innerHTML;
    input(field('Tytuł'),'Tytuł w trakcie pisania');
    assert.equal(app.query('#editor-preview').innerHTML,preview);assert.match(app.query('#editor-status').textContent,/Niezapisane/);
    await settle();assert.match(app.query('#editor-preview').innerHTML,/Tytuł w trakcie pisania/);
    input(field('Tytuł'),'');await app.click('[data-action="save"]');
    assert.equal(app.server.saves.length,0);assert.ok(app.query('[data-action="save"]').disabled);
    assert.ok(app.query('#editor-errors [role="alert"]'));
  });
  it('konflikt rewizji zostawia plik bez zmian i zachowuje edycję',async()=>{
    app=await bootApp({hash:editHash});app.server.raw={...app.server.raw,generated:'2030-01-01T00:00:00.000Z'};
    const before=app.server.raw;input(field('Tytuł'),'Zmiana');await app.click('[data-action="save"]');await tick();
    assert.equal(app.server.raw,before);assert.equal(app.server.saves[0].status,'conflict');
    assert.match(app.query('#editor-errors').textContent,/zmienił się od chwili wczytania/);
    assert.match(app.query('#editor-status').textContent,/Niezapisane/);assert.equal(field('Tytuł').value,'Zmiana');
    assert.ok(!app.query('[data-action="save"]').disabled);
  });
  it('odmowa serwera i brak połączenia pozostawiają zmiany niezapisane',async()=>{
    app=await bootApp({hash:editHash,response:devServer(undefined,{fail:()=>{throw new TypeError('fetch failed');}})});
    input(field('Tytuł'),'Zmiana');await app.click('[data-action="save"]');await tick();
    assert.match(app.query('#editor-errors').textContent,/Serwer nie odpowiedział/);assert.match(app.query('#editor-status').textContent,/Niezapisane/);
    app.teardown();
    app=await bootApp({hash:editHash,response:devServer(undefined,{fail:()=>({ok:false,status:400,json:async()=>({issues:['title: oczekiwano niepustego tekstu.']})})})});
    input(field('Tytuł'),'Zmiana');await app.click('[data-action="save"]');await tick();
    assert.match(app.query('#editor-errors').textContent,/Serwer odrzucił bazę[\s\S]*title: oczekiwano/);
  });
  it('bez serwera z obsługą zapisu edycja jest wyłączona',async()=>{
    app=await bootApp({hash:'#/browse/adam-andrzejewski',response:devServer(undefined,{writable:false})});
    assert.equal(app.queryAll('a').filter(a=>/Edytuj/.test(a.textContent)).length,0);
    await app.goto(editHash);assert.match(app.text(),/Edycja niedostępna/);assert.equal(app.query('[data-action="save"]'),null);
  });
  it('odrzucenie zmian wraca do podglądu',async()=>{
    app=await bootApp({hash:editHash});input(field('Tytuł'),'Zmiana');app.window.confirm=()=>true;
    await app.click('[data-action="discard"]');await tick();assert.equal(app.hash(),'#/browse/adam-andrzejewski');
    assert.equal(app.query('.exercise-card__title').textContent,'Adam Andrzejewski');
  });
});
