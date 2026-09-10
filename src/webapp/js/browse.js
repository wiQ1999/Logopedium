import { normalizeText } from './data.js';
import {
  attachMarkModeControl,
  escapeHtml,
  formatCount,
  levelLabel,
  renderExerciseCard,
  renderMarksLegend,
  renderMarksToolbar,
  renderMetaGrid,
  renderNotice,
  renderRawData,
} from './render.js';

const SNIPPET_LENGTH = 200;

export function matchesQuery(exercise, query) {
  const tokens = normalizeText(query).split(' ').filter(Boolean);
  return tokens.every((token) => exercise.searchText.includes(token));
}

export function filterExercises(db, filters) {
  return db.exercises.filter((exercise) => {
    if (filters.category && exercise.categoryId !== filters.category) {
      return false;
    }
    if (filters.level === 'none' && exercise.level !== null) {
      return false;
    }
    if (filters.level && filters.level !== 'none' && String(exercise.level) !== String(filters.level)) {
      return false;
    }
    if (filters.query && !matchesQuery(exercise, filters.query)) {
      return false;
    }
    return true;
  });
}

export function readFilters(query) {
  return {
    query: query.get('q') ?? '',
    category: query.get('cat') ?? '',
    level: query.get('level') ?? '',
  };
}

export function browseHref(filters, exerciseId = null) {
  const parts = [];
  if (filters.query) {
    parts.push(`q=${encodeURIComponent(filters.query)}`);
  }
  if (filters.category) {
    parts.push(`cat=${encodeURIComponent(filters.category)}`);
  }
  if (filters.level) {
    parts.push(`level=${encodeURIComponent(filters.level)}`);
  }
  const path = exerciseId ? `#/browse/${encodeURIComponent(exerciseId)}` : '#/browse';
  return parts.length > 0 ? `${path}?${parts.join('&')}` : path;
}

function snippet(exercise) {
  const text = exercise.plainText;
  return text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH).trimEnd()}…` : text;
}

function renderExerciseItem(exercise, filters) {
  const meta = [
    levelLabel(exercise.level),
    formatCount(exercise.variants.length, ['zadanie', 'zadania', 'zadań']),
    exercise.itemCount > 0 ? formatCount(exercise.itemCount, ['pozycja', 'pozycje', 'pozycji']) : '',
    exercise.readQuality === 'do_weryfikacji' ? 'odczyt do weryfikacji' : '',
  ].filter(Boolean);

  return `<li>
      <a class="browse-item" href="${browseHref(filters, exercise.id)}">
        <span class="browse-item__title">${escapeHtml(exercise.title)}</span>
        <span class="browse-item__meta">${meta.map((entry) => `<span>${escapeHtml(entry)}</span>`).join('')}</span>
        <span class="browse-item__snippet">${escapeHtml(snippet(exercise))}</span>
      </a>
    </li>`;
}

function renderResults(db, filters) {
  const matched = filterExercises(db, filters);
  if (matched.length === 0) {
    return `<p class="empty-state">Żadne ćwiczenie nie pasuje do wybranych kryteriów.</p>`;
  }

  const byCategory = new Map(db.categories.map((category) => [category.id, []]));
  matched.forEach((exercise) => byCategory.get(exercise.categoryId).push(exercise));

  const groups = db.categories
    .filter((category) => byCategory.get(category.id).length > 0)
    .map((category) => {
      const items = [...byCategory.get(category.id)]
        .sort((a, b) => a.title.localeCompare(b.title, 'pl'))
        .map((exercise) => renderExerciseItem(exercise, filters))
        .join('');
      return `<section class="browse-group">
          <div class="browse-group__head">
            <h2 class="browse-group__title">${escapeHtml(category.name)}</h2>
            <span class="browse-group__count">${formatCount(byCategory.get(category.id).length, [
              'ćwiczenie',
              'ćwiczenia',
              'ćwiczeń',
            ])}</span>
          </div>
          <ul class="browse-list">${items}</ul>
        </section>`;
    })
    .join('');

  return `<p class="panel__hint" style="margin-bottom: var(--space-4)">Znaleziono ${formatCount(matched.length, [
    'ćwiczenie',
    'ćwiczenia',
    'ćwiczeń',
  ])}.</p>${groups}`;
}

function renderAudit(db) {
  if (db.duplicates.length === 0 && db.nonTextMaterials.length === 0) {
    return '';
  }

  const duplicates = db.duplicates.length
    ? `<h3>Skany powielające inny materiał</h3>
       <table class="audit-table">
         <thead><tr><th>Plik</th><th>Duplikat</th><th>Materiał</th></tr></thead>
         <tbody>${db.duplicates
           .map(
             (entry) =>
               `<tr><td>${escapeHtml(entry.file)}</td><td>${escapeHtml(entry.duplicateOf)}</td><td>${escapeHtml(
                 entry.material,
               )}</td></tr>`,
           )
           .join('')}</tbody>
       </table>`
    : '';

  const materials = db.nonTextMaterials.length
    ? `<h3 style="margin-top: var(--space-4)">Skany bez zadań</h3>
       <table class="audit-table">
         <thead><tr><th>Plik</th><th>Zawartość</th><th>Zastosowanie</th></tr></thead>
         <tbody>${db.nonTextMaterials
           .map(
             (entry) =>
               `<tr><td>${escapeHtml(entry.file)}</td><td>${escapeHtml(entry.content)}</td><td>${escapeHtml(
                 entry.use,
               )}</td></tr>`,
           )
           .join('')}</tbody>
       </table>`
    : '';

  return `<details class="disclosure">
      <summary>Rejestr audytowy bazy</summary>
      <div class="disclosure__body">${duplicates}${materials}</div>
    </details>`;
}

function renderCategoryOptions(db, selected) {
  const options = db.categories
    .map(
      (category) =>
        `<option value="${escapeHtml(category.id)}" ${category.id === selected ? 'selected' : ''}>${escapeHtml(
          category.name,
        )}</option>`,
    )
    .join('');
  return `<option value="">wszystkie kategorie</option>${options}`;
}

function renderLevelOptions(selected) {
  const levels = ['1', '2', '3', '4']
    .map((value) => `<option value="${value}" ${value === selected ? 'selected' : ''}>poziom ${value}</option>`)
    .join('');
  return `<option value="">wszystkie poziomy</option>${levels}<option value="none" ${
    selected === 'none' ? 'selected' : ''
  }>bez określonego poziomu</option>`;
}

export function mountList(root, app, query) {
  const filters = readFilters(query);
  const { db } = app;

  root.innerHTML = `
    <section class="view-head">
      <h1>Baza ćwiczeń</h1>
      <p class="view-head__lead">Cała zawartość bazy — ${formatCount(db.stats.exerciseCount, [
        'ćwiczenie',
        'ćwiczenia',
        'ćwiczeń',
      ])} w ${formatCount(db.stats.categoryCount, ['kategorii', 'kategoriach', 'kategoriach'])},
        ${formatCount(db.stats.variantCount, ['zadanie', 'zadania', 'zadań'])} i ${formatCount(db.stats.itemCount, [
          'pozycja',
          'pozycje',
          'pozycji',
        ])}. Bez losowania i bez filtrów sesji.</p>
    </section>

    <div class="panel">
      <div class="browse-filters">
        <div class="field">
          <label class="field__label" for="browse-query">Szukaj w treści</label>
          <input class="input" type="search" id="browse-query" value="${escapeHtml(filters.query)}"
                 placeholder="tytuł, polecenie lub treść" autocomplete="off">
        </div>
        <div class="field">
          <label class="field__label" for="browse-category">Kategoria</label>
          <select class="select" id="browse-category">${renderCategoryOptions(db, filters.category)}</select>
        </div>
        <div class="field">
          <label class="field__label" for="browse-level">Poziom trudności</label>
          <select class="select" id="browse-level">${renderLevelOptions(filters.level)}</select>
        </div>
      </div>
    </div>

    <details class="disclosure">
      <summary>Oznaczenia w treści ćwiczeń</summary>
      <div class="disclosure__body">${renderMarksLegend()}</div>
    </details>

    <div id="browse-results">${renderResults(db, filters)}</div>

    ${renderAudit(db)}`;

  const queryInput = root.querySelector('#browse-query');
  const categorySelect = root.querySelector('#browse-category');
  const levelSelect = root.querySelector('#browse-level');
  const results = root.querySelector('#browse-results');

  const currentFilters = () => ({
    query: queryInput.value.trim(),
    category: categorySelect.value,
    level: levelSelect.value,
  });

  const update = () => {
    const next = currentFilters();
    results.innerHTML = renderResults(db, next);
    app.replaceHash(browseHref(next));
  };

  queryInput.addEventListener('input', update);
  categorySelect.addEventListener('change', update);
  levelSelect.addEventListener('change', update);

  return undefined;
}

export function mountDetail(root, app, exerciseId, query) {
  const { db } = app;
  const exercise = db.exerciseById.get(exerciseId);
  const filters = readFilters(query);
  const backHref = browseHref(filters);

  if (!exercise) {
    root.innerHTML = `${renderNotice(
      'Nie znaleziono ćwiczenia',
      `Baza nie zawiera ćwiczenia o identyfikatorze "${exerciseId}".`,
      'notice--error',
    )}<a class="btn" href="${backHref}">Wróć do listy</a>`;
    return undefined;
  }

  const category = db.categoryById.get(exercise.categoryId);
  const variantViews = exercise.variants.map((variant) => ({ variant, items: variant.items }));

  root.innerHTML = `
    <h1 class="visually-hidden">Podgląd ćwiczenia</h1>
    <div class="btn-row" style="margin-bottom: var(--space-4)">
      <a class="btn btn--ghost" href="${backHref}">&#9664; Wróć do listy</a>
    </div>

    ${renderMarksToolbar(app.markMode)}

    ${renderExerciseCard(exercise, variantViews, {
      categoryName: category?.name ?? '',
      markMode: app.markMode,
      headingId: 'browse-exercise-title',
      showEditorial: true,
    })}

    <div class="panel">
      <div class="panel__head">
        <h2 class="panel__title">Metryka</h2>
      </div>
      ${renderMetaGrid([
        ['Identyfikator', exercise.id],
        ['Kategoria', category?.name ?? exercise.categoryId],
        ['Poziom', levelLabel(exercise.level)],
        ['Głoski', exercise.phonemes.join(', ') || '—'],
        ['Pozycja w wyrazie', exercise.positions.join(', ') || '—'],
        ['Losowanie pozycji', exercise.randomizable ? 'dozwolone' : 'materiał w całości'],
        ['Jakość odczytu', exercise.readQuality],
        ['Zadania', String(exercise.variants.length)],
        ['Pozycje', String(exercise.itemCount)],
        ['Plik źródłowy', exercise.source.file],
        ['Rodzaj źródła', exercise.source.kind],
        ['Publikacja', exercise.source.publication ?? '—'],
      ])}
    </div>

    <details class="disclosure">
      <summary>Surowe dane ćwiczenia</summary>
      <div class="disclosure__body">${renderRawData(exercise.raw)}</div>
    </details>`;

  attachMarkModeControl(root, app);

  return undefined;
}
