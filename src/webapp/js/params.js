import { escapeHtml, formatCount, renderMarksLegend } from './render.js';
import { randomToken } from './rng.js';
import { activeSelections, blockEntry, blockExercises, createDefaultParams, forgetParams, itemBounds,
  storeParams, totalExercises, variantBounds, withBlockActive, withBlockCount, withDate,
  withExerciseActive, withItemLimit, withLevel, withMovedBlock, withMovedExercise, withPick, withVariantLimit } from './blocks.js';
export * from './blocks.js';

const options = (pick) => ['kolejnosc', 'losowo'].map((p) => `<option value="${p}" ${p === pick ? 'selected' : ''}>${p === 'kolejnosc' ? 'kolejność' : 'losowo'}</option>`).join('');
const handle = (label, kind, id) => `<button type="button" class="btn drag-handle" draggable="true" data-drag="${kind}" data-id="${escapeHtml(id)}" aria-describedby="drag-help" aria-pressed="false" aria-label="Przenieś: ${escapeHtml(label)}">⠿</button>`;

function numberField(key, role, name, value, bounds, disabled) {
  const suffix = { count: 'count', 'variant-limit': 'variants', 'item-limit': 'items' }[role];
  const id = `param-${suffix}-${escapeHtml(key)}`;
  return `<span class="params-row__field"><label class="params-row__field-label" for="${id}">${name}
    <span data-role="${role}-range">${bounds.min}–${bounds.max}</span></label>
    <input class="input params-row__num" id="${id}" type="number" data-role="${role}" min="${bounds.min}" max="${bounds.max}" value="${value}" ${disabled ? 'disabled' : ''}></span>`;
}

function renderBlock(db, b, level, expanded) {
  const category = db.categoryById.get(b.id);
  const limit = blockExercises(db, b, level).length;
  const variants = variantBounds(db, b, level);
  const items = itemBounds(db, b, level, b.variantLimit);
  return `<li class="params-block" data-block="${escapeHtml(b.key)}">
    <div class="params-row" data-category="${escapeHtml(b.id)}" data-active="${b.count > 0}">
      ${handle(category.name, 'block', b.key)}
      <input type="checkbox" data-role="toggle" aria-label="Blok w sesji: ${escapeHtml(category.name)}" ${b.count ? 'checked' : ''} ${!limit ? 'disabled' : ''}>
      <button class="btn btn--ghost params-row__name" type="button" data-role="expand" aria-expanded="${expanded}" aria-controls="exercises-${escapeHtml(b.key)}">${escapeHtml(category.name)}
        <span class="params-row__meta">dostępnych: ${limit}</span></button>
      <span class="params-row__numbers">
        ${numberField(b.key, 'count', 'ćwiczeń', b.count, { min: 0, max: limit }, !limit)}
        ${variants.max > 1 ? numberField(b.key, 'variant-limit', 'wariantów', b.variantLimit, variants, !limit) : ''}
        ${items.max > 0 ? numberField(b.key, 'item-limit', 'pozycji', b.itemLimit, items, !limit) : ''}
        <span class="params-row__field"><label class="params-row__field-label" for="pick-${escapeHtml(b.key)}">Dobór</label>
        <select class="select" id="pick-${escapeHtml(b.key)}" data-role="pick">${options(b.pick)}</select></span>
      </span>
    </div>
    <div id="exercises-${escapeHtml(b.key)}" ${expanded ? '' : 'hidden'}>
      <ol class="exercise-rows">${b.exercises.map((e) => `<li class="exercise-row" data-exercise="${escapeHtml(e.id)}">
        ${handle(db.exerciseById.get(e.id).title, 'exercise', e.id)}
        <label><input type="checkbox" data-role="exercise-active" ${e.active ? 'checked' : ''}> ${escapeHtml(db.exerciseById.get(e.id).title)}</label>
      </li>`).join('')}</ol>
      <div class="split-target" data-split="true">Upuść tutaj ćwiczenie, aby utworzyć nowy blok</div>
    </div>
  </li>`;
}

function summary(params) {
  const total = totalExercises(params);
  return total ? `${formatCount(total, ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'])} z ${formatCount(activeSelections(params).length, ['bloku', 'bloków', 'bloków'])}`
    : 'Brak wybranych ćwiczeń — ustaw liczbę większą od zera przynajmniej w jednym bloku.';
}

export function mount(root, app) {
  const expanded = new Set();
  let dragging = null;
  let beforeDrag = null;
  root.innerHTML = `<section class="view-head"><h1>Parametry sesji</h1>
    <p class="view-head__lead">Ustaw materiał i kolejność bloków. Rozwiń blok, aby wybrać lub przenieść ćwiczenia.</p></section>
    <form id="params-form"><div class="panel field-grid">
      <label class="field" for="param-date">Data sesji<input class="input" type="date" id="param-date" required value="${escapeHtml(app.params.date)}"></label>
      <label class="field" for="param-level">Poziom trudności<select class="select" id="param-level">${[1,2,3,4].map((l) => `<option value="${l}" ${l === app.params.level ? 'selected' : ''}>Poziom ${l} i niższe</option>`).join('')}</select></label>
    </div><div class="panel"><h2>Bloki ćwiczeń</h2>
      <p id="drag-help" class="panel__hint">Przeciągnij uchwyt, aby zmienić kolejność. Klawiatura: spacja — przejęcie i upuszczenie, strzałki góra/dół — kolejność, lewo — nowy blok, prawo — następny blok tej kategorii, Escape — wycofanie.</p>
      <p id="drag-status" role="status" aria-live="polite"></p><ol class="params-list" id="params-list"></ol></div>
      <details class="disclosure"><summary>Ziarno losowania</summary><div class="disclosure__body">
        <label class="field" for="param-seed">Własne ziarno (opcjonalne)<input class="input" id="param-seed" value="${escapeHtml(app.seedOverride ?? '')}"></label>
        <div class="btn-row"><button class="btn" type="button" data-role="seed-random">Wylosuj nowe ziarno</button><button class="btn" type="button" data-role="seed-clear">Wyczyść</button></div>
      </div></details>
      <details class="disclosure"><summary>Oznaczenia w treści ćwiczeń</summary><div class="disclosure__body">${renderMarksLegend()}</div></details>
      <div class="params-summary"><span id="params-total"></span><div class="btn-row"><button class="btn" type="button" data-role="reset">Przywróć domyślne</button><button class="btn btn--primary" id="params-submit" type="submit">Rozpocznij sesję</button></div></div>
    </form>`;
  const list = root.querySelector('#params-list');
  const status = root.querySelector('#drag-status');
  const totals = () => {
    root.querySelector('#params-total').textContent = summary(app.params);
    root.querySelector('#params-submit').disabled = totalExercises(app.params) === 0;
  };
  const refresh = (focusId, role) => {
    list.innerHTML = app.params.blocks.map((b) => renderBlock(app.db, b, app.params.level, expanded.has(b.key))).join('');
    totals();
    if (focusId) [...list.querySelectorAll(role ? `[data-role="${role}"]` : '[data-drag]')]
      .find((el) => role ? el.closest('[data-block]').dataset.block === focusId : el.dataset.id === focusId)?.focus();
    if (dragging) [...list.querySelectorAll('[data-drag]')].find((el) => el.dataset.id === dragging.id)?.setAttribute('aria-pressed', 'true');
  };
  refresh();
  const announce = (message) => { status.textContent = message; };
  const grab = (button) => {
    beforeDrag = app.params;
    dragging = { kind: button.dataset.drag, id: button.dataset.id, key: button.closest('[data-block]').dataset.block };
    button.setAttribute('aria-pressed', 'true');
    announce(`Przejęto wiersz: ${button.getAttribute('aria-label').replace('Przenieś: ', '')}.`);
  };
  const finish = (cancel = false) => {
    if (!dragging) return;
    const id = dragging.id;
    if (cancel) app.params = beforeDrag;
    dragging = null;
    beforeDrag = null;
    refresh(id);
    announce(cancel ? 'Wycofano przenoszenie.' : 'Upuszczono wiersz.');
  };
  const moved = () => {
    if (dragging.kind === 'exercise') {
      dragging.key = app.params.blocks.find((b) => b.exercises.some((e) => e.id === dragging.id)).key;
      expanded.add(dragging.key);
    }
    refresh(dragging.id);
    const b = blockEntry(app.params, dragging.key);
    announce(`Przeniesiono. Blok ${app.params.blocks.indexOf(b) + 1}, ${app.db.categoryById.get(b.id).name}${dragging.kind === 'exercise' ? `, ćwiczenie ${b.exercises.findIndex((e) => e.id === dragging.id) + 1}` : ''}.`);
  };
  list.addEventListener('keydown', (event) => {
    const button = event.target.closest('[data-drag]');
    if (!button) return;
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); dragging ? finish() : grab(button); return; }
    if (!dragging) return;
    if (event.key === 'Escape') { event.preventDefault(); finish(true); return; }
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const b = blockEntry(app.params, dragging.key);
    const index = app.params.blocks.indexOf(b);
    const offset = event.key === 'ArrowUp' ? -1 : 1;
    if (dragging.kind === 'block' && ['ArrowUp','ArrowDown'].includes(event.key)) app.params = withMovedBlock(app.params, b.key, index + offset);
    if (dragging.kind === 'exercise') {
      if (event.key === 'ArrowLeft') app.params = withMovedExercise(app.db, app.params, b.key, dragging.id);
      else if (event.key === 'ArrowRight') {
        const targets = app.params.blocks.filter((other) => other.id === b.id);
        const target = targets[(targets.indexOf(b) + 1) % targets.length];
        if (target !== b) app.params = withMovedExercise(app.db, app.params, b.key, dragging.id, target.key);
      } else {
        const pos = b.exercises.findIndex((e) => e.id === dragging.id) + offset;
        if (pos >= 0 && pos < b.exercises.length) app.params = withMovedExercise(app.db, app.params, b.key, dragging.id, b.key, pos);
      }
    }
    moved();
  });
  list.addEventListener('dragstart', (event) => {
    const button = event.target.closest('[data-drag]');
    if (!button) return;
    grab(button);
    event.dataTransfer?.setData('text/plain', dragging.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });
  list.addEventListener('dragover', (event) => { if (dragging) event.preventDefault(); });
  list.addEventListener('drop', (event) => {
    if (!dragging) return;
    event.preventDefault();
    const destination = event.target.closest('[data-block]');
    if (dragging.kind === 'block' && destination) app.params = withMovedBlock(app.params, dragging.key, app.params.blocks.findIndex((b) => b.key === destination.dataset.block));
    else if (dragging.kind === 'exercise') {
      const key = event.target.closest('[data-split]') || !destination ? null : destination.dataset.block;
      const row = event.target.closest('[data-exercise]');
      const position = row ? blockEntry(app.params, key).exercises.findIndex((e) => e.id === row.dataset.exercise) : Infinity;
      app.params = withMovedExercise(app.db, app.params, dragging.key, dragging.id, key, position);
    }
    moved(); finish();
  });
  list.addEventListener('dragend', () => finish());
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-role="expand"]');
    if (!button) return;
    const key = button.closest('[data-block]').dataset.block;
    expanded.has(key) ? expanded.delete(key) : expanded.add(key);
    refresh(key, 'expand');
  });
  const updateNumber = (input) => {
    const key = input.closest('[data-block]').dataset.block;
    const update = { count: withBlockCount, 'variant-limit': withVariantLimit, 'item-limit': withItemLimit }[input.dataset.role];
    if (!update) return;
    app.params = update(app.db, app.params, key, input.value);
    const b = blockEntry(app.params, key);
    const row = input.closest('.params-row');
    row.dataset.active = String(b.count > 0);
    row.querySelector('[data-role="toggle"]').checked = b.count > 0;
    const items = row.querySelector('[data-role="item-limit"]');
    if (items && items !== input) {
      const bounds = itemBounds(app.db, b, app.params.level, b.variantLimit);
      items.value = b.itemLimit; items.min = bounds.min; items.max = bounds.max;
      row.querySelector('[data-role="item-limit-range"]').textContent = `${bounds.min}–${bounds.max}`;
    }
    totals();
  };
  list.addEventListener('input', (event) => { if (event.target.type === 'number') updateNumber(event.target); });
  list.addEventListener('change', (event) => {
    const input = event.target;
    const key = input.closest('[data-block]')?.dataset.block;
    if (!key) return;
    if (input.type === 'number') {
      updateNumber(input);
      input.value = blockEntry(app.params, key)[{ count: 'count', 'variant-limit': 'variantLimit', 'item-limit': 'itemLimit' }[input.dataset.role]];
    } else if (input.dataset.role === 'pick') app.params = withPick(app.params, key, input.value);
    else if (input.dataset.role === 'toggle') {
      app.params = withBlockActive(app.db, app.params, key, input.checked);
      const row = input.closest('.params-row');
      row.dataset.active = String(input.checked);
      row.querySelector('[data-role="count"]').value = blockEntry(app.params, key).count;
      totals();
    } else if (input.dataset.role === 'exercise-active') {
      const id = input.closest('[data-exercise]').dataset.exercise;
      app.params = withExerciseActive(app.db, app.params, key, id, input.checked);
      refresh();
      [...list.querySelectorAll('[data-exercise]')].find((row) => row.dataset.exercise === id)?.querySelector('input').focus();
    }
  });
  root.querySelector('#param-date').addEventListener('change', (e) => { app.params = withDate(app.params, e.target.value); e.target.value = app.params.date; });
  root.querySelector('#param-level').addEventListener('change', (e) => { app.params = withLevel(app.db, app.params, e.target.value); refresh(); });
  root.querySelector('[data-role="reset"]').addEventListener('click', () => {
    forgetParams(); app.params = createDefaultParams(app.db, app.params.date); root.querySelector('#param-level').value = app.params.level; expanded.clear(); refresh();
  });
  const seed = root.querySelector('#param-seed');
  root.querySelector('[data-role="seed-random"]').addEventListener('click', () => { seed.value = randomToken(); seed.focus(); });
  root.querySelector('[data-role="seed-clear"]').addEventListener('click', () => { seed.value = ''; seed.focus(); });
  root.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!totalExercises(app.params)) return;
    storeParams(app.params); app.startSession(app.params, seed.value.trim() || null);
  });
}
