export const MARKS = {
  target: 'Głoska docelowa', legato: 'Przedłużenie legato', phonetic: 'Zapis fonetyczny',
  uncertain: 'Fragment nieczytelny', breath: 'Miejsce wdechu', exhale: 'Fraza na wydechu',
  blank: 'Miejsce na odpowiedź', juncture: 'Granica zestroju',
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

/** Visits only schema fields that contain markup, retaining all other JSON data verbatim. */
export function visitHtml(raw, visit) {
  for (const [ei, e] of (raw.exercises ?? []).entries()) {
    for (const field of ['headerHtml', 'contextHtml', 'instructionHtml']) if (typeof e?.[field] === 'string') visit(e, field, `exercises[${ei}].${field}`);
    for (const [vi, v] of (Array.isArray(e?.variants) ? e.variants : []).entries()) {
      const path = `exercises[${ei}].variants[${vi}]`;
      for (const field of ['instructionHtml', 'syllablesHtml', 'textHtml', 'noteHtml']) if (typeof v?.[field] === 'string') visit(v, field, `${path}.${field}`);
      for (const [i, item] of (Array.isArray(v?.items) ? v.items : []).entries()) if (typeof item?.html === 'string') visit(item, 'html', `${path}.items[${i}].html`);
      if (Array.isArray(v?.examples)) v.examples.forEach((s, i) => { if (typeof s === 'string') visit(v.examples, i, `${path}.examples[${i}]`); });
    }
  }
}
