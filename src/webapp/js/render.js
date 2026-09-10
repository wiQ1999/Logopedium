const MONTHS_GENITIVE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

const MARK_MODES = [
  { id: 'full', label: 'pełne', description: 'głoska docelowa i przedłużenia legato' },
  { id: 'target', label: 'głoska', description: 'tylko głoska docelowa' },
  { id: 'plain', label: 'czysty', description: 'tekst bez oznaczeń' },
];

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function plural(count, [one, few, many]) {
  const abs = Math.abs(count);
  if (abs === 1) {
    return one;
  }
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return few;
  }
  return many;
}

export function formatCount(count, forms) {
  return `${count} ${plural(count, forms)}`;
}

export function formatDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate));
  if (!match) {
    return String(isoDate);
  }
  const [, year, month, day] = match;
  const monthName = MONTHS_GENITIVE[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName} ${year}`;
}

export function levelLabel(level) {
  return level === null || level === undefined ? 'poziom nieokreślony' : `poziom ${level}`;
}

function block(labelText, contentHtml, modifier = '', contentClass = 'content content--small') {
  if (!contentHtml) {
    return '';
  }
  const label = labelText ? `<span class="block__label">${escapeHtml(labelText)}</span>` : '';
  return `<div class="block ${modifier}">${label}<div class="${contentClass}">${contentHtml}</div></div>`;
}

export function renderMarksToolbar(activeMode) {
  const buttons = MARK_MODES.map(
    (mode) => `<button type="button" class="marks-toolbar__btn" data-mark-mode="${mode.id}"
        aria-pressed="${mode.id === activeMode}" title="${escapeHtml(mode.description)}">${escapeHtml(mode.label)}</button>`,
  ).join('');
  return `<div class="marks-toolbar">
      <span id="marks-toolbar-label">Oznaczenia w treści:</span>
      <div class="marks-toolbar__group" role="group" aria-labelledby="marks-toolbar-label">${buttons}</div>
    </div>`;
}

export function attachMarkModeControl(root, app) {
  const toolbar = root.querySelector('.marks-toolbar');
  if (!toolbar) {
    return;
  }
  toolbar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mark-mode]');
    if (!button) {
      return;
    }
    app.markMode = button.dataset.markMode;
    toolbar.querySelectorAll('[data-mark-mode]').forEach((item) => {
      item.setAttribute('aria-pressed', String(item.dataset.markMode === app.markMode));
    });
    root.querySelectorAll('[data-marks]').forEach((card) => {
      card.dataset.marks = app.markMode;
    });
  });
}

export function renderMarksLegend() {
  const entries = [
    ['<span class="target">sz</span>', 'głoska docelowa'],
    ['<span class="legato">a</span>', 'przedłużenie w technice legato'],
    ['<span class="phonetic">ţsze</span>', 'zapis fonetyczny z oryginału'],
    ['<span class="uncertain">ucięte</span>', 'fragment nieczytelny na skanie'],
    ['<span class="breath">V</span>', 'miejsce wdechu'],
    ['<span class="exhale"></span>', 'fraza na jednym wydechu'],
    ['a<span class="juncture">|</span>b', 'granica zestroju akcentowego'],
    ['<span class="blank"></span>', 'miejsce na odpowiedź'],
  ];
  const items = entries
    .map(
      ([sample, meaning]) =>
        `<li class="marks-legend__item"><span class="marks-legend__sample">${sample}</span><span>${escapeHtml(meaning)}</span></li>`,
    )
    .join('');
  return `<ul class="marks-legend">${items}</ul>`;
}

function renderItems(variantView) {
  const { variant, items } = variantView;
  if (items.length === 0) {
    return '';
  }
  const list = items.map((item) => `<li class="items__item">${item.html}</li>`).join('');
  const total = variant.items.length;
  const note = items.length < total ? `<p class="items__note">Wylosowano ${items.length} z ${total} pozycji.</p>` : '';
  return `<ol class="items">${list}</ol>${note}`;
}

function renderExamples(variant) {
  if (variant.examples.length === 0) {
    return '';
  }
  const list = variant.examples.map((example) => `<li>${example}</li>`).join('');
  return `<div class="block"><span class="block__label">Przykłady z oryginału</span><ul class="examples content content--small">${list}</ul></div>`;
}

function renderVariant(variantView, instructionHtml) {
  const { variant } = variantView;
  const heading = variant.label ? `<h3 class="variant__label">${escapeHtml(variant.label)}</h3>` : '';
  const instruction = instructionHtml;
  const syllables = variant.syllablesHtml ? `<div class="syllables content content--small">${variant.syllablesHtml}</div>` : '';
  const text = variant.textHtml ? `<div class="content">${variant.textHtml}</div>` : '';

  return `<section class="variant">
      ${heading}
      ${block('Polecenie', instruction, 'block--instruction')}
      ${syllables}
      ${text}
      ${renderItems(variantView)}
      ${renderExamples(variant)}
      ${block('Uwaga', variant.noteHtml, 'block--note')}
    </section>`;
}

export function renderExerciseCard(exercise, variantViews, options = {}) {
  const {
    categoryName = '',
    markMode = 'full',
    headingId = 'exercise-title',
    showEditorial = false,
  } = options;

  const badges = [
    categoryName ? `<span class="chip">${escapeHtml(categoryName)}</span>` : '',
    `<span class="chip chip--neutral">${escapeHtml(levelLabel(exercise.level))}</span>`,
    exercise.readQuality === 'do_weryfikacji' ? '<span class="chip chip--warn">odczyt do weryfikacji</span>' : '',
  ]
    .filter(Boolean)
    .join('');

  const header = exercise.headerHtml
    ? `<div class="exercise-card__header-note">${exercise.headerHtml}</div>`
    : '';

  const instructions = variantViews.map((view) => view.variant.instructionHtml ?? exercise.instructionHtml ?? null);
  const shared = instructions.length > 0 && instructions.every((entry) => entry === instructions[0]) ? instructions[0] : null;
  const cardInstruction = variantViews.length === 0 ? exercise.instructionHtml : shared;

  const variants = variantViews
    .map((view, index) => renderVariant(view, shared ? null : instructions[index]))
    .join('');

  const editorial = showEditorial && exercise.notes
    ? block('Uwagi redakcyjne (nie dla ćwiczącego)', `<p>${escapeHtml(exercise.notes)}</p>`, 'block--editorial')
    : '';

  return `<article class="exercise-card" data-marks="${escapeHtml(markMode)}" aria-labelledby="${escapeHtml(headingId)}">
      <header class="exercise-card__head">
        <div>
          <div class="chip-row">${badges}</div>
          <h2 class="exercise-card__title" id="${escapeHtml(headingId)}">${escapeHtml(exercise.title)}</h2>
          ${header}
        </div>
      </header>
      ${block('Materiał wprowadzający', exercise.contextHtml, 'block--context')}
      ${block('Polecenie', cardInstruction, 'block--instruction')}
      ${variants}
      ${editorial}
    </article>`;
}

export function renderProgress(stepNumber, total, categoryName) {
  const percent = total === 0 ? 0 : Math.round((stepNumber / total) * 100);
  return `<div class="progress">
      <div class="progress__meta">
        <span>Ćwiczenie ${stepNumber} z ${total}</span>
        <span>${escapeHtml(categoryName)}</span>
      </div>
      <div class="progress__bar" role="progressbar" aria-valuenow="${stepNumber}" aria-valuemin="0" aria-valuemax="${total}"
           aria-label="Postęp sesji">
        <div class="progress__fill" style="width: ${percent}%"></div>
      </div>
    </div>`;
}

export function renderNotice(title, message, modifier = 'notice--info', issues = []) {
  const list =
    issues.length > 0
      ? `<ul class="notice__list">${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>`
      : '';
  return `<div class="notice ${modifier}" role="${modifier === 'notice--error' ? 'alert' : 'status'}">
      <h2 class="notice__title">${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      ${list}
    </div>`;
}

export function renderMetaGrid(entries) {
  const cells = entries
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(
      ([label, value]) =>
        `<div><span class="meta-grid__label">${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`,
    )
    .join('');
  return `<div class="meta-grid">${cells}</div>`;
}

export function renderRawData(value) {
  return `<pre class="raw-data" tabindex="0">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}
