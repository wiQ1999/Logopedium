import { MAX_LEVEL, MIN_LEVEL } from './data.js';
import { escapeHtml, formatCount, renderMarksLegend } from './render.js';
import { randomToken } from './rng.js';

export const DEFAULT_LEVEL = MAX_LEVEL;
const DEFAULT_CATEGORY_COUNT = 1;

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

export function computeLimits(db, level) {
  const limits = new Map();
  db.categories.forEach((category) => {
    const available = db.exercisesByCategory.get(category.id) ?? [];
    limits.set(category.id, available.filter((exercise) => isExerciseEligible(exercise, level)).length);
  });
  return limits;
}

export function clampParams(db, params) {
  const limits = computeLimits(db, params.level);
  return {
    ...params,
    categories: params.categories.map((entry) => ({
      ...entry,
      count: Math.max(0, Math.min(entry.count, limits.get(entry.id) ?? 0)),
    })),
  };
}

export function createDefaultParams(db, today = todayIso()) {
  const params = {
    date: today,
    level: DEFAULT_LEVEL,
    categories: db.categories.map((category) => ({ id: category.id, count: DEFAULT_CATEGORY_COUNT })),
  };
  return clampParams(db, params);
}

export function withDate(params, date) {
  return { ...params, date: isValidIsoDate(date) ? date : params.date };
}

export function withLevel(db, params, level) {
  const parsed = Number(level);
  const next = Number.isFinite(parsed) ? Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.trunc(parsed))) : DEFAULT_LEVEL;
  return clampParams(db, { ...params, level: next });
}

export function withCategoryCount(db, params, categoryId, count) {
  const limits = computeLimits(db, params.level);
  const limit = limits.get(categoryId) ?? 0;
  const parsed = Number.isFinite(Number(count)) ? Math.trunc(Number(count)) : 0;
  const next = Math.max(0, Math.min(parsed, limit));
  return {
    ...params,
    categories: params.categories.map((entry) => (entry.id === categoryId ? { ...entry, count: next } : entry)),
  };
}

export function withCategoryActive(db, params, categoryId, active) {
  return withCategoryCount(db, params, categoryId, active ? DEFAULT_CATEGORY_COUNT : 0);
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

export function paramsSignature(params) {
  const selection = activeSelections(params)
    .map((entry) => `${entry.id}:${entry.count}`)
    .join(',');
  return `${params.date}|${params.level}|${selection}`;
}

export function encodeParams(params) {
  return {
    d: params.date,
    l: String(params.level),
    c: activeSelections(params)
      .map((entry) => `${entry.id}:${entry.count}`)
      .join(','),
  };
}

export function decodeParams(query, db) {
  const date = query.get('d');
  const level = Number(query.get('l'));
  const base = {
    date: isValidIsoDate(date) ? date : todayIso(),
    level: Number.isInteger(level) && level >= MIN_LEVEL && level <= MAX_LEVEL ? level : DEFAULT_LEVEL,
    categories: db.categories.map((category) => ({ id: category.id, count: 0 })),
  };

  const encoded = (query.get('c') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.lastIndexOf(':');
      const id = separator === -1 ? entry : entry.slice(0, separator);
      const count = separator === -1 ? DEFAULT_CATEGORY_COUNT : Number(entry.slice(separator + 1));
      return { id, count: Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0 };
    })
    .filter((entry) => entry.count > 0 && db.categoryById.has(entry.id));

  const selectedIds = new Set();
  const queue = encoded.filter((entry) => {
    if (selectedIds.has(entry.id)) {
      return false;
    }
    selectedIds.add(entry.id);
    return true;
  });
  const categories = base.categories.map((entry) =>
    selectedIds.has(entry.id) ? queue.shift() : entry,
  );

  return clampParams(db, { ...base, categories });
}

function renderCategoryRow(category, entry, limit, index, total) {
  const active = entry.count > 0;
  const disabled = limit === 0;
  const inputId = `param-count-${category.id}`;
  return `<li class="params-row" data-category="${escapeHtml(category.id)}" data-active="${active}">
      <input type="checkbox" class="params-row__toggle" data-role="toggle" ${active ? 'checked' : ''}
             ${disabled ? 'disabled' : ''} aria-label="Kategoria w sesji: ${escapeHtml(category.name)}">
      <label class="params-row__name" for="${inputId}">
        ${escapeHtml(category.name)}
        <span class="params-row__meta">${disabled ? 'brak ćwiczeń na tym poziomie' : `dostępnych: ${limit}`}</span>
      </label>
      <span class="params-row__count">
        <input class="input" type="number" inputmode="numeric" id="${inputId}" data-role="count"
               min="0" max="${limit}" step="1" value="${entry.count}" ${disabled ? 'disabled' : ''}
               aria-label="Liczba ćwiczeń z kategorii ${escapeHtml(category.name)}">
        <span class="params-row__limit">z ${limit}</span>
      </span>
      <span class="params-row__move">
        <button type="button" class="btn btn--icon" data-role="move" data-offset="-1" ${index === 0 ? 'disabled' : ''}
                aria-label="Przesuń wyżej: ${escapeHtml(category.name)}">&#9650;</button>
        <button type="button" class="btn btn--icon" data-role="move" data-offset="1" ${index === total - 1 ? 'disabled' : ''}
                aria-label="Przesuń niżej: ${escapeHtml(category.name)}">&#9660;</button>
      </span>
    </li>`;
}

function renderCategoryList(db, params) {
  const limits = computeLimits(db, params.level);
  return params.categories
    .map((entry, index) =>
      renderCategoryRow(db.categoryById.get(entry.id), entry, limits.get(entry.id) ?? 0, index, params.categories.length),
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

function renderView(app) {
  const { db, params, seedOverride } = app;
  const total = totalExercises(params);

  return `<section class="view-head">
      <h1>Parametry sesji</h1>
      <p class="view-head__lead">Wybierz kategorie i liczbę ćwiczeń, ustaw poziom trudności oraz datę.
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
        </div>
      </div>

      <div class="panel">
        <div class="panel__head">
          <h2 class="panel__title">Kategorie</h2>
          <p class="panel__hint">Zero ćwiczeń wyłącza kategorię. Kolejność na liście wyznacza kolejność w sesji.</p>
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
        <button type="submit" class="btn btn--primary btn--lg" id="params-submit" ${total === 0 ? 'disabled' : ''}>
          Rozpocznij sesję
        </button>
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

  list.addEventListener('input', (event) => {
    const input = event.target.closest('[data-role="count"]');
    if (!input) {
      return;
    }
    const row = input.closest('.params-row');
    app.params = withCategoryCount(app.db, app.params, row.dataset.category, input.value);
    const entry = app.params.categories.find((item) => item.id === row.dataset.category);
    row.dataset.active = String(entry.count > 0);
    row.querySelector('[data-role="toggle"]').checked = entry.count > 0;
    refreshTotals();
  });

  list.addEventListener('change', (event) => {
    const input = event.target.closest('[data-role="count"]');
    if (!input) {
      return;
    }
    const row = input.closest('.params-row');
    const entry = app.params.categories.find((item) => item.id === row.dataset.category);
    input.value = String(entry.count);
  });

  list.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-role="toggle"]');
    if (toggle) {
      const row = toggle.closest('.params-row');
      app.params = withCategoryActive(app.db, app.params, row.dataset.category, toggle.checked);
      const entry = app.params.categories.find((item) => item.id === row.dataset.category);
      row.dataset.active = String(entry.count > 0);
      row.querySelector('[data-role="count"]').value = String(entry.count);
      toggle.checked = entry.count > 0;
      refreshTotals();
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
