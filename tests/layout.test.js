import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';
import { JSDOM } from 'jsdom';
import { bootApp } from './dom-helpers.js';

const readCss = (name) => readFileSync(new URL(`../src/webapp/css/${name}`, import.meta.url), 'utf8');
const sheet = (css) => new JSDOM(`<style>${css}</style>`).window.document.styleSheets[0];
const base = sheet(readCss('base.css'));
const layout = sheet(readCss('layout.css'));

/** Reguły stylu arkusza wraz z warunkiem @media, w którym stoją ('' poza nim). */
function rules(styleSheet) {
  const out = [];
  const walk = (list, media) => {
    for (const rule of list) {
      if (rule.media && rule.cssRules) walk(rule.cssRules, rule.media.mediaText);
      else if (rule.selectorText) out.push({ selectors: rule.selectorText.split(',').map((s) => s.trim()), style: rule.style, media });
    }
  };
  walk(styleSheet.cssRules, '');
  return out;
}

const DESKTOP = '(min-width: 1200px)';
const declared = (selector, property, media = '') => rules(layout)
  .filter((rule) => rule.media === media && rule.selectors.includes(selector))
  .map((rule) => rule.style.getPropertyValue(property))
  .filter(Boolean);

const rootValue = (name) => rules(base).find((rule) => rule.media === '' && rule.selectors.includes(':root')).style.getPropertyValue(name).trim();
const px = (value) => {
  const space = value.match(/^var\((--space-\d)\)$/);
  return Number.parseFloat(space ? rootValue(space[1]) : value);
};

/** Margines boczny strony przy danej szerokości okna — z clamp() zmiennej --gutter w base.css. */
function gutterAt(viewport) {
  const [min, preferred, max] = rootValue('--gutter').match(/^clamp\((.*)\)$/)[1].split(/,\s*/);
  const [, vw, offset] = preferred.match(/^([\d.]+)vw - (.+)$/);
  return Math.min(Math.max(px(min), (Number(vw) / 100) * viewport - px(offset)), px(max));
}

describe('szerokość strony', () => {
  it('nagłówek, treść i stopka nie mają stałej szerokości kolumny', () => {
    for (const selector of ['.app-header__inner', '.app-main', '.app-footer__inner']) {
      assert.deepEqual(declared(selector, 'max-width'), [], selector);
      assert.match(declared(selector, 'padding').join(), /var\(--gutter\)/, selector);
    }
    assert.equal(rootValue('--content-width'), '');
  });

  it('margines boczny zostaje 16 px na telefonie i rośnie z oknem do 48 px', () => {
    for (const width of [320, 375, 414, 640, 800]) assert.equal(gutterAt(width), 16, `${width} px`);
    assert.equal(gutterAt(1280), 35.2);
    assert.equal(gutterAt(1920), 48);
    assert.equal(gutterAt(3840), 48);
  });
});

describe('układ desktopowy', () => {
  it('parametry sesji dzielą się na listę bloków i kolumnę ustawień ze startem', () => {
    assert.equal(declared('.params-layout', 'display', DESKTOP)[0], 'grid');
    assert.equal(declared('.params-layout__blocks', 'grid-column', DESKTOP)[0], '1');
    assert.equal(declared('.params-layout__session', 'position', DESKTOP)[0], 'sticky');
    assert.equal(declared('.params-layout', 'display').length, 0, 'poza desktopem układ zostaje jednokolumnowy');
  });

  it('listy rozkładają się na kolumny, a tekst ciągły zachowuje czytelną długość wiersza', () => {
    const itemRules = rules(layout).filter((rule) => rule.selectors.some((selector) => selector.startsWith('.items')));
    assert.ok(itemRules.every((rule) => !rule.style.getPropertyValue('grid-template-columns') && rule.style.getPropertyValue('display') !== 'grid'),
      'pozycje ćwiczenia zawsze jedna pod drugą');
    for (const selector of ['.browse-list', '.summary-list']) {
      assert.equal(declared(selector, 'display', DESKTOP)[0], 'grid', selector);
      assert.match(declared(selector, 'grid-template-columns', DESKTOP)[0], /auto-fill/, selector);
    }
    assert.equal(declared('.exercise-card .content', 'max-width', DESKTOP)[0], '75ch');
  });
});

describe('formularz parametrów', () => {
  const apps = [];
  after(() => apps.forEach((app) => app.teardown()));

  it('zachowuje na telefonie kolejność: ustawienia, bloki, ziarno, oznaczenia, start', async () => {
    const app = await bootApp({ hash: '#/params' });
    apps.push(app);
    const regions = [...app.query('#params-form').children].map((element) => element.className);
    assert.deepEqual(regions, ['panel field-grid params-layout__settings', 'panel params-layout__blocks', 'params-layout__session']);
    assert.ok(app.query('.params-layout__settings #param-date'));
    assert.ok(app.query('.params-layout__blocks #params-list'));
    const session = app.query('.params-layout__session');
    assert.deepEqual([...session.children].map((element) => element.className), ['disclosure', 'disclosure', 'params-summary']);
    assert.ok(session.querySelector('#param-seed'));
    assert.ok(session.querySelector('#params-submit[type="submit"]'));
  });
});
