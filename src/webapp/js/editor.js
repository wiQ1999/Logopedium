import { normalizeDatabase, saveDatabase, SaveError, validateExercise } from './data.js';
import { MARKS, sanitizeHtml } from './html.js';
import { escapeHtml, formatRevision, renderExerciseCard, renderNotice } from './render.js';

/** The editing buffer covers a single exercise; the base itself lives only in the served file. */
export const createDraft = (db, exerciseId) => {
  const exercise = db.raw.exercises.find((e) => e.id === exerciseId);
  return exercise ? structuredClone(exercise) : null;
};

/** Whole-base check before writing: the buffered exercise merged into the loaded base. */
export function prepareSave(db, draft) {
  const raw = { ...db.raw, exercises: db.raw.exercises.map((e) => e.id === draft.id ? draft : e) };
  return normalizeDatabase(raw);
}

export function applyMark(editable, range, mark) {
  if (!Object.hasOwn(MARKS, mark) || !range || range.collapsed ||
      !editable.contains(range.startContainer) || !editable.contains(range.endContainer)) return null;
  const doc = editable.ownerDocument;
  const walker = doc.createTreeWalker(editable, 4 /* SHOW_TEXT */);
  const portions = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!range.intersectsNode(node)) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end > start) portions.push({ node, start, end });
  }
  const spans = portions.map(({ node, start, end }) => {
    if (end < node.length) node.splitText(end);
    const middle = start ? node.splitText(start) : node;
    const span = doc.createElement('span');
    span.className = mark;
    middle.replaceWith(span); span.append(middle);
    return span;
  });
  if (!spans.length) return null;
  const next = doc.createRange();
  next.setStart(spans[0].firstChild, 0);
  next.setEnd(spans.at(-1).firstChild, spans.at(-1).textContent.length);
  return next;
}

/** Idle time after the last keystroke before the exercise is re-checked and the preview redrawn. */
export const EDIT_SETTLE_MS = 150;

export function mountEditor(root, app, exerciseId, variantId, backHref) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!app.db.writable) {
    root.innerHTML = `${renderNotice('Edycja niedostępna', 'Zapis bazy wymaga lokalnego serwera projektu (npm start) otwartego na tym komputerze. Tutaj ćwiczenia można tylko przeglądać.')}
      <a class="btn" href="${escapeHtml(backHref)}">Wróć do podglądu</a>`;
    return;
  }
  if (app.editorDraft?.exercise.id !== exerciseId) app.editorDraft = null;
  const initial = app.editorDraft ? null : createDraft(app.db, exerciseId);
  const state = app.editorDraft ??= initial && { exercise: initial, saved: JSON.stringify(initial) };
  const exercise = state?.exercise;
  const variant = variantId ? exercise?.variants.find((v) => v.id === variantId) : null;
  if (!exercise || (variantId && !variant)) {
    app.editorDraft = null;
    root.innerHTML = renderNotice('Nie znaleziono materiału', 'Wskazane ćwiczenie lub wariant nie istnieje.', 'notice--error');
    return;
  }
  const categories = app.db.raw.categories;
  const flash = app.editorFlash;
  app.editorFlash = null;
  const bindings = [];
  let savedRange = null;
  let activeEditable = null;
  const register = (object, key, parse) => { bindings.push({ object, key, parse }); return bindings.length - 1; };
  const textField = (object, key, label, kind = 'text', nullable = false) => {
    const index = register(object, key, (value) => kind === 'array' ? value.split('\n').map((s) => s.trim()).filter(Boolean) : nullable && value === '' ? null : value);
    const value = kind === 'array' ? object[key].join('\n') : object[key] ?? '';
    return `<label class="field">${escapeHtml(label)}<textarea class="input" data-field="${index}" rows="${kind === 'array' ? 3 : 1}">${escapeHtml(value)}</textarea></label>`;
  };
  const selectField = (object, key, label, values, parse = (s) => s) => {
    const index = register(object, key, parse);
    return `<label class="field">${escapeHtml(label)}<select class="select" data-field="${index}">${values.map(([value, name]) => `<option value="${escapeHtml(value)}" ${String(object[key] ?? '') === String(value) ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>`;
  };
  const richField = (object, key, label, nullable = true) => {
    const index = register(object, key, (s) => nullable && s === '' ? null : s);
    const result = sanitizeHtml(object[key]);
    return `<div class="field rich-field"><span class="field__label" id="edit-label-${index}">${escapeHtml(label)}</span>
      <div class="input rich-input content" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="edit-label-${index}" data-rich="${index}" data-marks="full">${result.html}</div></div>`;
  };
  const variantFields = (v) => `<details class="disclosure" open><summary>${escapeHtml(v.label ?? 'Wariant')} — ${escapeHtml(v.id)}</summary><div class="disclosure__body editor-fields">
    ${textField(v, 'label', 'Nazwa wariantu', 'text', true)}
    ${selectField(v, 'type', 'Typ wariantu', [['items','Pozycje'],['text','Tekst'],['syllables','Sylaby'],['prompt','Polecenie']])}
    ${richField(v, 'instructionHtml', 'Polecenie wariantu (puste = polecenie ćwiczenia)')}
    ${richField(v, 'syllablesHtml', 'Sylaby')}${richField(v, 'textHtml', 'Tekst')}
    ${v.examples.map((s, i) => richField(v.examples, i, `Przykład ${i + 1}`, false)).join('')}
    ${v.items.map((item, i) => richField(item, 'html', `Pozycja ${i + 1} — ${item.id}`, false)).join('')}
  </div></details>`;
  const fields = variant ? variantFields(variant) : `<div class="panel editor-fields">
    <p class="panel__hint">Identyfikator ćwiczenia: ${escapeHtml(exercise.id)}</p>
    ${textField(exercise, 'title', 'Tytuł')}
    ${selectField(exercise, 'categoryId', 'Kategoria', categories.map((c) => [c.id,c.name]))}
    ${selectField(exercise, 'level', 'Poziom', [['','Nieokreślony'], ...[1,2,3,4].map((n) => [n,String(n)])], (s) => s === '' ? null : Number(s))}
    ${selectField(exercise, 'randomizable', 'Losowanie pozycji', [['true','Dozwolone'],['false','Materiał w całości']], (s) => s === 'true')}
    ${textField(exercise, 'readQuality', 'Jakość odczytu')}
    ${richField(exercise, 'headerHtml', 'Nagłówek')}${richField(exercise, 'contextHtml', 'Materiał wprowadzający')}${richField(exercise, 'instructionHtml', 'Polecenie ćwiczenia')}
    </div>${exercise.variants.map(variantFields).join('')}`;
  root.innerHTML = `<section class="view-head"><h1>${variant ? 'Edycja wariantu' : 'Edycja ćwiczenia'}</h1><p>${escapeHtml(exercise.title)}</p>
    <div class="btn-row"><a class="btn" href="${escapeHtml(backHref)}">Wróć do podglądu</a><button class="btn" type="button" data-action="discard">Odrzuć zmiany</button>
    <button class="btn btn--primary" type="button" data-action="save">Zapisz w pliku bazy</button></div>
    <p class="panel__hint" id="editor-revision">Rewizja bazy: ${escapeHtml(formatRevision(app.db.generated))}</p><p id="editor-status" role="status"></p></section>
    <div class="editor-toolbar" role="group" aria-label="Formatowanie zaznaczonego tekstu">${Object.entries(MARKS).map(([key,label]) => `<button class="btn" type="button" data-mark="${key}">${label}</button>`).join('')}</div>
    <div id="editor-errors"></div><div class="editor-layout"><div class="editor-fields" id="editor-fields">${fields}</div>
    <section class="editor-preview" aria-label="Podgląd na żywo"><h2>Podgląd na żywo</h2><div id="editor-preview"></div></section></div>`;
  const preview = root.querySelector('#editor-preview');
  const errors = root.querySelector('#editor-errors');
  const status = root.querySelector('#editor-status');
  const saveButton = root.querySelector('[data-action="save"]');
  let saving = false;
  const dirty = () => JSON.stringify(exercise) !== state.saved;
  // Typing re-checks only the edited exercise; the whole base is validated when saving.
  const update = () => {
    const issues = validateExercise(app.db.raw, exercise);
    saveButton.disabled = saving || issues.length > 0;
    errors.innerHTML = issues.length ? renderNotice('Popraw dane przed zapisem', 'Ćwiczenie zawiera niezgodności:', 'notice--error', issues) : '';
    if (issues.length) preview.innerHTML = '<p class="notice">Podgląd będzie dostępny po poprawieniu danych.</p>';
    else preview.innerHTML = renderExerciseCard(exercise, exercise.variants.map((v) => ({ variant: v, items: v.items })), {
      categoryName: categories.find((c) => c.id === exercise.categoryId)?.name, markMode: 'full' });
    if (!saving) status.textContent = dirty() ? 'Niezapisane zmiany.' : flash ?? 'Brak niezapisanych zmian.';
  };
  // Checking and previewing wait for a pause in typing, so keystrokes never queue behind them.
  let pending = null;
  const flush = () => { win.clearTimeout(pending); pending = null; update(); };
  const schedule = () => {
    if (!saving) status.textContent = 'Niezapisane zmiany.';
    win.clearTimeout(pending);
    pending = win.setTimeout(flush, EDIT_SETTLE_MS);
  };
  const readRich = (el) => {
    const binding = bindings[Number(el.dataset.rich)];
    const result = sanitizeHtml(el.innerHTML);
    binding.object[binding.key] = binding.parse(result.issues.length ? el.innerHTML : result.html);
    schedule();
  };
  const capture = () => {
    const selection = win.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const editable = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('[data-rich]');
    if (editable && root.contains(editable) && editable.contains(range.endContainer)) {
      activeEditable = editable; savedRange = range.cloneRange();
    }
  };
  doc.addEventListener('selectionchange', capture);
  root.querySelectorAll('[data-rich]').forEach((el) => {
    el.addEventListener('input', () => { capture(); readRich(el); });
    el.addEventListener('keyup', capture);
    el.addEventListener('mouseup', capture);
    const insertText = (text, lineBreak = false) => {
      capture();
      if (!savedRange || activeEditable !== el) {
        savedRange = doc.createRange(); savedRange.selectNodeContents(el); savedRange.collapse(false); activeEditable = el;
      }
      savedRange.deleteContents();
      const fragment = doc.createDocumentFragment();
      if (lineBreak) fragment.append(doc.createElement('br'));
      else text.split(/\r\n|\r|\n/).forEach((line, i) => {
        if (i) fragment.append(doc.createElement('br'));
        fragment.append(doc.createTextNode(line));
      });
      const last = fragment.lastChild;
      savedRange.insertNode(fragment);
      // A trailing BR needs a second, visual placeholder for the browser to place the caret after it.
      if (last.nodeName === 'BR' && !last.nextSibling?.textContent && last.nextSibling?.nodeName !== 'BR') last.after(doc.createElement('br'));
      savedRange.setStartAfter(last); savedRange.collapse(true);
      const selection = win.getSelection(); selection.removeAllRanges(); selection.addRange(savedRange);
      readRich(el);
    };
    el.addEventListener('paste', (e) => { e.preventDefault(); insertText(e.clipboardData?.getData('text/plain') ?? ''); });
    el.addEventListener('drop', (e) => { e.preventDefault(); insertText(e.dataTransfer?.getData('text/plain') ?? ''); });
    el.addEventListener('beforeinput', (e) => {
      if (['insertParagraph', 'insertLineBreak'].includes(e.inputType)) { e.preventDefault(); insertText('', true); }
      if (e.inputType?.startsWith('format')) e.preventDefault();
    });
  });
  root.querySelectorAll('[data-field]').forEach((el) => {
    const updateField = () => {
      const binding = bindings[Number(el.dataset.field)]; binding.object[binding.key] = binding.parse(el.value); schedule();
    };
    el.addEventListener('input', updateField); el.addEventListener('change', updateField);
  });
  root.querySelector('.editor-toolbar').addEventListener('mousedown', (e) => { if (e.target.closest('button')) { capture(); e.preventDefault(); } });
  root.querySelector('.editor-toolbar').addEventListener('click', (e) => {
    const button = e.target.closest('[data-mark]');
    if (!button || !activeEditable) return;
    const range = applyMark(activeEditable, savedRange, button.dataset.mark);
    if (!range) { status.textContent = 'Zaznacz tekst do sformatowania.'; return; }
    activeEditable.focus(); const selection = win.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    savedRange = range; readRich(activeEditable);
  });
  const leave = () => !dirty() || win.confirm('Opuścić edytor? Zmiany niezapisane do pliku zostaną odrzucone.');
  app.beforeLeave = () => {
    if (!leave()) return false;
    app.editorDraft = null;
    return true;
  };
  const beforeUnload = (event) => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } };
  win.addEventListener('beforeunload', beforeUnload);
  root.querySelector('[data-action="discard"]').addEventListener('click', () => {
    if (!leave()) return;
    app.beforeLeave = null; app.editorDraft = null; app.navigate(backHref);
  });
  saveButton.addEventListener('click', async () => {
    flush();
    if (saveButton.disabled) return;
    const result = prepareSave(app.db, exercise);
    if (result.issues.length) {
      errors.innerHTML = renderNotice('Baza nie została zapisana', 'Baza zawiera niezgodności:', 'notice--error', result.issues);
      return;
    }
    const previous = app.db.generated;
    const form = root.querySelector('#editor-fields');
    saving = true; saveButton.disabled = true; form.inert = true; status.textContent = 'Zapisywanie…';
    try {
      await saveDatabase(result.raw, previous);
      await app.reloadDatabase();
    } catch (error) {
      saving = false; form.inert = false; update();
      const issues = error instanceof SaveError ? error.issues : [];
      errors.innerHTML = renderNotice('Nie udało się zapisać bazy', error.message, 'notice--error', issues);
      status.textContent = 'Niezapisane zmiany.';
      return;
    }
    // The form is rebuilt from the base re-read from the file, so it shows exactly what was saved.
    app.editorDraft = null; app.beforeLeave = null;
    app.editorFlash = `Zapisano w pliku bazy. Rewizja zmieniona z ${formatRevision(previous)} na ${formatRevision(app.db.generated)}.`;
    app.navigate(win.location.hash);
  });
  update();
  return () => { win.clearTimeout(pending); doc.removeEventListener('selectionchange', capture); win.removeEventListener('beforeunload', beforeUnload); app.beforeLeave = null; };
}
