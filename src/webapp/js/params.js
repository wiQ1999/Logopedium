import { MAX_LEVEL, MIN_LEVEL } from './data.js';
import { escapeHtml, formatCount, renderMarksLegend } from './render.js';
import { clearSettings, readSettings, writeSettings } from './settings.js';
import { randomToken } from './rng.js';

export const DEFAULT_LEVEL = MAX_LEVEL;
export const PICK_MODES = ['kolejnosc', 'losowo'];
export const DEFAULT_PICK = 'kolejnosc';

const PICK_LABELS = {
  kolejnosc: 'kolejność',
  losowo: 'losowo',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIso(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidIsoDate(value) {
  if (!ISO_DATE.test(String(value))) {
    return false;
  }
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isExerciseEligible(exercise, level) {
  return exercise.level === null || exercise.level === undefined || exercise.level <= level;
}

function categoryExercises(db, categoryId, level) {
  return (db.exercisesByCategory.get(categoryId) ?? []).filter((exercise) => isExerciseEligible(exercise, level));
}

export function computeLimits(db, level) {
  const limits = new Map();
  db.categories.forEach((category) => {
    limits.set(category.id, categoryExercises(db, category.id, level).length);
  });
  return limits;
}

/** Kraniec `W` kategorii: najwyższa liczba wariantów wśród jej ćwiczeń (APPLICATION §3.3). */
export function variantBounds(db, categoryId, level) {
  const max = categoryExercises(db, categoryId, level).reduce(
    (best, exercise) => Math.max(best, exercise.variants.length),
    1,
  );
  return { min: 1, max };
}

/** Kraniec `P` kategorii: najbogatsze ćwiczenie złożone z `W` najzasobniejszych wariantów. */
export function itemBounds(db, categoryId, level, variantLimit) {
  const parsed = Math.trunc(Number(variantLimit));
  const limit = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
  const max = categoryExercises(db, categoryId, level).reduce((best, exercise) => {
    const sizes = exercise.variants
      .map((variant) => variant.items.length)
      .filter((size) => size > 0)
      .sort((a, b) => b - a);
    return Math.max(best, sizes.slice(0, limit).reduce((total, size) => total + size, 0));
  }, 0);
  return { min: Math.min(limit, max), max };
}

function clampToBounds(value, bounds) {
  if (value === null || value === undefined || value === '') {
    return bounds.max;
  }
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) {
    return bounds.max;
  }
  return Math.max(bounds.min, Math.min(bounds.max, parsed));
}

function clampEntry(db, entry, level, exerciseLimit) {
  const variantLimit = clampToBounds(entry.variantLimit, variantBounds(db, entry.id, level));
  const itemLimit = clampToBounds(entry.itemLimit, itemBounds(db, entry.id, level, variantLimit));
  return {
    ...entry,
    count: Math.max(0, Math.min(entry.count, exerciseLimit)),
    variantLimit,
    itemLimit,
  };
}

export function clampParams(db, params) {
  const limits = computeLimits(db, params.level);
  return {
    ...params,
    categories: params.categories.map((entry) => clampEntry(db, entry, params.level, limits.get(entry.id) ?? 0)),
    pick: PICK_MODES.includes(params.pick) ? params.pick : DEFAULT_PICK,
  };
}

export function createDefaultParams(db, today = todayIso()) {
  const limits = computeLimits(db, DEFAULT_LEVEL);
  return clampParams(db, {
    date: today,
    level: DEFAULT_LEVEL,
    categories: db.categories.map((category) => ({ id: category.id, count: limits.get(category.id) ?? 0 })),
    pick: DEFAULT_PICK,
  });
}

export function categoryEntry(params, categoryId) {
  return params.categories.find((entry) => entry.id === categoryId);
}

function withEntry(params, categoryId, change) {
  return {
    ...params,
    categories: params.categories.map((entry) => (entry.id === categoryId ? { ...entry, ...change(entry) } : entry)),
  };
}

export function withDate(params, date) {
  return { ...params, date: isValidIsoDate(date) ? date : params.date };
}

export function withLevel(db, params, level) {
  const parsed = Number(level);
  const next = Number.isFinite(parsed) ? Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.trunc(parsed))) : DEFAULT_LEVEL;
  return clampParams(db, { ...params, level: next });
}

export function withPick(params, pick) {
  return { ...params, pick: PICK_MODES.includes(pick) ? pick : params.pick };
}

export function withCategoryCount(db, params, categoryId, count) {
  const limit = computeLimits(db, params.level).get(categoryId) ?? 0;
  const parsed = Number.isFinite(Number(count)) ? Math.trunc(Number(count)) : 0;
  return withEntry(params, categoryId, () => ({ count: Math.max(0, Math.min(parsed, limit)) }));
}

export function withCategoryActive(db, params, categoryId, active) {
  const limit = computeLimits(db, params.level).get(categoryId) ?? 0;
  return withCategoryCount(db, params, categoryId, active ? limit : 0);
}

export function withVariantLimit(db, params, categoryId, value) {
  const variantLimit = clampToBounds(value, variantBounds(db, categoryId, params.level));
  const entry = categoryEntry(params, categoryId);
  const itemLimit = clampToBounds(entry.itemLimit, itemBounds(db, categoryId, params.level, variantLimit));
  return withEntry(params, categoryId, () => ({ variantLimit, itemLimit }));
}

export function withItemLimit(db, params, categoryId, value) {
  const entry = categoryEntry(params, categoryId);
  const bounds = itemBounds(db, categoryId, params.level, entry.variantLimit);
  return withEntry(params, categoryId, () => ({ itemLimit: clampToBounds(value, bounds) }));
}

export function withMovedCategory(params, categoryId, offset) {
  const index = params.categories.findIndex((entry) => entry.id === categoryId);
  const target = index + offset;
  if (index === -1 || target < 0 || target >= params.categories.length) {
    return params;
  }
  const categories = [...params.categories];
  const [moved] = categories.splice(index, 1);
  categories.splice(target, 0, moved);
  return { ...params, categories };
}

export function activeSelections(params) {
  return params.categories.filter((entry) => entry.count > 0);
}

export function totalExercises(params) {
  return activeSelections(params).reduce((total, entry) => total + entry.count, 0);
}

export function buildSeedString(params, schemaVersion) {
  const selection = activeSelections(params)
    .map((entry) => `${entry.id}:${entry.count}`)
    .sort()
    .join(',');
  return `logopedium|v=${schemaVersion}|d=${params.date}|l=${params.level}|c=${selection}`;
}

const encodeSelection = (params) =>
  activeSelections(params)
    .map((entry) => `${entry.id}:${entry.count}:${entry.variantLimit}:${entry.itemLimit}`)
    .join(',');

export function paramsSignature(params) {
  return `${params.date}|${params.level}|${encodeSelection(params)}|${params.pick}`;
}

export function encodeParams(params) {
  return {
    d: params.date,
    l: String(params.level),
    c: encodeSelection(params),
    o: params.pick,
  };
}

/** Wpis `c` to `id:ćwiczenia:W:P`; liczby czytane są od końca, bo tylko one są liczbami. */
function decodeSelection(entry, limits) {
  const parts = entry.split(':');
  const numbers = [];
  while (parts.length > 1 && numbers.length < 3 && /^\d+$/.test(parts[parts.length - 1])) {
    numbers.unshift(Number(parts.pop()));
  }
  const id = parts.join(':');
  return {
    id,
    count: numbers.length > 0 ? numbers[0] : limits.get(id) ?? 0,
    variantLimit: numbers[1],
    itemLimit: numbers[2],
  };
}

export function decodeParams(query, db) {
  const date = query.get('d');
  const level = Number(query.get('l'));
  const base = {
    date: isValidIsoDate(date) ? date : todayIso(),
    level: Number.isInteger(level) && level >= MIN_LEVEL && level <= MAX_LEVEL ? level : DEFAULT_LEVEL,
    categories: db.categories.map((category) => ({ id: category.id, count: 0 })),
    pick: query.get('o'),
  };
  const limits = computeLimits(db, base.level);

  const encoded = (query.get('c') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => decodeSelection(entry, limits))
    .filter((entry) => entry.count > 0 && db.categoryById.has(entry.id));

  const selectedIds = new Set();
  const queue = encoded.filter((entry) => {
    if (selectedIds.has(entry.id)) {
      return false;
    }
    selectedIds.add(entry.id);
    return true;
  });
  const categories = base.categories.map((entry) => (selectedIds.has(entry.id) ? queue.shift() : entry));

  return clampParams(db, { ...base, categories });
}

export function storeParams(params) {
  return writeSettings({
    level: params.level,
    pick: params.pick,
    categories: params.categories.map((entry) => ({
      id: entry.id,
      count: entry.count,
      variantLimit: entry.variantLimit,
      itemLimit: entry.itemLimit,
    })),
  });
}

export function forgetParams() {
  return clearSettings();
}

export function loadStoredParams(db, today = todayIso()) {
  const stored = readSettings();
  if (!stored) {
    return null;
  }

  const level =
    Number.isInteger(stored.level) && stored.level >= MIN_LEVEL && stored.level <= MAX_LEVEL
      ? stored.level
      : DEFAULT_LEVEL;
  const limits = computeLimits(db, level);

  const seen = new Set();
  const categories = [];
  (Array.isArray(stored.categories) ? stored.categories : []).forEach((entry) => {
    if (!entry || !db.categoryById.has(entry.id) || seen.has(entry.id)) {
      return;
    }
    seen.add(entry.id);
    const count = Number(entry.count);
    categories.push({
      id: entry.id,
      count: Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0,
      variantLimit: entry.variantLimit,
      itemLimit: entry.itemLimit,
    });
  });
  db.categories.forEach((category) => {
    if (!seen.has(category.id)) {
      categories.push({ id: category.id, count: limits.get(category.id) ?? 0 });
    }
  });

  return clampParams(db, { date: today, level, categories, pick: stored.pick });
}

function renderNumberField(options) {
  const { id, role, label, value, min, max, range, disabled, aria } = options;
  return `<span class="params-row__field">
        <label class="params-row__field-label" for="${id}">${escapeHtml(label)}
          <span class="params-row__field-range" data-role="${role}-range">${escapeHtml(range)}</span>
        </label>
        <input class="input params-row__num" type="number" inputmode="numeric" id="${id}" data-role="${role}"
               min="${min}" max="${max}" step="1" value="${value}" ${disabled ? 'disabled' : ''}
               aria-label="${escapeHtml(aria)}">
      </span>`;
}

function renderCategoryRow(db, category, entry, level, limit, index, total) {
  const active = entry.count > 0;
  const disabled = limit === 0;
  const name = escapeHtml(category.name);
  const countId = `param-count-${category.id}`;
  const variants = variantBounds(db, category.id, level);
  const items = itemBounds(db, category.id, level, entry.variantLimit);

  const fields = [
    renderNumberField({
      id: countId,
      role: 'count',
      label: 'ćwiczeń',
      value: entry.count,
      min: 0,
      max: limit,
      range: `0–${limit}`,
      disabled,
      aria: `Liczba ćwiczeń z kategorii ${category.name}`,
    }),
    variants.max > 1
      ? renderNumberField({
          id: `param-variants-${category.id}`,
          role: 'variant-limit',
          label: 'wariantów',
          value: entry.variantLimit,
          min: variants.min,
          max: variants.max,
          range: `${variants.min}–${variants.max}`,
          disabled,
          aria: `Liczba wariantów w ćwiczeniu z kategorii ${category.name}`,
        })
      : '',
    items.max > 0
      ? renderNumberField({
          id: `param-items-${category.id}`,
          role: 'item-limit',
          label: 'pozycji',
          value: entry.itemLimit,
          min: items.min,
          max: items.max,
          range: `${items.min}–${items.max}`,
          disabled,
          aria: `Liczba pozycji w ćwiczeniu z kategorii ${category.name}`,
        })
      : '',
  ].join('');

  return `<li class="params-row" data-category="${escapeHtml(category.id)}" data-active="${active}">
      <input type="checkbox" class="params-row__toggle" data-role="toggle" ${active ? 'checked' : ''}
             ${disabled ? 'disabled' : ''} aria-label="Kategoria w sesji: ${name}">
      <label class="params-row__name" for="${countId}">
        ${name}
        <span class="params-row__meta">${disabled ? 'brak ćwiczeń na tym poziomie' : `dostępnych: ${limit}`}</span>
      </label>
      <span class="params-row__numbers">${fields}</span>
      <span class="params-row__move">
        <button type="button" class="btn btn--icon" data-role="move" data-offset="-1" ${index === 0 ? 'disabled' : ''}
                aria-label="Przesuń wyżej: ${name}">&#9650;</button>
        <button type="button" class="btn btn--icon" data-role="move" data-offset="1" ${index === total - 1 ? 'disabled' : ''}
                aria-label="Przesuń niżej: ${name}">&#9660;</button>
      </span>
    </li>`;
}

function renderCategoryList(db, params) {
  const limits = computeLimits(db, params.level);
  return params.categories
    .map((entry, index) =>
      renderCategoryRow(
        db,
        db.categoryById.get(entry.id),
        entry,
        params.level,
        limits.get(entry.id) ?? 0,
        index,
        params.categories.length,
      ),
    )
    .join('');
}

function renderSummaryLine(params) {
  const total = totalExercises(params);
  const categories = activeSelections(params).length;
  if (total === 0) {
    return 'Brak wybranych ćwiczeń — ustaw liczbę większą od zera przynajmniej w jednej kategorii.';
  }
  return `${formatCount(total, ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'])} z ${formatCount(categories, [
    'kategorii',
    'kategorii',
    'kategorii',
  ])}`;
}

function renderLevelOptions(level) {
  const options = [];
  for (let value = MIN_LEVEL; value <= MAX_LEVEL; value += 1) {
    options.push(`<option value="${value}" ${value === level ? 'selected' : ''}>Poziom ${value} i niższe</option>`);
  }
  return options.join('');
}

function renderPickOptions(pick) {
  return PICK_MODES.map(
    (mode) => `<option value="${mode}" ${mode === pick ? 'selected' : ''}>${escapeHtml(PICK_LABELS[mode])}</option>`,
  ).join('');
}

function renderView(app) {
  const { db, params, seedOverride } = app;
  const total = totalExercises(params);

  return `<section class="view-head">
      <h1>Parametry sesji</h1>
      <p class="view-head__lead">Wybierz kategorie i zakres materiału, ustaw poziom trudności oraz datę.
        Zestaw jest losowany na podstawie tych ustawień i pozostaje taki sam przez cały dzień.</p>
    </section>

    <form id="params-form" novalidate>
      <div class="panel">
        <div class="field-grid">
          <div class="field">
            <label class="field__label" for="param-date">Data sesji</label>
            <input class="input" type="date" id="param-date" name="date" value="${escapeHtml(params.date)}" required>
            <span class="field__hint">Podstawa losowania — ta sama data daje ten sam zestaw ćwiczeń.</span>
          </div>
          <div class="field">
            <label class="field__label" for="param-level">Poziom trudności</label>
            <select class="select" id="param-level" name="level">${renderLevelOptions(params.level)}</select>
            <span class="field__hint">Górny limit. Ćwiczenia bez określonego poziomu pozostają dostępne.</span>
          </div>
          <div class="field">
            <label class="field__label" for="param-pick">Dobór</label>
            <select class="select" id="param-pick" data-role="pick">${renderPickOptions(params.pick)}</select>
            <span class="field__hint">Kolejność — ciąg z bazy od losowego miejsca. Losowo — elementy w kolejności losowania.</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__head">
          <h2 class="panel__title">Kategorie</h2>
          <p class="panel__hint">Zero ćwiczeń wyłącza kategorię. Kolejność na liście wyznacza kolejność w sesji.
            Liczba wariantów i pozycji ogranicza pojedyncze ćwiczenie z tej kategorii.</p>
        </div>
        <ol class="params-list" id="params-list">${renderCategoryList(db, params)}</ol>
      </div>

      <details class="disclosure" ${seedOverride ? 'open' : ''}>
        <summary>Ziarno losowania</summary>
        <div class="disclosure__body">
          <p class="panel__hint">Ziarno wynika z daty, wersji bazy, poziomu i zestawu kategorii. Własna wartość
            pozwala odtworzyć dowolną sesję albo wylosować nowy zestaw na ten sam dzień.</p>
          <div class="field" style="margin-top: var(--space-3)">
            <label class="field__label" for="param-seed">Własne ziarno (opcjonalne)</label>
            <input class="input" type="text" id="param-seed" name="seed" value="${escapeHtml(seedOverride ?? '')}"
                   placeholder="puste = ziarno z parametrów" autocomplete="off" spellcheck="false">
          </div>
          <div class="btn-row" style="margin-top: var(--space-3)">
            <button type="button" class="btn" data-role="seed-random">Wylosuj nowe ziarno</button>
            <button type="button" class="btn btn--ghost" data-role="seed-clear">Wyczyść</button>
          </div>
        </div>
      </details>

      <details class="disclosure">
        <summary>Oznaczenia w treści ćwiczeń</summary>
        <div class="disclosure__body">${renderMarksLegend()}</div>
      </details>

      <div class="params-summary">
        <span class="params-summary__total" id="params-total">${renderSummaryLine(params)}</span>
        <span class="btn-row">
          <button type="button" class="btn btn--ghost" data-role="reset">Przywróć domyślne</button>
          <button type="submit" class="btn btn--primary btn--lg" id="params-submit" ${total === 0 ? 'disabled' : ''}>
            Rozpocznij sesję
          </button>
        </span>
      </div>
    </form>`;
}

export function mount(root, app) {
  root.innerHTML = renderView(app);

  const form = root.querySelector('#params-form');
  const list = root.querySelector('#params-list');
  const totalLabel = root.querySelector('#params-total');
  const submit = root.querySelector('#params-submit');
  const seedInput = root.querySelector('#param-seed');

  const refreshTotals = () => {
    totalLabel.textContent = renderSummaryLine(app.params);
    submit.disabled = totalExercises(app.params) === 0;
  };

  // Zakres `P` zależy od `W` tej samej kategorii, więc po każdej zmianie wiersz dostaje
  // przeliczone krańce. Pole właśnie edytowane zostaje nietknięte — wartość poprawia się
  // dopiero na zdarzeniu `change`, żeby nie przerywać pisania.
  const refreshRow = (row, editing = null) => {
    const entry = categoryEntry(app.params, row.dataset.category);
    row.dataset.active = String(entry.count > 0);
    row.querySelector('[data-role="toggle"]').checked = entry.count > 0;

    const itemInput = row.querySelector('[data-role="item-limit"]');
    if (itemInput) {
      const bounds = itemBounds(app.db, entry.id, app.params.level, entry.variantLimit);
      itemInput.min = String(bounds.min);
      itemInput.max = String(bounds.max);
      row.querySelector('[data-role="item-limit-range"]').textContent = `${bounds.min}–${bounds.max}`;
      if (itemInput !== editing) {
        itemInput.value = String(entry.itemLimit);
      }
    }
    refreshTotals();
  };

  const refreshList = (focusSelector) => {
    list.innerHTML = renderCategoryList(app.db, app.params);
    refreshTotals();
    if (focusSelector) {
      const target = list.querySelector(focusSelector);
      if (target && !target.disabled) {
        target.focus();
      }
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (totalExercises(app.params) === 0) {
      return;
    }
    storeParams(app.params);
    app.startSession(app.params, seedInput.value.trim() || null);
  });

  root.querySelector('#param-date').addEventListener('change', (event) => {
    app.params = withDate(app.params, event.target.value);
    event.target.value = app.params.date;
  });

  root.querySelector('#param-level').addEventListener('change', (event) => {
    app.params = withLevel(app.db, app.params, event.target.value);
    refreshList();
  });

  root.querySelector('[data-role="pick"]').addEventListener('change', (event) => {
    app.params = withPick(app.params, event.target.value);
  });

  root.querySelector('[data-role="reset"]').addEventListener('click', () => {
    forgetParams();
    app.params = createDefaultParams(app.db, app.params.date);
    mount(root, app);
    root.querySelector('[data-role="reset"]').focus();
  });

  list.addEventListener('input', (event) => {
    const input = event.target.closest('input[data-role]');
    if (!input) {
      return;
    }
    const row = input.closest('.params-row');
    const categoryId = row.dataset.category;

    if (input.dataset.role === 'count') {
      app.params = withCategoryCount(app.db, app.params, categoryId, input.value);
    } else if (input.dataset.role === 'variant-limit') {
      app.params = withVariantLimit(app.db, app.params, categoryId, input.value);
    } else if (input.dataset.role === 'item-limit') {
      app.params = withItemLimit(app.db, app.params, categoryId, input.value);
    } else {
      return;
    }
    refreshRow(row, input);
  });

  list.addEventListener('change', (event) => {
    const input = event.target.closest('input[data-role]');
    if (!input || input.type === 'checkbox') {
      return;
    }
    const entry = categoryEntry(app.params, input.closest('.params-row').dataset.category);
    const current = {
      count: entry.count,
      'variant-limit': entry.variantLimit,
      'item-limit': entry.itemLimit,
    }[input.dataset.role];
    if (current !== undefined) {
      input.value = String(current);
    }
  });

  list.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-role="toggle"]');
    if (toggle) {
      const row = toggle.closest('.params-row');
      app.params = withCategoryActive(app.db, app.params, row.dataset.category, toggle.checked);
      const entry = categoryEntry(app.params, row.dataset.category);
      row.querySelector('[data-role="count"]').value = String(entry.count);
      refreshRow(row);
      return;
    }

    const move = event.target.closest('[data-role="move"]');
    if (move) {
      const row = move.closest('.params-row');
      const categoryId = row.dataset.category;
      app.params = withMovedCategory(app.params, categoryId, Number(move.dataset.offset));
      refreshList(`[data-category="${CSS.escape(categoryId)}"] [data-role="move"][data-offset="${move.dataset.offset}"]`);
    }
  });

  root.querySelector('[data-role="seed-random"]').addEventListener('click', () => {
    seedInput.value = randomToken();
    seedInput.focus();
  });

  root.querySelector('[data-role="seed-clear"]').addEventListener('click', () => {
    seedInput.value = '';
    seedInput.focus();
  });
}
