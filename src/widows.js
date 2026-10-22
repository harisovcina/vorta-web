// Typographic rule: no line of text ever ends with a single word on its own (no widows).
// 1) CSS (text-wrap: pretty / balance) does the work in browsers that support it; 2) this file makes it certain everywhere by
// gluing the last two words of every plain-text block together with a non-breaking space.
const SEL = 'p, h1, h2, h3, h4, li, blockquote, figcaption, .desc, .lead-s, .h2-s';
const NBSP = ' ';

export function glue(text) {   // 'a b c d' -> 'a b c d' (3+ words only; shorter strings are left alone)
  const t = text.replace(/\s+$/, '');
  if (t.split(/\s+/).length < 3) return text;
  return t.replace(/\s+(\S+)$/, NBSP + '$1') + text.slice(t.length);
}

export function noWidows(root = document) {
  root.querySelectorAll?.(SEL).forEach((el) => {
    if (el.childElementCount || el.dataset.nw === '0') return;   // only plain text blocks; markup is left to text-wrap
    const t = el.textContent, g = glue(t);
    if (g !== t) el.textContent = g;
  });
}

function start() {
  noWidows();
  let queued = false;   // text that is rendered later (JS-built sections) gets the same treatment
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; noWidows(); }, 150); })
    .observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
