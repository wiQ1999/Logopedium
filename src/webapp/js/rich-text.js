import { MARKS, MARK_SAMPLES } from './html.js';

const SHOW_TEXT = 4;
const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const usable = (editable, range) => Boolean(range) && editable.contains(range.startContainer) && editable.contains(range.endContainer);

/** Selected parts of text nodes; a node partly inside the range contributes only its selected letters. */
function textPortions(editable, range) {
  const walker = editable.ownerDocument.createTreeWalker(editable, SHOW_TEXT);
  const portions = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!range.intersectsNode(node)) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end > start) portions.push({ node, start, end });
  }
  return portions;
}

/** Splits the portions off into text nodes of their own, so marks change only the selected letters. */
const isolateText = (portions) => portions.map(({ node, start, end }) => {
  if (end < node.length) node.splitText(end);
  return start ? node.splitText(start) : node;
});

function markedAncestor(node, editable, mark) {
  for (let el = node.nodeType === 1 ? node : node.parentElement; el && el !== editable; el = el.parentElement) {
    if (el.tagName === 'SPAN' && el.classList.contains(mark)) return el;
  }
  return null;
}

function rangeAround(doc, texts) {
  const range = doc.createRange();
  range.setStart(texts[0], 0);
  range.setEnd(texts.at(-1), texts.at(-1).length);
  return range;
}

/** Marks carried by every selected letter (or by the caret position when nothing is selected). */
export function activeMarks(editable, range) {
  if (!usable(editable, range)) return new Set();
  const nodes = range.collapsed ? [range.startContainer] : textPortions(editable, range).map((p) => p.node);
  return new Set(nodes.length ? Object.keys(MARKS).filter((mark) => nodes.every((n) => markedAncestor(n, editable, mark))) : []);
}

export function applyMark(editable, range, mark) {
  if (!Object.hasOwn(MARKS, mark) || !usable(editable, range) || range.collapsed) return null;
  const texts = isolateText(textPortions(editable, range));
  if (!texts.length) return null;
  const doc = editable.ownerDocument;
  texts.forEach((text) => {
    if (markedAncestor(text, editable, mark)) return;
    const span = doc.createElement('span');
    span.className = mark;
    text.replaceWith(span);
    span.append(text);
  });
  return rangeAround(doc, texts);
}

const keepsContent = (el) => el.textContent !== '' || el.querySelector('br, .blank, .exhale');
/** Splitting leaves empty copies of partly covered elements behind; standalone blank/exhale markers stay. */
function pruneEmpty(el) {
  [...el.querySelectorAll('*')].reverse().forEach((node) => {
    if (node.tagName !== 'BR' && !node.matches('.blank, .exhale') && !keepsContent(node)) node.remove();
  });
  return el;
}

/** Lifts the selected letters out of the mark; the unselected rest of the span keeps it. */
export function removeMark(editable, range, mark) {
  if (!Object.hasOwn(MARKS, mark) || !usable(editable, range) || range.collapsed) return null;
  const texts = isolateText(textPortions(editable, range));
  if (!texts.length) return null;
  const doc = editable.ownerDocument;
  for (const text of texts) {
    let span;
    while ((span = markedAncestor(text, editable, mark))) {
      // extractContents clones the partly covered elements between the span and the text.
      const before = doc.createRange(); before.setStart(span, 0); before.setEndBefore(text);
      const after = doc.createRange(); after.setStartAfter(text); after.setEnd(span, span.childNodes.length);
      const tail = span.cloneNode(false); tail.append(after.extractContents());
      const head = span.cloneNode(false); head.append(before.extractContents());
      if (keepsContent(pruneEmpty(tail))) span.after(tail);
      if (keepsContent(pruneEmpty(head))) span.before(head);
      if (span.classList.length > 1) span.classList.remove(mark);
      else span.replaceWith(...[...span.childNodes]);
    }
  }
  return rangeAround(doc, texts);
}

/** Applies the mark, or removes it when every selected letter already has it (like Bold in a word processor). */
export function toggleMark(editable, range, mark) {
  return activeMarks(editable, range).has(mark) && !range.collapsed ? removeMark(editable, range, mark) : applyMark(editable, range, mark);
}

// Shorter samples than in the legend, so the whole toolbar fits one row on a phone.
const BUTTON_SAMPLES = { ...MARK_SAMPLES, phonetic: '<span class="phonetic">ţs</span>', uncertain: '<span class="uncertain">uc</span>' };

/** Toolbar built into the field's frame; each button shows the mark as it looks in the material. */
export function renderMarkToolbar(targetId, label) {
  const buttons = Object.entries(MARKS).map(([mark, name], index) =>
    `<button class="mark-button" type="button" data-mark="${mark}" title="${escapeAttr(name)}" aria-label="${escapeAttr(name)}" aria-pressed="false" tabindex="${index ? -1 : 0}"><span class="mark-button__sample" aria-hidden="true">${BUTTON_SAMPLES[mark]}</span></button>`).join('');
  return `<div class="rich-editor__toolbar" role="toolbar" aria-label="Oznaczenia — ${escapeAttr(label)}" aria-controls="${targetId}">${buttons}</div>`;
}

export function showActiveMarks(toolbar, marks) {
  toolbar.querySelectorAll('[data-mark]').forEach((button) => button.setAttribute('aria-pressed', String(marks.has(button.dataset.mark))));
}

/**
 * Keyboard access in the pattern of a toolbar: arrows and Home/End move between buttons,
 * Escape returns to the text, Alt+F10 in the text jumps to the toolbar.
 */
export function attachToolbarKeys(toolbar, editable) {
  const buttons = [...toolbar.querySelectorAll('[data-mark]')];
  const focusButton = (button) => {
    buttons.forEach((b) => { b.tabIndex = b === button ? 0 : -1; });
    button.focus();
  };
  toolbar.addEventListener('keydown', (event) => {
    const index = buttons.indexOf(event.target.closest?.('[data-mark]'));
    if (index < 0) return;
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: buttons.length - 1 }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      focusButton(buttons[(next + buttons.length) % buttons.length]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      editable.focus();
    }
  });
  editable.addEventListener('keydown', (event) => {
    if (event.key === 'F10' && event.altKey) {
      event.preventDefault();
      focusButton(buttons.find((b) => b.tabIndex === 0) ?? buttons[0]);
    }
  });
}
