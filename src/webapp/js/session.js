import {
  attachMarkModeControl,
  escapeHtml,
  formatDate,
  plural,
  renderExerciseCard,
  renderMarksToolbar,
  renderNotice,
  renderProgress,
} from './render.js';

export function mountExercise(root, app, stepIndex) {
  const { plan } = app;
  const total = plan.steps.length;
  const step = plan.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  root.innerHTML = `
    <h1 class="visually-hidden">Sesja ćwiczeń — ćwiczenie ${stepIndex + 1} z ${total}</h1>
    ${renderProgress(stepIndex + 1, total, step.category?.name ?? '')}
    ${renderMarksToolbar(app.markMode)}
    ${renderExerciseCard(step.exercise, step.variants, {
      categoryName: step.category?.name ?? '',
      markMode: app.markMode,
      headingId: 'session-exercise-title',
    })}
    <nav class="step-nav" aria-label="Nawigacja sesji">
      <button type="button" class="btn" data-role="prev" ${isFirst ? 'disabled' : ''}>&#9664; Poprzednie</button>
      <a class="btn btn--ghost" href="#/params">Zmień parametry</a>
      <button type="button" class="btn btn--primary" data-role="next">
        ${isLast ? 'Zakończ sesję' : 'Dalej &#9654;'}
      </button>
    </nav>`;

  const goPrev = () => {
    if (!isFirst) {
      app.navigate(app.sessionHref(stepIndex));
    }
  };
  const goNext = () => {
    app.navigate(isLast ? app.summaryHref() : app.sessionHref(stepIndex + 2));
  };

  root.querySelector('[data-role="prev"]').addEventListener('click', goPrev);
  root.querySelector('[data-role="next"]').addEventListener('click', goNext);
  attachMarkModeControl(root, app);

  const onKeyDown = (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      goPrev();
    } else if (event.key === 'ArrowRight') {
      goNext();
    }
  };

  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}

export function mountSummary(root, app) {
  const { plan } = app;
  const steps = plan.steps;

  if (steps.length === 0) {
    root.innerHTML = renderNotice('Brak ćwiczeń', 'Sesja nie zawiera żadnych ćwiczeń. Zmień parametry i spróbuj ponownie.');
    return undefined;
  }

  const categories = new Set(steps.map((step) => step.category?.id));
  const list = steps
    .map(
      (step, index) => `<li class="summary-list__item">
          <span class="summary-list__index">${index + 1}.</span>
          <span><a href="#/browse/${encodeURIComponent(step.exercise.id)}">${escapeHtml(step.exercise.title)}</a></span>
          <span class="summary-list__cat">${escapeHtml(step.category?.name ?? '')}</span>
        </li>`,
    )
    .join('');

  root.innerHTML = `
    <section class="view-head">
      <h1>Sesja zakończona</h1>
      <p class="view-head__lead">Zestaw z ${escapeHtml(formatDate(plan.params.date))} został przerobiony w całości.</p>
    </section>

    <div class="panel">
      <div class="summary-stats">
        <div class="summary-stat">
          <span class="summary-stat__value">${steps.length}</span>
          <span class="summary-stat__label">${plural(steps.length, ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'])}</span>
        </div>
        <div class="summary-stat">
          <span class="summary-stat__value">${categories.size}</span>
          <span class="summary-stat__label">kategorii</span>
        </div>
        <div class="summary-stat">
          <span class="summary-stat__value">${plan.params.level}</span>
          <span class="summary-stat__label">poziom trudności</span>
        </div>
      </div>
      <ol class="summary-list">${list}</ol>
    </div>

    <div class="panel">
      <div class="panel__head">
        <h2 class="panel__title">Co dalej</h2>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn--primary" data-role="repeat">Powtórz ten zestaw</button>
        <button type="button" class="btn" data-role="reroll">Wylosuj nowy zestaw na ten dzień</button>
        <a class="btn btn--ghost" href="#/params">Zmień parametry</a>
      </div>
      <p class="field__hint" style="margin-top: var(--space-3)">Ziarno losowania: <code>${escapeHtml(plan.seed)}</code></p>
    </div>`;

  root.querySelector('[data-role="repeat"]').addEventListener('click', () => {
    app.navigate(app.sessionHref(1));
  });

  root.querySelector('[data-role="reroll"]').addEventListener('click', () => {
    app.rerollSession();
  });

  return undefined;
}
