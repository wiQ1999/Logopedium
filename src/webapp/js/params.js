import Sortable from '../vendor/sortable.esm.js';
import { escapeHtml, formatCount, renderMarksLegend } from './render.js';
import { randomToken } from './rng.js';
import { activeSelections, blockEntry, blockExercises, createDefaultParams, forgetParams, itemBounds,
  storeParams, totalExercises, variantBounds, withBlockActive, withBlockCount, withDate,
  withExerciseActive, withItemLimit, withLevel, withMovedBlock, withMovedExercise, withPick, withVariantLimit } from './blocks.js';
export * from './blocks.js';

const options = (pick) => ['kolejnosc', 'losowo'].map((p) => `<option value="${p}" ${p === pick ? 'selected' : ''}>${p === 'kolejnosc' ? 'kolejność' : 'losowo'}</option>`).join('');
const handle = (label, kind, id) => `<button type="button" class="btn drag-handle" data-drag="${kind}" data-id="${escapeHtml(id)}" aria-describedby="drag-help" aria-pressed="false" aria-label="Przenieś: ${escapeHtml(label)}">⠿</button>`;
const TOUCH_HOLD_MS = 350;
const TOUCH_MOVE_TOLERANCE = 10;

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
    <div class="params-block__exercises" id="exercises-${escapeHtml(b.key)}" ${expanded ? '' : 'hidden'}>
      <ol class="exercise-rows" data-category="${escapeHtml(b.id)}">${b.exercises.map((e) => `<li class="exercise-row" data-exercise="${escapeHtml(e.id)}" data-category="${escapeHtml(b.id)}" data-category-name="${escapeHtml(category.name)}">
        ${handle(db.exerciseById.get(e.id).title, 'exercise', e.id)}
        <label><input type="checkbox" data-role="exercise-active" ${e.active ? 'checked' : ''}> ${escapeHtml(db.exerciseById.get(e.id).title)}</label>
      </li>`).join('')}</ol>
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
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  let dragging = null;
  let beforeDrag = null;
  let sortables = [];
  let onRefresh = null;
  root.innerHTML = `<section class="view-head"><h1>Parametry sesji</h1>
    <p class="view-head__lead">Ustaw materiał i kolejność bloków. Rozwiń blok, aby wybrać lub przenieść ćwiczenia.</p></section>
    <form id="params-form"><div class="panel field-grid">
      <label class="field" for="param-date">Data sesji<input class="input" type="date" id="param-date" required value="${escapeHtml(app.params.date)}"></label>
      <label class="field" for="param-level">Poziom trudności<select class="select" id="param-level">${[1,2,3,4].map((l) => `<option value="${l}" ${l === app.params.level ? 'selected' : ''}>Poziom ${l} i niższe</option>`).join('')}</select></label>
    </div><div class="panel"><h2>Bloki ćwiczeń</h2>
      <p id="drag-help" class="panel__hint">Przeciągnij uchwyt, aby zmienić kolejność — przerwa w liście pokazuje, gdzie wiersz wyląduje. Ćwiczenie wyciągnięte z bloku między bloki tworzy nowy blok tej kategorii z osobną pulą ćwiczeń. Escape albo upuszczenie poza listą wycofuje ruch. Na ekranie dotykowym przytrzymaj uchwyt, a potem przesuń wiersz. Klawiatura: spacja — przejęcie i upuszczenie, strzałki góra/dół — kolejność, lewo — nowy blok, prawo — następny blok tej kategorii, Escape — wycofanie.</p>
      <p id="drag-status" role="status" aria-live="polite"></p><ol class="params-list" id="params-list"></ol></div>
      <details class="disclosure"><summary>Ziarno losowania</summary><div class="disclosure__body">
        <label class="field" for="param-seed">Własne ziarno (opcjonalne)<input class="input" id="param-seed" value="${escapeHtml(app.plan?.seedOverride ?? '')}"></label>
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
    onRefresh?.();
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
  const place = () => {
    if (dragging.kind === 'exercise') {
      dragging.key = app.params.blocks.find((b) => b.exercises.some((e) => e.id === dragging.id)).key;
      expanded.add(dragging.key);
    }
    const b = blockEntry(app.params, dragging.key);
    return `Blok ${app.params.blocks.indexOf(b) + 1}, ${app.db.categoryById.get(b.id).name}${dragging.kind === 'exercise' ? `, ćwiczenie ${b.exercises.findIndex((e) => e.id === dragging.id) + 1}` : ''}.`;
  };
  const finish = (cancel = false, message = 'Upuszczono wiersz.') => {
    if (!dragging) return;
    const id = dragging.id;
    if (cancel) app.params = beforeDrag;
    dragging = null;
    beforeDrag = null;
    refresh(id);
    announce(cancel ? 'Wycofano przenoszenie.' : message);
  };
  const moved = () => {
    const where = place();
    refresh(dragging.id);
    announce(`Przeniesiono. ${where}`);
  };
  list.addEventListener('keydown', (event) => {
    const button = event.target.closest('[data-drag]');
    if (!button || dragging?.mode === 'pointer') return;
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
  // Pointer dragging: SortableJS moves rows live and opens the gap; on drop the new DOM order is
  // translated into a model change and the list is rebuilt from the model.
  const readDrop = (item) => {
    const siblings = (parent, selector) => [...parent.children].filter((el) => el.matches(selector));
    if (dragging.kind === 'block') return { kind: 'block', index: siblings(list, '.params-block').indexOf(item) };
    if (item.parentElement === list) {
      return { kind: 'split', blockIndex: siblings(list, '.params-block, .exercise-row').indexOf(item) };
    }
    return { kind: 'exercise', targetKey: item.closest('[data-block]').dataset.block,
      position: siblings(item.parentElement, '.exercise-row').indexOf(item) };
  };
  const applyDrop = (drop) => {
    if (drop.kind === 'block') app.params = withMovedBlock(app.params, dragging.key, drop.index);
    else app.params = withMovedExercise(app.db, app.params, dragging.key, dragging.id,
      drop.kind === 'split' ? null : drop.targetKey, drop.position, drop.kind === 'split' ? drop.blockIndex : null);
  };
  // Geometry, not hit-testing: while auto-scrolling the pointer rests on the sticky header,
  // which covers the list but must not count as leaving it.
  const releasedOutside = (event) => {
    const point = event?.changedTouches?.[0] ?? event;
    const rect = list.getBoundingClientRect();
    if (!Number.isFinite(point?.clientX) || !Number.isFinite(point?.clientY) || !rect.width || !rect.height) return false;
    return point.clientX < rect.left || point.clientX > rect.right || point.clientY < rect.top || point.clientY > rect.bottom;
  };
  const cancelPointerDrag = () => {
    if (dragging?.mode !== 'pointer') return;
    dragging.cancelled = true;
    // SortableJS has no public cancel; a synthetic release ends the drag through its own drop path.
    for (const type of ['pointerup', 'mouseup']) {
      if (Sortable.active) doc.dispatchEvent(new win.MouseEvent(type, { bubbles: true }));
    }
    if (Sortable.active) Sortable.active._onDrop();
  };
  const onEscape = (event) => {
    if (event.key === 'Escape' && dragging?.mode === 'pointer') { event.preventDefault(); event.stopPropagation(); cancelPointerDrag(); }
  };
  doc.addEventListener('keydown', onEscape, true);
  const sortableOptions = {
    animation: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 160,
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 3,
    delay: TOUCH_HOLD_MS,
    delayOnTouchOnly: true,
    touchStartThreshold: TOUCH_MOVE_TOLERANCE,
    swapThreshold: 0.65,
    scrollSensitivity: 80,
    scrollSpeed: 12,
    ghostClass: 'drag-gap',
    chosenClass: 'drag-chosen',
    fallbackClass: 'drag-float',
    // A lifted block folds to its header row, so it can travel past long expanded neighbours.
    onChoose: (event) => { if (event.item.matches('.params-block')) event.item.classList.add('params-block--lifted'); },
    onUnchoose: (event) => { if (!dragging) event.item.classList.remove('params-block--lifted'); },
    onStart: (event) => {
      grab(event.item.querySelector('[data-drag]'));
      dragging.mode = 'pointer';
      list.classList.add('params-list--dragging', `params-list--dragging-${dragging.kind}`);
    },
    onEnd: (event) => {
      if (!dragging) return;
      list.classList.remove('params-list--dragging', 'params-list--dragging-block', 'params-list--dragging-exercise');
      const cancelled = dragging.cancelled || releasedOutside(event.originalEvent);
      if (!cancelled) applyDrop(readDrop(event.item));
      // Rebuilding waits until SortableJS has finished its own drop bookkeeping on these nodes.
      win.setTimeout(() => {
        if (!dragging) return;
        if (cancelled) finish(true);
        else finish(false, `Upuszczono. ${place()}`);
      }, 0);
    },
  };
  const attachSortables = () => {
    sortables.forEach((sortable) => sortable.destroy());
    sortables = [new Sortable(list, { ...sortableOptions, draggable: '.params-block', handle: '[data-drag="block"]',
      // Blocks stay on this list; an exercise dropped here becomes a new block of its category.
      group: { name: 'blocks', pull: false, put: (to, from, item) => item.matches('.exercise-row') } })];
    list.querySelectorAll('.exercise-rows').forEach((rows) => sortables.push(new Sortable(rows, {
      ...sortableOptions, draggable: '.exercise-row', handle: '[data-drag="exercise"]',
      group: { name: 'exercises', pull: true,
        put: (to, from, item) => item.matches('.exercise-row') && item.dataset.category === to.el.dataset.category },
    })));
  };
  onRefresh = attachSortables;
  attachSortables();
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
  return () => {
    if (dragging?.mode === 'pointer') cancelPointerDrag();
    doc.removeEventListener('keydown', onEscape, true);
    onRefresh = null;
    sortables.forEach((sortable) => sortable.destroy());
    sortables = [];
    dragging = null;
  };
}
