// The DOM natives behind `cheerio` for test/harness.js, done with the cheerio npm package
// (the app does them with SwiftSoup). Text is normalized like jsoup's text(): whitespace
// collapsed and trimmed, elements joined with a space.
//   createRuntime({ code, natives: require('./dom-natives')() })
'use strict';
const cheerio = require('cheerio');

module.exports = function createDomNatives() {
  const nodes = new Map();
  const idOf = new WeakMap();
  let seq = 0;
  const reg = (node, $) => {
    let id = idOf.get(node);
    if (!id) { id = `n${++seq}`; idOf.set(node, id); nodes.set(id, { node, $ }); }
    return id;
  };
  const at = (id) => nodes.get(String(id)) || { node: null, $: null };
  const list = ($, sel) => JSON.stringify(sel.toArray().map((n) => reg(n, $)));
  const single = ($, sel) => (sel.length ? reg(sel[0], $) : '__NONE__');
  const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  return {
    domLoad(html) { const $ = cheerio.load(String(html)); return reg($.root()[0], $); },
    domSelect(docId, selector) { const { node, $ } = at(docId); return node ? list($, $(node).find(selector)) : '[]'; },
    domFind(id, selector) { const { node, $ } = at(id); return node ? list($, $(node).find(selector)) : '[]'; },
    domChildren(id, selector) { const { node, $ } = at(id); return node ? list($, selector ? $(node).children(selector) : $(node).children()) : '[]'; },
    domParent(id) { const { node, $ } = at(id); return node ? single($, $(node).parent()) : '__NONE__'; },
    domParents(id, selector) { const { node, $ } = at(id); return node ? list($, selector ? $(node).parents(selector) : $(node).parents()) : '[]'; },
    domClosest(id, selector) { const { node, $ } = at(id); return node ? single($, $(node).closest(selector)) : '__NONE__'; },
    domSiblings(id, selector) { const { node, $ } = at(id); return node ? list($, selector ? $(node).siblings(selector) : $(node).siblings()) : '[]'; },
    domNext(id) { const { node, $ } = at(id); return node ? single($, $(node).next()) : '__NONE__'; },
    domPrev(id) { const { node, $ } = at(id); return node ? single($, $(node).prev()) : '__NONE__'; },
    domText(ids) { return String(ids).split(',').map((i) => { const { node, $ } = at(i); return node ? norm($(node).text()) : ''; }).filter(Boolean).join(' '); },
    domHtml(id) { const { node, $ } = at(id); return node ? $(node).html() : null; },
    domOuterHtml(id) { const { node, $ } = at(id); if (!node) return ''; return node.type === 'root' ? $.html() : $.html(node); },
    domAttr(id, name) { const { node, $ } = at(id); const v = node ? $(node).attr(name) : undefined; return v === undefined ? '__UNDEFINED__' : v; },
    domIs(id, selector) { const { node, $ } = at(id); return !!node && $(node).is(selector); }
  };
};
