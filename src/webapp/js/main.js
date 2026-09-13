import { mountDetail, mountList } from './browse.js';
import { DatabaseError, loadDatabase } from './data.js';
import {
  createDefaultParams,
  decodeParams,
  encodeParams,
  loadStoredParams,
  mount as mountParams,
  paramsSignature,
  totalExercises,
} from './params.js';
import { buildPlan } from './picker.js';
import { escapeHtml, formatCount, renderNotice } from './render.js';
import { randomToken } from './rng.js';
import { mountExercise, mountSummary } from './session.js';

const root = document.querySelector('#app-main');
const nav = document.querySelector('#app-nav');
const footer = document.querySelector('#app-footer-info');

let cleanup = null;
let firstRender = true;

const app = {
  db: null,
  params: null,
  plan: null,
  markMode: 'full',

  navigate(href) {
    if (window.location.hash === href) {
      render();
      return;
    }
    window.location.hash = href;
  },

  replaceHash(href) {
    window.history.replaceState(null, '', href);
  },

  sessionQuery() {
    const encoded = encodeParams(app.plan.params);
    const parts = [`d=${encoded.d}`, `l=${encoded.l}`, `c=${encoded.c}`, `o=${encoded.o}`];
    if (app.plan.seedOverride) {
      parts.push(`seed=${encodeURIComponent(app.plan.seedOverride)}`);
    }
    return parts.join('&');
  },

  sessionHref(stepNumber) {
    return `#/session/${stepNumber}?${app.sessionQuery()}`;
  },

  summaryHref() {
    return `#/summary?${app.sessionQuery()}`;
  },

  startSession(nextParams, seedOverride = null) {
    app.params = nextParams;
    app.plan = buildPlan(app.db, nextParams, seedOverride);
    app.navigate(app.sessionHref(1));
  },

  rerollSession() {
    app.startSession(app.plan.params, randomToken());
  },
};

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/params';
  const separator = raw.indexOf('?');
  const path = separator === -1 ? raw : raw.slice(0, separator);
  const queryString = separator === -1 ? '' : raw.slice(separator + 1);
  return {
    segments: path.split('/').filter(Boolean).map(decodeURIComponent),
    query: new URLSearchParams(queryString),
  };
}

function ensurePlan(query) {
  const requested = decodeParams(query, app.db);
  const seedOverride = query.get('seed') || null;
  const signature = paramsSignature(requested);
  const planMatches =
    app.plan && app.plan.signature === signature && (app.plan.seedOverride ?? null) === seedOverride;

  if (!planMatches) {
    app.params = requested;
    app.plan = buildPlan(app.db, requested, seedOverride);
  }
  return app.plan;
}

function setActiveNav(mode) {
  nav.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === mode) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function renderFooter() {
  const { db } = app;
  footer.innerHTML = `<span>Baza: schemat ${escapeHtml(db.schemaVersion)}, wygenerowana ${escapeHtml(db.generated)}</span>
    <span>${formatCount(db.stats.exerciseCount, ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'])}
      w ${formatCount(db.stats.categoryCount, ['kategorii', 'kategoriach', 'kategoriach'])}</span>
    <span>Materiał chroniony prawem autorskim — do użytku własnego.</span>`;
}

function renderSessionRoute(segments, query) {
  const plan = ensurePlan(query);

  if (plan.steps.length === 0) {
    app.navigate('#/params');
    return;
  }

  const requested = Number.parseInt(segments[1] ?? '1', 10);
  const stepNumber = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), plan.steps.length) : 1;

  if (String(stepNumber) !== segments[1]) {
    app.replaceHash(app.sessionHref(stepNumber));
  }

  cleanup = mountExercise(root, app, stepNumber - 1);
}

function render() {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }

  const { segments, query } = parseHash();
  const [route] = segments;

  switch (route) {
    case 'browse':
      setActiveNav('browse');
      cleanup = segments.length > 1 ? mountDetail(root, app, segments[1], query) : mountList(root, app, query);
      break;
    case 'session':
      setActiveNav('session');
      renderSessionRoute(segments, query);
      break;
    case 'summary': {
      setActiveNav('session');
      const plan = ensurePlan(query);
      if (plan.steps.length === 0) {
        app.navigate('#/params');
        return;
      }
      cleanup = mountSummary(root, app);
      break;
    }
    case 'params':
      setActiveNav('session');
      cleanup = mountParams(root, app);
      break;
    default:
      app.replaceHash('#/params');
      setActiveNav('session');
      cleanup = mountParams(root, app);
      break;
  }

  window.scrollTo({ top: 0, behavior: 'auto' });
  if (!firstRender) {
    root.focus();
  }
  firstRender = false;
}

function renderLoadError(error) {
  const issues = error instanceof DatabaseError ? error.issues : [String(error?.message ?? error)];
  const message =
    error instanceof DatabaseError ? error.message : 'Wystąpił nieoczekiwany błąd podczas wczytywania bazy.';
  root.innerHTML = renderNotice('Nie można uruchomić aplikacji', message, 'notice--error', issues);
  footer.innerHTML = '<span>Baza nie została wczytana.</span>';
}

async function start() {
  try {
    app.db = await loadDatabase();
  } catch (error) {
    renderLoadError(error);
    return;
  }

  const defaults = createDefaultParams(app.db);
  if (totalExercises(defaults) === 0) {
    renderLoadError(new DatabaseError('Baza nie zawiera ćwiczeń możliwych do wylosowania.', []));
    return;
  }
  app.params = loadStoredParams(app.db) ?? defaults;

  renderFooter();
  window.addEventListener('hashchange', render);
  render();
}

start();
