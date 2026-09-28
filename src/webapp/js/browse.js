import { normalizeText } from './data.js';
import { createExerciseDraft, mountEditor, NEW_CATEGORY } from './editor.js';
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

/** Adding material starts in the editor: nothing reaches the file until the new exercise is saved there. */
function renderAddForm(db, filters) {
  const selected = filters.category || db.categories[0]?.id;
  const options = db.categories.map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === selected ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
  return `<details class="disclosure" id="browse-add">
      <summary>Dodaj ćwiczenie lub kategorię</summary>
      <div class="disclosure__body">
        <form class="add-form" id="add-exercise" novalidate>
          <div class="field">
            <label class="field__label" for="add-title">Tytuł nowego ćwiczenia</label>
            <input class="input" type="text" id="add-title" autocomplete="off">
          </div>
          <div class="field">
            <label class="field__label" for="add-category">Kategoria</label>
            <select class="select" id="add-category">${options}<option value="${NEW_CATEGORY}">nowa kategoria…</option></select>
          </div>
          <div class="field" id="add-category-name-field" hidden>
            <label class="field__label" for="add-category-name">Nazwa nowej kategorii</label>
            <input class="input" type="text" id="add-category-name" autocomplete="off">
          </div>
          <div id="add-errors"></div>
          <div class="btn-row"><button class="btn btn--primary" type="submit">Utwórz w edytorze</button></div>
          <p class="panel__hint">Ćwiczenie powstaje w edytorze z jednym pustym wariantem; do pliku bazy trafi dopiero po zapisie.</p>
        </form>
      </div>
    </details>`;
}

function attachAddForm(root, app, currentFilters) {
  const form = root.querySelector('#add-exercise');
  if (!form) return;
  const category = form.querySelector('#add-category');
  const nameField = form.querySelector('#add-category-name-field');
  const errors = form.querySelector('#add-errors');
  category.addEventListener('change', () => {
    nameField.hidden = category.value !== NEW_CATEGORY;
    if (!nameField.hidden) nameField.querySelector('input').focus();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { issues, state } = createExerciseDraft(app.db, {
      title: form.querySelector('#add-title').value,
      categoryId: category.value,
      categoryName: form.querySelector('#add-category-name').value,
    });
    if (issues.length) {
      errors.innerHTML = renderNotice('Nie można utworzyć ćwiczenia', 'Uzupełnij formularz:', 'notice--error', issues);
      return;
    }
    app.editorDraft = state;
    const detailHref = browseHref(currentFilters(), state.exercise.id);
    app.navigate(`${detailHref}${detailHref.includes('?') ? '&' : '?'}edit=1`);
  });
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

    ${db.writable ? renderAddForm(db, filters) : ''}

    <details class="disclosure">
      <summary>Oznaczenia w treści ćwiczeń</summary>
      <div class="disclosure__body">${renderMarksLegend()}</div>
    </details>

    <div id="browse-results">${renderResults(db, filters)}</div>`;

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
  attachAddForm(root, app, currentFilters);

  return undefined;
}

export function mountDetail(root, app, exerciseId, query) {
  const { db } = app;
  const exercise = db.exerciseById.get(exerciseId);
  const filters = readFilters(query);
  const backHref = browseHref(filters);

  // A new exercise lives only in the editor's draft until it is saved to the file.
  if (!exercise && query.get('edit') === '1' && app.editorDraft?.saved === null && app.editorDraft.exercise.id === exerciseId) {
    return mountEditor(root, app, exerciseId, null, backHref);
  }
  if (!exercise) {
    root.innerHTML = `${renderNotice(
      'Nie znaleziono ćwiczenia',
      `Baza nie zawiera ćwiczenia o identyfikatorze "${exerciseId}".`,
      'notice--error',
    )}<a class="btn" href="${backHref}">Wróć do listy</a>`;
    return undefined;
  }

  const detailHref = browseHref(filters, exerciseId);
  if (query.get('edit') === '1') return mountEditor(root, app, exerciseId, query.get('variant'), detailHref);
  const editHref = `${detailHref}${detailHref.includes('?') ? '&' : '?'}edit=1`;

  const category = db.categoryById.get(exercise.categoryId);
  const variantViews = exercise.variants.map((variant) => ({ variant, items: variant.items }));

  root.innerHTML = `
    <h1 class="visually-hidden">Podgląd ćwiczenia</h1>
    <div class="btn-row" style="margin-bottom: var(--space-4)">
      <a class="btn btn--ghost" href="${backHref}">&#9664; Wróć do listy</a>
      ${db.writable ? `<a class="btn" href="${escapeHtml(editHref)}">Edytuj ćwiczenie</a>` : ''}
    </div>

    ${renderMarksToolbar(app.markMode)}

    ${renderExerciseCard(exercise, variantViews, {
      categoryName: category?.name ?? '',
      markMode: app.markMode,
      headingId: 'browse-exercise-title',
      editVariantHref: db.writable ? (id) => `${editHref}&variant=${encodeURIComponent(id)}` : undefined,
    })}

    <div class="panel">
      <div class="panel__head">
        <h2 class="panel__title">Metryka</h2>
      </div>
      ${renderMetaGrid([
        ['Identyfikator', exercise.id],
        ['Kategoria', category?.name ?? exercise.categoryId],
        ['Poziom', levelLabel(exercise.level)],
        ['Losowanie pozycji', exercise.randomizable ? 'dozwolone' : 'materiał w całości'],
        ['Jakość odczytu', exercise.readQuality],
        ['Zadania', String(exercise.variants.length)],
        ['Pozycje', String(exercise.itemCount)],
      ])}
    </div>

    <details class="disclosure">
      <summary>Surowe dane ćwiczenia</summary>
      <div class="disclosure__body">${renderRawData(exercise.raw)}</div>
    </details>`;

  attachMarkModeControl(root, app);

  return undefined;
}
