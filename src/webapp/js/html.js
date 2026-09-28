export const MARKS = {
  target: 'Głoska docelowa', legato: 'Przedłużenie legato', phonetic: 'Zapis fonetyczny',
  uncertain: 'Fragment nieczytelny', breath: 'Miejsce wdechu', exhale: 'Fraza na wydechu',
  blank: 'Miejsce na odpowiedź', juncture: 'Granica zestroju',
};
/** How each mark looks in the material; shared by the legend and the editor's toolbar buttons. */
export const MARK_SAMPLES = {
  target: '<span class="target">sz</span>', legato: '<span class="legato">a</span>',
  phonetic: '<span class="phonetic">ţsze</span>', uncertain: '<span class="uncertain">ucięte</span>',
  breath: '<span class="breath">V</span>', exhale: '<span class="exhale"></span>',
  blank: '<span class="blank"></span>', juncture: 'a<span class="juncture">|</span>b',
};
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Closed HTML grammar shared by load, preview and export; no executable attributes or URLs. */
export function sanitizeHtml(value) {
  const source = String(value ?? '');
  const stack = [];
  const issues = [];
  const output = [];
  for (const token of source.match(/<[^>]*>|[^<]+|</g) ?? []) {
    if (!token.startsWith('<')) { output.push(token); continue; }
    if (token === '<') { output.push('&lt;'); continue; }
    const close = /^<\/(p|span|strong|em)\s*>$/i.exec(token);
    if (close) {
      if (stack.pop() !== close[1].toLowerCase()) issues.push('Nieprawidłowe zagnieżdżenie znaczników.');
      output.push(`</${close[1].toLowerCase()}>`); continue;
    }
    const plain = /^<(p|br|strong|em)\s*\/?\s*>$/i.exec(token);
    const span = /^<span(?:\s+class\s*=\s*(?:"([a-z ]*)"|'([a-z ]*)'))?(?:\s+title\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)'))?\s*>$/i.exec(token);
    if (!plain && !span) { issues.push('Niedozwolony znacznik lub atrybut HTML.'); continue; }
    const tag = plain ? plain[1].toLowerCase() : 'span';
    const classes = span ? (span[1] ?? span[2] ?? '').split(' ').filter(Boolean) : [];
    if (classes.some((c) => !Object.hasOwn(MARKS, c))) issues.push('Nieznana klasa oznaczenia.');
    if (tag === 'p' && stack.length) issues.push('Akapit nie może być zagnieżdżony w innym znaczniku.');
    if (tag !== 'br') stack.push(tag);
    const title = span?.[3] ?? span?.[4];
    output.push(`<${tag}${classes.length ? ` class="${[...new Set(classes)].join(' ')}"` : ''}${title !== undefined ? ` title="${title.replace(/"/g, '&quot;')}"` : ''}>`);
  }
  if (stack.length) issues.push('Niezamknięty znacznik HTML.');
  if (issues.length) return { html: escape(source), issues: [...new Set(issues)] };
  let html = output.join('');
  // Empty blank/exhale spans carry visible, meaningful CSS markers in the source database.
  let previous;
  do {
    previous = html;
    html = html.replace(/<(span|p|strong|em)(\s+class="([a-z ]*)")?(?:\s+title="[^"]*")?><\/\1>/g,
      (match, tag, attr, classes = '') => classes.split(' ').some((c) => c === 'blank' || c === 'exhale') ? match : '');
  } while (html !== previous);
  return { html, issues: [] };
}

const LINE_ENDS = /^<(br\s*\/?|\/p\s*)>$/i;
const hasContent = (tokens) => tokens.some((t) => t.startsWith('<') ? /class="[^"]*\b(blank|exhale)\b/.test(t) : /\S/.test(t));

/**
 * Shortens sanitized HTML to a sample: at most `chars` visible characters and `lines` lines,
 * cut at a word boundary, with every open tag closed. `truncated` says whether anything was left out.
 */
export function truncateHtml(html, { chars = 240, lines = 4 } = {}) {
  const tokens = String(html ?? '').match(/<[^>]*>|[^<]+/g) ?? [];
  const out = [];
  const open = [];
  let used = 0;
  let breaks = 0;
  const stop = () => ({ html: `${out.join('').replace(/\s+$/, '')}…${open.reverse().map((tag) => `</${tag}>`).join('')}`, truncated: true });
  for (const [index, token] of tokens.entries()) {
    const rest = tokens.slice(index + 1);
    if (!token.startsWith('<')) {
      const units = token.match(/&[#a-z0-9]+;|[\s\S]/gi);
      if (used + units.length <= chars || !hasContent([token, ...rest])) { out.push(token); used += units.length; continue; }
      const taken = units.slice(0, chars - used).join('');
      const space = taken.lastIndexOf(' ');
      out.push(space > 0 ? taken.slice(0, space) : taken);
      return stop();
    }
    if (LINE_ENDS.test(token)) {
      if (breaks + 1 >= lines && hasContent(rest)) return stop();
      breaks += 1;
    }
    const tag = /^<\/?([a-z]+)/i.exec(token)[1].toLowerCase();
    if (token.startsWith('</')) open.pop();
    else if (tag !== 'br') open.push(tag);
    out.push(token);
  }
  return { html: out.join(''), truncated: false };
}

/** Visits only schema fields that contain markup, retaining all other JSON data verbatim. */
export function visitHtml(raw, visit) {
  for (const [ei, e] of (raw.exercises ?? []).entries()) {
    for (const field of ['headerHtml', 'contextHtml', 'instructionHtml']) if (typeof e?.[field] === 'string') visit(e, field, `exercises[${ei}].${field}`);
    for (const [vi, v] of (Array.isArray(e?.variants) ? e.variants : []).entries()) {
      const path = `exercises[${ei}].variants[${vi}]`;
      for (const field of ['instructionHtml', 'syllablesHtml', 'textHtml']) if (typeof v?.[field] === 'string') visit(v, field, `${path}.${field}`);
      for (const [i, item] of (Array.isArray(v?.items) ? v.items : []).entries()) if (typeof item?.html === 'string') visit(item, 'html', `${path}.items[${i}].html`);
      if (Array.isArray(v?.examples)) v.examples.forEach((s, i) => { if (typeof s === 'string') visit(v.examples, i, `${path}.examples[${i}]`); });
    }
  }
}
