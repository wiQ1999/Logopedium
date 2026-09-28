import { categoryNameKey, normalizeDatabase, normalizeText, saveDatabase, SaveError, validateExercise } from './data.js';
import { sanitizeHtml } from './html.js';
import { escapeHtml, formatRevision, renderExerciseCard, renderNotice } from './render.js';
import { activeMarks, attachToolbarKeys, renderMarkToolbar, showActiveMarks, toggleMark } from './rich-text.js';

/** Value of the category choice that asks for a new category instead of an existing one. */
export const NEW_CATEGORY = '__nowa__';

/** The editing buffer covers a single exercise; the base itself lives only in the served file. */
export const createDraft = (db, exerciseId) => {
  const exercise = db.raw.exercises.find((e) => e.id === exerciseId);
  return exercise ? structuredClone(exercise) : null;
};

/** Identifier convention of CONTENT: lower case without diacritics, words joined by hyphens. */
export const slugify = (text) => normalizeText(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function uniqueId(base, taken) {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Exercise, variant and item ids share one namespace in the schema, so all of them are taken. */
function takenIds(raw, draft) {
  const ids = new Set();
  const collect = (e) => { ids.add(e.id); e.variants.forEach((v) => { ids.add(v.id); v.items.forEach((i) => ids.add(i.id)); }); };
  raw.exercises.forEach(collect);
  if (draft) collect(draft);
  return ids;
}

const numbered = (format, from, taken) => {
  let n = from;
  while (taken.has(format(n))) n += 1;
  return format(n);
};

export function addItem(db, state, variant) {
  const id = numbered((n) => `${variant.id}-p${String(n).padStart(2, '0')}`, variant.items.length + 1, takenIds(db.raw, state.exercise));
  const item = { id, html: '' };
  variant.items.push(item);
  state.added.push(id);
  return item;
}

/** A new variant starts as a list with one empty item, ready to be typed in. */
export function addVariant(db, state) {
  const { exercise } = state;
  const id = numbered((n) => `${exercise.id}-w${n}`, exercise.variants.length + 1, takenIds(db.raw, exercise));
  const variant = { id, label: null, type: 'items', instructionHtml: null, syllablesHtml: null, textHtml: null, examples: [], items: [] };
  exercise.variants.push(variant);
  state.added.push(id);
  addItem(db, state, variant);
  return variant;
}

/** Only elements created in this draft can be taken back; saved material is never deleted here. */
export function removeAdded(state, id) {
  if (!state.added.includes(id)) return false;
  const { variants } = state.exercise;
  const variantIndex = variants.findIndex((v) => v.id === id);
  if (variantIndex >= 0) {
    const [variant] = variants.splice(variantIndex, 1);
    const gone = new Set([id, ...variant.items.map((i) => i.id)]);
    state.added = state.added.filter((added) => !gone.has(added));
    return true;
  }
  for (const variant of variants) {
    const itemIndex = variant.items.findIndex((i) => i.id === id);
    if (itemIndex >= 0) {
      variant.items.splice(itemIndex, 1);
      state.added = state.added.filter((added) => added !== id);
      return true;
    }
  }
  return false;
}

/**
 * Starts a new exercise that exists only in the editor until it is saved. A new category comes
 * with it: a category without exercises would appear nowhere in the app.
 */
export function createExerciseDraft(db, { title = '', categoryId = '', categoryName = '' }) {
  const issues = [];
  const cleanTitle = title.trim();
  const cleanName = categoryName.trim();
  let newCategory = null;
  if (!cleanTitle) issues.push('Podaj tytuł ćwiczenia.');
  if (categoryId === NEW_CATEGORY) {
    if (!cleanName) issues.push('Podaj nazwę nowej kategorii.');
    else if (db.raw.categories.some((c) => categoryNameKey(c.name) === categoryNameKey(cleanName))) issues.push(`Kategoria „${cleanName}” już istnieje — wybierz ją z listy.`);
    else newCategory = { id: uniqueId(slugify(cleanName) || 'kategoria', new Set(db.raw.categories.map((c) => c.id))), name: cleanName };
  } else if (!db.raw.categories.some((c) => c.id === categoryId)) {
    issues.push('Wybierz kategorię ćwiczenia.');
  }
  if (issues.length) return { issues, state: null };
  const exercise = {
    id: uniqueId(slugify(cleanTitle) || 'cwiczenie', takenIds(db.raw)), title: cleanTitle, categoryId: newCategory?.id ?? categoryId,
    level: null, randomizable: true, readQuality: 'do_weryfikacji', headerHtml: null, contextHtml: null, instructionHtml: null, variants: [],
  };
  const state = { exercise, saved: null, newCategory, added: [] };
  addVariant(db, state);
  return { issues: [], state };
}

/** Categories as the draft sees them: the base's list plus the new category it brings along. */
const draftCategories = (db, newCategory) => newCategory ? [...db.raw.categories, newCategory] : db.raw.categories;

/** Whole-base check before writing: the buffered exercise merged into (or appended to) the loaded base. */
export function prepareSave(db, draft, newCategory = null) {
  const exists = db.raw.exercises.some((e) => e.id === draft.id);
  const exercises = exists ? db.raw.exercises.map((e) => e.id === draft.id ? draft : e) : [...db.raw.exercises, draft];
  const categories = newCategory && draft.categoryId === newCategory.id ? [...db.raw.categories, newCategory] : db.raw.categories;
  return normalizeDatabase({ ...db.raw, categories, exercises });
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
  if (!app.editorDraft) {
    const initial = createDraft(app.db, exerciseId);
    app.editorDraft = initial && { exercise: initial, saved: JSON.stringify([initial, null]), newCategory: null, added: [] };
  }
  const state = app.editorDraft;
  const exercise = state?.exercise;
  const variant = variantId ? exercise?.variants.find((v) => v.id === variantId) : null;
  if (!exercise || (variantId && !variant)) {
    app.editorDraft = null;
    root.innerHTML = renderNotice('Nie znaleziono materiału', 'Wskazane ćwiczenie lub wariant nie istnieje.', 'notice--error');
    return;
  }
  const isNew = state.saved === null;
  const flash = app.editorFlash;
  app.editorFlash = null;
  let bindings = [];
  let savedRange = null;
  let activeEditable = null;
  let saving = false;
  let preview; let errors; let status; let saveButton;
  const categories = () => draftCategories(app.db, state.newCategory);
  const dirty = () => JSON.stringify([exercise, state.newCategory]) !== state.saved;

  const register = (object, key, parse) => { bindings.push({ object, key, parse }); return bindings.length - 1; };
  // Plain fields hold text without markup; only the HTML fields of the schema get the formatting frame.
  const textField = (object, key, label, nullable = false) => {
    const index = register(object, key, (value) => nullable && value === '' ? null : value);
    return `<label class="field">${escapeHtml(label)}<input class="input" type="text" data-field="${index}" value="${escapeHtml(object[key] ?? '')}"></label>`;
  };
  const selectField = (object, key, label, values, parse = (s) => s) => {
    const index = register(object, key, parse);
    const current = String(object[key] ?? '');
    const options = values.some(([value]) => String(value) === current) ? values : [...values, [current, current]];
    return `<label class="field">${escapeHtml(label)}<select class="select" data-field="${index}">${options.map(([value, name]) => `<option value="${escapeHtml(value)}" ${current === String(value) ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>`;
  };
  const removeButton = (id, what) => state.added.includes(id)
    ? `<button class="btn btn--ghost btn--small" type="button" data-action="remove" data-id="${escapeHtml(id)}">Usuń ${what}</button>` : '';
  const richField = (object, key, label, { nullable = true, itemId = null } = {}) => {
    const index = register(object, key, (s) => nullable && s === '' ? null : s);
    const result = sanitizeHtml(object[key]);
    return `<div class="field rich-field"${itemId ? ` data-item="${escapeHtml(itemId)}"` : ''}><div class="field__head"><span class="field__label" id="edit-label-${index}">${escapeHtml(label)}</span>${itemId ? removeButton(itemId, 'pozycję') : ''}</div>
      <div class="rich-editor">${renderMarkToolbar(`edit-rich-${index}`, label)}
      <div class="rich-input content" id="edit-rich-${index}" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="edit-label-${index}" data-rich="${index}" data-marks="full">${result.html}</div></div></div>`;
  };
  const variantFields = (v) => `<details class="disclosure" open data-variant="${escapeHtml(v.id)}"><summary>${escapeHtml(v.label ?? 'Wariant')} — ${escapeHtml(v.id)}</summary><div class="disclosure__body editor-fields">
    ${variant ? '' : removeButton(v.id, 'wariant')}
    ${textField(v, 'label', 'Nazwa wariantu', true)}
    ${selectField(v, 'type', 'Typ wariantu', [['items','Pozycje'],['text','Tekst'],['syllables','Sylaby'],['prompt','Polecenie']])}
    ${richField(v, 'instructionHtml', 'Polecenie wariantu (puste = polecenie ćwiczenia)')}
    ${richField(v, 'syllablesHtml', 'Sylaby')}${richField(v, 'textHtml', 'Tekst')}
    ${v.examples.map((s, i) => richField(v.examples, i, `Przykład ${i + 1}`, { nullable: false })).join('')}
    ${v.items.map((item, i) => richField(item, 'html', `Pozycja ${i + 1} — ${item.id}`, { nullable: false, itemId: item.id })).join('')}
    <div class="btn-row"><button class="btn" type="button" data-action="add-item" data-variant="${escapeHtml(v.id)}">Dodaj pozycję</button></div>
  </div></details>`;
  const exerciseFields = () => `<div class="panel editor-fields">
    <p class="panel__hint">Identyfikator ćwiczenia: ${escapeHtml(exercise.id)}</p>
    ${textField(exercise, 'title', 'Tytuł')}
    ${selectField(exercise, 'categoryId', 'Kategoria', categories().map((c) => [c.id, c === state.newCategory ? `${c.name} (nowa)` : c.name]))}
    ${state.newCategory ? `${textField(state.newCategory, 'name', 'Nazwa nowej kategorii')}<p class="panel__hint">Identyfikator kategorii: ${escapeHtml(state.newCategory.id)}</p>` : ''}
    ${selectField(exercise, 'level', 'Poziom', [['','Nieokreślony'], ...[1,2,3,4].map((n) => [n,String(n)])], (s) => s === '' ? null : Number(s))}
    ${selectField(exercise, 'randomizable', 'Losowanie pozycji', [['true','Dozwolone'],['false','Materiał w całości']], (s) => s === 'true')}
    ${selectField(exercise, 'readQuality', 'Jakość odczytu', [['pewny','Pewny'],['do_weryfikacji','Do weryfikacji']])}
    ${richField(exercise, 'headerHtml', 'Nagłówek')}${richField(exercise, 'contextHtml', 'Materiał wprowadzający')}${richField(exercise, 'instructionHtml', 'Polecenie ćwiczenia')}
    </div>${exercise.variants.map(variantFields).join('')}
    <div class="btn-row"><button class="btn" type="button" data-action="add-variant">Dodaj wariant</button></div>`;

  // Typing re-checks only the edited exercise; the whole base is validated when saving.
  const update = () => {
    const issues = validateExercise({ ...app.db.raw, categories: categories() }, exercise);
    saveButton.disabled = saving || issues.length > 0;
    errors.innerHTML = issues.length ? renderNotice('Popraw dane przed zapisem', 'Ćwiczenie zawiera niezgodności:', 'notice--error', issues) : '';
    if (issues.length) preview.innerHTML = '<p class="notice">Podgląd będzie dostępny po poprawieniu danych.</p>';
    else preview.innerHTML = renderExerciseCard(exercise, exercise.variants.map((v) => ({ variant: v, items: v.items })), {
      categoryName: categories().find((c) => c.id === exercise.categoryId)?.name, markMode: 'full' });
    root.querySelectorAll('[data-action="add-item"]').forEach((button) => {
      button.hidden = exercise.variants.find((v) => v.id === button.dataset.variant)?.type !== 'items';
    });
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
  const toolbarOf = (editable) => editable.closest('.rich-editor').querySelector('[role="toolbar"]');
  const capture = () => {
    const selection = win.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const editable = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('[data-rich]');
    if (editable && root.contains(editable) && editable.contains(range.endContainer)) {
      activeEditable = editable; savedRange = range.cloneRange();
      showActiveMarks(toolbarOf(editable), activeMarks(editable, savedRange));
    }
  };

  const bindRich = (el) => {
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
  };
  const bindToolbar = (frame) => {
    const toolbar = frame.querySelector('[role="toolbar"]');
    const editable = frame.querySelector('[data-rich]');
    attachToolbarKeys(toolbar, editable);
    // Pressing a button must not move the caret out of the text, or the selection would be lost.
    toolbar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) { capture(); e.preventDefault(); } });
    toolbar.addEventListener('click', (e) => {
      const button = e.target.closest('[data-mark]');
      if (!button) return;
      const range = activeEditable === editable ? toggleMark(editable, savedRange, button.dataset.mark) : null;
      if (!range) { status.textContent = 'Zaznacz w tym polu tekst do oznaczenia.'; return; }
      editable.focus(); const selection = win.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      savedRange = range; showActiveMarks(toolbar, activeMarks(editable, range)); readRich(editable);
    });
  };

  const leave = () => !dirty() || win.confirm(isNew
    ? 'Opuścić edytor? Nowe ćwiczenie nie zostało zapisane w pliku i zostanie odrzucone.'
    : 'Opuścić edytor? Zmiany niezapisane do pliku zostaną odrzucone.');

  const save = async () => {
    flush();
    if (saveButton.disabled) return;
    const result = prepareSave(app.db, exercise, state.newCategory);
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
  };

  /**
   * Adding or removing an element changes the form's structure, so the form is drawn again from the draft.
   * `focusSelector` is null for the first drawing, otherwise it names the field to continue in ('' for none).
   */
  const paint = (focusSelector = null) => {
    bindings = [];
    savedRange = null; activeEditable = null;
    const scroll = win.scrollY;
    const heading = isNew ? 'Nowe ćwiczenie' : variant ? 'Edycja wariantu' : 'Edycja ćwiczenia';
    root.innerHTML = `<section class="view-head"><h1>${heading}</h1><p>${escapeHtml(exercise.title)}</p>
      <div class="btn-row"><a class="btn" href="${escapeHtml(backHref)}">${isNew ? 'Wróć do listy' : 'Wróć do podglądu'}</a><button class="btn" type="button" data-action="discard">Odrzuć zmiany</button>
      <button class="btn btn--primary" type="button" data-action="save">Zapisz w pliku bazy</button></div>
      <p class="panel__hint" id="editor-revision">Rewizja bazy: ${escapeHtml(formatRevision(app.db.generated))}</p><p id="editor-status" role="status"></p></section>
      <div id="editor-errors"></div><div class="editor-layout"><div class="editor-fields" id="editor-fields">${variant ? variantFields(variant) : exerciseFields()}</div>
      <section class="editor-preview" aria-label="Podgląd na żywo"><h2>Podgląd na żywo</h2><div id="editor-preview"></div></section></div>`;
    preview = root.querySelector('#editor-preview');
    errors = root.querySelector('#editor-errors');
    status = root.querySelector('#editor-status');
    saveButton = root.querySelector('[data-action="save"]');
    root.querySelectorAll('[data-rich]').forEach(bindRich);
    root.querySelectorAll('.rich-editor').forEach(bindToolbar);
    root.querySelectorAll('[data-field]').forEach((el) => {
      const updateField = () => {
        const binding = bindings[Number(el.dataset.field)]; binding.object[binding.key] = binding.parse(el.value); schedule();
      };
      el.addEventListener('input', updateField); el.addEventListener('change', updateField);
    });
    root.querySelector('[data-action="discard"]').addEventListener('click', () => {
      if (!leave()) return;
      app.beforeLeave = null; app.editorDraft = null; app.navigate(backHref);
    });
    saveButton.addEventListener('click', save);
    update();
    // A redrawn form stays where the user was working and moves the caret to the element just added.
    if (focusSelector === null) return;
    win.scrollTo(0, scroll);
    if (focusSelector) root.querySelector(focusSelector)?.focus();
  };

  const onAction = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || saving || !root.contains(button)) return;
    const { action } = button.dataset;
    if (action === 'add-variant') {
      const added = addVariant(app.db, state);
      paint(`[data-variant="${added.id}"] [data-field]`);
    } else if (action === 'add-item') {
      const target = exercise.variants.find((v) => v.id === button.dataset.variant);
      const added = target && addItem(app.db, state, target);
      if (added) paint(`[data-item="${added.id}"] [data-rich]`);
    } else if (action === 'remove' && removeAdded(state, button.dataset.id)) {
      paint('');
      status.textContent = `Usunięto element dodany w tej edycji. ${dirty() ? 'Niezapisane zmiany.' : 'Brak niezapisanych zmian.'}`;
    }
  };
  root.addEventListener('click', onAction);
  doc.addEventListener('selectionchange', capture);
  app.beforeLeave = () => {
    if (!leave()) return false;
    app.editorDraft = null;
    return true;
  };
  const beforeUnload = (event) => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } };
  win.addEventListener('beforeunload', beforeUnload);
  paint();
  return () => {
    win.clearTimeout(pending);
    root.removeEventListener('click', onAction);
    doc.removeEventListener('selectionchange', capture);
    win.removeEventListener('beforeunload', beforeUnload);
    app.beforeLeave = null;
  };
}
