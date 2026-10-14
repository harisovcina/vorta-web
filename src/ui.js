// Vorta UI layer: loader -> rounded-rect reveal -> auto-played intro -> scroll hint -> frame-synced steps.
// Everything that moves is a GSAP tween/timeline (loader count, reveal, titles, stepper, hint, scroll scrub).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './site.css';
import { initSite } from './site.js';
gsap.registerPlugin(ScrollTrigger);

// ---------- story map (Blender frames, 24 fps) ----------
export const INTRO_END = 215;     // truck stops at the warehouse door (~f210); the intro plays 1 -> INTRO_END by itself
export const STORY_END = 960;     // truck is parked from ~f889; stop a bit after it arrives
const INTRO_START = 20;           // the truck sits still until ~f25, so the intro starts here instead of f1
const INTRO_SECONDS = 5.0;        // real time for the auto-played intro (f20 -> INTRO_END); whole entrance = 9 s
// Step boundaries follow the truck's legs: dock -> open road -> first corner (dusk) -> city at night -> arrival.
// Copy is placeholder.
export const STEPS = [
  { from: INTRO_END, tag: 'Dispatch',  title: 'Loaded and ready to roll', desc: 'Every shipment starts at the dock. Cargo is scanned, sealed and on the road in minutes.' },
  { from: 380,       tag: 'Open road', title: 'Miles of clear road',      desc: 'Live tracking follows the truck from the first kilometre, so you always know where it is.' },
  { from: 505,       tag: 'Dusk',      title: 'Routed around the rush',   desc: 'As daylight fades, smart routing threads the route around traffic before it builds.' },
  { from: 645,       tag: 'Night',     title: 'The city after dark',      desc: 'Through lit-up streets and quiet junctions, the last miles are the most precise.' },
  { from: 770,       tag: 'Arrival',   title: 'Right on the door',        desc: 'Delivered on time, signed for and confirmed. Door to door, start to finish.' },
];
const HERO = { tag: 'Vorta', title: 'Every mile, in motion', desc: 'Follow one delivery from the dock to the door.' };

const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement;
const qs = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (qs.has('debug')) root.classList.add('debug');
if (qs.get('veil') === '0') document.getElementById('veil').style.display = 'none';   // perf A/B: ?veil=0
if (qs.has('nolag')) gsap.ticker.lagSmoothing(0);   // test rigs with software GL: keep tweens on wall-clock time

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
root.classList.add('is-locked');

// ================= loader: blueprint guides form, the Vorta logo draws itself, fills in, catches a glint =================
window.__hold3D = true;                               // main.js idles the 3D render while the loader is up
const L = { target: 0, expected: 1, done: 0, finishing: false, resolve: null };
const ldNum = $('#ldNum'), loaderEl = $('#loader'), logo = $('#ldLogo');
const finished = new Promise((r) => { L.resolve = r; });
const counter = { v: 0 };
const SVGNS = 'http://www.w3.org/2000/svg';
const fillG = $('.ld-fill', logo);
// clip for the glint: the glyph shapes themselves
const clip = $('#ldClip', logo);
[...fillG.children].forEach((p) => clip.appendChild(p.cloneNode(true)));
// stroke layer (outline being drawn), halo (soft wide glow under it), comet (bright moving heads)
const mk = (cls, filter) => { const g = fillG.cloneNode(true); g.setAttribute('class', cls); if (filter) g.setAttribute('filter', filter); fillG.after(g); return g; };
const cometG = mk('ld-comet', 'url(#ldGlow)'), strokeG = mk('ld-stroke'), haloG = mk('ld-halo', 'url(#ldBlurWide)');
const strokes = [...strokeG.children], halo = [...haloG.children], comets = [...cometG.children];
const lens = strokes.map((p) => p.getTotalLength());
const SEG = 14;                                       // comet length (svg units; the logo is 149 wide)
strokes.forEach((p, i) => {
  p.style.strokeDasharray = halo[i].style.strokeDasharray = `${lens[i]} ${lens[i]}`;
  comets[i].style.strokeDasharray = `${SEG} ${lens[i] + SEG}`;
});
const STAG = 0.1, SPAN = 1 - STAG * (strokes.length - 1);   // letters start one after another, overlapping
function drawLogo(P) {
  for (let i = 0; i < strokes.length; i++) {
    const k = Math.min(Math.max((P - i * STAG) / SPAN, 0), 1), L0 = lens[i], d = k * L0;
    strokes[i].style.strokeDashoffset = halo[i].style.strokeDashoffset = L0 - d;
    comets[i].style.strokeDashoffset = SEG - d;
    comets[i].style.opacity = k > 0.001 && k < 0.999 ? 1 : 0;
  }
}
drawLogo(0);

// blueprint guides: the wordmark's outer box (far-left / far-right verticals, cap line, baseline) and the two outer
// legs (V left, A right). Each line grows out from the logo; its stroke gradient fades it towards the screen edges.
// No masks or filters: just 6 short attribute tweens, so the loader stays cheap.
const guides = $('.ld-guides', logo), defs = $('defs', logo), FAR = 520;
const guideLines = [];
function guide(ax, ay, bx, by, id) {   // a = start (left / top), b = end
  const g = document.createElementNS(SVGNS, 'linearGradient');
  Object.entries({ id, gradientUnits: 'userSpaceOnUse', x1: ax, y1: ay, x2: bx, y2: by }).forEach(([k, v]) => g.setAttribute(k, v));
  g.innerHTML = '<stop offset="0" style="stop-color:var(--g-line)" stop-opacity="0"/><stop offset=".38" style="stop-color:var(--g-line)" stop-opacity="1"/><stop offset=".62" style="stop-color:var(--g-line)" stop-opacity="1"/><stop offset="1" style="stop-color:var(--g-line)" stop-opacity="0"/>';
  defs.appendChild(g);
  const l = document.createElementNS(SVGNS, 'line');   // collapsed at its start (left / top end), sweeps to its end
  Object.entries({ x1: ax, y1: ay, x2: ax, y2: ay, stroke: `url(#${id})` }).forEach(([k, v]) => l.setAttribute(k, v));
  guides.appendChild(l);
  guideLines.push({ l, ax, ay, bx, by });
}
guide(-FAR, 0.37, 149 + FAR, 0.37, 'gH0'); guide(-FAR, 26.15, 149 + FAR, 26.15, 'gH1');
guide(0, -FAR, 0, 26.5 + FAR, 'gV0'); guide(149, -FAR, 149, 26.5 + FAR, 'gV1');
[[0.2, 0.6, 11.4, 26.1, 'gD0'], [136.9, 0.2, 124.8, 25.6, 'gD2']].forEach(([ax, ay, bx, by, id]) => {
  const dx = bx - ax, dy = by - ay, n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n, cx = (ax + bx) / 2, cy = (ay + by) / 2, R = FAR * 0.8;
  guide(cx - ux * R, cy - uy * R, cx + ux * R, cy + uy * R, id);
});
const sheen = $('.ld-sheen', logo);

// intro of the loader itself (pure transforms/opacity + one mask radius: cheap)
gsap.set('.ld-inner', { autoAlpha: 1 });
const GUIDE_IN = 0.15;
guideLines.forEach((g, i) => gsap.to(g.l, { attr: { x2: g.bx, y2: g.by }, duration: 1.1, ease: 'power3.inOut', delay: GUIDE_IN + i * 0.08 }));
gsap.fromTo('.ld-meta', { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.3 });

// progress shown = min(real progress, time floor): the logo always takes >= MIN_DRAW to draw, so it never lurches
const MIN_DRAW = 1.6, LEAD = 0.5, t0 = performance.now();   // LEAD: guides sweep in before the logo starts drawing
function loaderTick(time, dtMs) {
  const dt = Math.min(dtMs || 16, 100);
  const floor = Math.max(((performance.now() - t0) / 1000 - LEAD) / MIN_DRAW, 0) * 100;
  const goal = Math.min(L.finishing ? 100 : Math.min(L.target, 97), floor);
  counter.v += (goal - counter.v) * (1 - Math.exp(-dt / 90));
  if (goal - counter.v < 0.05) counter.v = goal;
  ldNum.textContent = String(Math.round(counter.v)).padStart(2, '0');
  drawLogo(counter.v / 100);
  if (L.finishing && counter.v >= 99.95) { gsap.ticker.remove(loaderTick); ldNum.textContent = '100'; drawLogo(1); loaderEl.setAttribute('aria-valuenow', 100); L.resolve(); }
}
gsap.ticker.add(loaderTick);

// logo complete: fill in, then a quick reflector glint sweeps across and the halo breathes once
function fillLogo() {
  return gsap.timeline()
    .to(fillG, { opacity: 1, duration: 0.5, ease: 'power2.inOut' })
    .to(strokeG, { opacity: 0, duration: 0.4, ease: 'power2.inOut' }, 0.1)
    .to(haloG, { opacity: 0.12, duration: 0.5, ease: 'power2.out' }, 0)
    .addLabel('glint', 0.35)
    .fromTo(sheen, { attr: { x: -70 } }, { attr: { x: 175 }, duration: 0.7, ease: 'power2.inOut' }, 'glint')
    .fromTo(sheen, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out', yoyo: true, repeat: 1, repeatDelay: 0.3 }, 'glint')
    .to(haloG, { opacity: 0.55, duration: 0.3, ease: 'power2.out' }, 'glint+=0.2')
    .to(haloG, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 'glint+=0.4')
    .add(() => guideLines.forEach((g, i) => gsap.to(g.l, { attr: { x1: g.bx, y1: g.by }, duration: 0.75, ease: 'power3.inOut', delay: i * 0.05 })), 0.1)
    .to('.ld-meta', { autoAlpha: 0, y: 6, duration: 0.3, ease: 'power2.in' }, 'glint+=0.15');
}

export const loader = {
  expect(n) { L.expected = Math.max(n, 1); },
  tick() { L.done++; L.target = (L.done / L.expected) * 100; },
};

// ================= day / night text colour =================
// The scene's sun energy goes 5 -> 0.3 between ~f240 and ~f730. n = 0 (day) .. 1 (night).
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));
const INK_DAY = [11, 19, 44], INK_NIGHT = [243, 245, 250];          // navy-950 / navy-50
const TRACK_DAY = [159, 171, 205], TRACK_NIGHT = [53, 71, 122];     // stepper: navy-300 / navy-600
const FILL_DAY = [36, 52, 95], FILL_NIGHT = [199, 207, 228];        // navy-700 / navy-200
const NUM_DAY = [78, 97, 150], NUM_NIGHT = [115, 133, 179];         // navy-500 / navy-400
const VEIL_DAY = [236, 240, 248], VEIL_NIGHT = [11, 19, 44];        // navy-50-ish / navy-950
let lastN = -1;
function applyTheme(sunE) {
  const n = smooth(3.1, 0.95, sunE);                       // 0 above sun 3.1, 1 below 0.95
  if (Math.abs(n - lastN) < 0.004) return;
  lastN = n;
  // the veil fades smoothly; the ink flips quickly around the middle, where the veil is mid-grey and either ink reads
  const ink = mix3(INK_DAY, INK_NIGHT, smooth(0.42, 0.58, n));
  const veil = mix3(VEIL_DAY, VEIL_NIGHT, n);
  root.style.setProperty('--ink', ink.join(' '));
  root.style.setProperty('--veil', veil.join(' '));
  root.style.setProperty('--veil-a', (0.46 + 0.14 * n).toFixed(3));
  const flip = smooth(0.42, 0.58, n);
  root.style.setProperty('--track', mix3(TRACK_DAY, TRACK_NIGHT, flip).join(' '));
  root.style.setProperty('--fill', mix3(FILL_DAY, FILL_NIGHT, flip).join(' '));
  root.style.setProperty('--num', mix3(NUM_DAY, NUM_NIGHT, flip).join(' '));
}

// ================= steps =================
const ui = $('#ui'), copy = $('.copy', ui), eyebrow = $('.eyebrow', ui), numEl = $('.num', ui), tagEl = $('.tag', ui);
const titleEl = $('.title', ui), descEl = $('.desc', ui), stepper = $('.stepper', ui), veil = $('#veil'), hint = $('#hint');
let pips = [], fills = [], cur = null, swapTl = null, uiOn = false, hasScroll = false;

pips = STEPS.map((s, i) => {
  const b = document.createElement('button');
  b.className = 'pip'; b.type = 'button'; b.setAttribute('aria-label', `Step ${i + 1}: ${s.title}`);
  b.innerHTML = `<span class="n">0${i + 1}</span><span class="bar"><i></i></span>`;
  stepper.appendChild(b);
  b.addEventListener('click', () => scrollToFrame(s.from + 2));
  return b;
});
fills = pips.map((p) => $('.bar i', p));
const bars = pips.map((p) => $('.bar', p));
gsap.set(fills, { scaleX: 0 });

function words(el, text) {
  el.textContent = '';
  const out = [];
  text.split(' ').forEach((w, i, a) => {
    const wrap = document.createElement('span'); wrap.className = 'w';
    const inner = document.createElement('span'); inner.className = 'wi'; inner.textContent = w;
    wrap.appendChild(inner); el.appendChild(wrap); out.push(inner);
    if (i < a.length - 1) { const sp = document.createElement('span'); sp.className = 'sp'; el.appendChild(sp); }
  });
  return out;
}
function setContent(c, idx) {
  numEl.textContent = idx < 0 ? '' : `0${idx + 1} / 0${STEPS.length}`;
  tagEl.textContent = c.tag;
  gsap.set($('.rule', ui), { display: idx < 0 ? 'none' : 'block' });
  descEl.textContent = c.desc;
  return words(titleEl, c.title);
}

// swap copy: old words slide out, new words slide in from the scroll direction, description un-blurs, pip widths flow
function swap(next, dir, first = false) {
  const prev = cur; cur = next;
  const c = next < 0 ? HERO : STEPS[next];
  if (swapTl) swapTl.kill();
  const oldWords = titleEl.querySelectorAll('.wi');
  const tl = swapTl = gsap.timeline();
  const out = !first && oldWords.length;
  if (out) {
    tl.to(oldWords, { yPercent: -110 * dir, duration: 0.42, ease: 'power3.in', stagger: 0.03 }, 0)
      .to([descEl, eyebrow], { autoAlpha: 0, y: -12 * dir, filter: 'blur(6px)', duration: 0.32, ease: 'power2.in' }, 0);
  }
  tl.add(() => {
    const w = setContent(c, next);
    gsap.set(w, { yPercent: 115 * dir });
    gsap.set([descEl, eyebrow], { autoAlpha: 0, y: 16 * dir, filter: 'blur(8px)' });
    tl.data = w;
  }, out ? 0.44 : 0)
    .add(() => {
      gsap.to(tl.data, { yPercent: 0, duration: 0.95, ease: 'expo.out', stagger: 0.06, overwrite: true });
    }, out ? 0.44 : 0)
    .to(eyebrow, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out' }, out ? 0.5 : 0.05)
    .to(descEl, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out' }, out ? 0.7 : 0.3);
  // stepper: active segment grows, finished ones stay filled
  pips.forEach((p, i) => {
    p.classList.toggle('on', i === next); p.classList.toggle('done', i < next);
    gsap.to(p, { flexGrow: i === next ? 2.8 : 1, duration: 0.7, ease: 'power3.out', overwrite: 'auto' });
    gsap.to(bars[i], { height: i === next ? 3 : 2, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    if (i < next) gsap.to(fills[i], { scaleX: 1, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
    if (i > next) gsap.to(fills[i], { scaleX: 0, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
  });
  // hint belongs to the hero only
  toggleHint(next < 0 && hasScroll);
}

function stepAt(f) {
  if (f < INTRO_END + 6) return -1;
  let k = 0; for (let i = 0; i < STEPS.length; i++) if (f >= STEPS[i].from) k = i;
  return k;
}

// ================= scroll hint =================
let hintOn = false, hintLoop = null;
const wheel = $('.mouse i', hint), chev = $('.swipe i', hint);
function toggleHint(on) {
  if (on === hintOn) return; hintOn = on;
  gsap.killTweensOf(hint);
  if (on) {
    gsap.set(hint, { visibility: 'visible' });
    gsap.fromTo(hint, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.2 });
    hintLoop?.kill();
    hintLoop = gsap.timeline({ repeat: -1, repeatDelay: 0.25 })
      .fromTo(wheel, { y: 0, autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'none' }, 0)
      .to(wheel, { y: 12, duration: 1.1, ease: 'power2.in' }, 0)
      .to(wheel, { autoAlpha: 0, duration: 0.35, ease: 'none' }, 0.75)
      .fromTo(chev, { y: 14, autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'none' }, 0)
      .to(chev, { y: -8, duration: 1.1, ease: 'power2.out' }, 0)
      .to(chev, { autoAlpha: 0, duration: 0.35, ease: 'none' }, 0.75);
  } else {
    gsap.to(hint, { autoAlpha: 0, y: -10, duration: 0.45, ease: 'power2.in', onComplete: () => hintLoop?.kill() });
  }
}

// ================= scroll <-> frame =================
let storyTween = null, introTween = null, heroST = null;
const STORY_SHARE = 7 / 8;     // the pinned hero lasts 8 viewport heights: 7 drive the truck, the last one holds the closing banner
const SCROLL_LEN = '+=800%';
function scrollToFrame(f) {
  const st = heroST; if (!st) return;
  const y = st.start + ((f - INTRO_END) / (STORY_END - INTRO_END)) * STORY_SHARE * (st.end - st.start);
  window.scrollTo({ top: Math.max(0, y), behavior: reduced ? 'auto' : 'smooth' });
}
// Scroll sets a *target* frame; the story frame chases it with a capped speed, so a hyper-sensitive trackpad
// can't rush through the story and the motion is eased instead of stepping with every wheel tick.
const MAX_FPS = 70;          // story frames per second at most (~10.6 s to play the whole story)
let siteReady = false;
let maxFps = MAX_FPS;        // raised while the skip button fast-forwards
const drive = window.__drive = { target: INTRO_END };
let following = false;
function enableScroll(state) {
  root.classList.remove('is-locked');
  window.scrollTo(0, 0);
  drive.target = INTRO_END;
  storyTween = gsap.timeline({
    // the hero section is pinned while the truck drives; once the story ends it scrolls away and the page continues
    scrollTrigger: { trigger: '#hero', start: 'top top', end: SCROLL_LEN, pin: true, scrub: true, anticipatePin: 1, id: 'hero' },
  }).to(drive, { target: STORY_END, duration: 7, ease: 'none' }).to({}, { duration: 1 });
  heroST = storyTween.scrollTrigger;
  if (!following) {
    following = true;
    gsap.ticker.add((time, dtMs) => {
      const dt = Math.min(dtMs, 50) / 1000, diff = drive.target - state.frame;
      if (Math.abs(diff) < 0.02) { state.frame = drive.target; return; }
      const v = Math.max(-maxFps, Math.min(maxFps, diff * 5));
      if (maxFps !== MAX_FPS && Math.abs(diff) < 2) maxFps = MAX_FPS;   // ease out near the target, never faster than MAX_FPS
      state.frame += v * dt;
    });
    window.addEventListener('scroll', () => {
      if (!heroST) return;
      window.__offscreen = window.scrollY > heroST.end + innerHeight;
      root.classList.toggle('past-hero', window.scrollY > heroST.end - 40);
    }, { passive: true });
  }
  hasScroll = true;
  if (!siteReady) { siteReady = true; initSite(); ScrollTrigger.refresh(); }   // only now: the hero pin exists, so every trigger below it is measured correctly
  if (cur === -1) toggleHint(true);
}


// ================= closing banner (rises over the last frame once the truck is inside) =================
const bannerEl = $('#banner'), bn = $('.bn', bannerEl);
let bannerTl = null, bannerOn = false;
// scroll gate: until the banner has actually been shown you cannot scroll past the end of the story (fast flicks stop there)
let bannerSeen = false;
const gateY = () => heroST ? heroST.start + STORY_SHARE * (heroST.end - heroST.start) + 2 : Infinity;
function gateBlocks(down) { return !bannerSeen && heroST && down && window.scrollY >= gateY() - 1; }
window.addEventListener('wheel', (e) => { if (gateBlocks(e.deltaY > 0)) e.preventDefault(); }, { passive: false });
let touchY = 0;
window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchmove', (e) => { if (gateBlocks(touchY - e.touches[0].clientY > 0)) e.preventDefault(); }, { passive: false });
window.addEventListener('keydown', (e) => { if (gateBlocks(['ArrowDown', 'PageDown', 'End', ' ', 'Spacebar'].includes(e.key))) e.preventDefault(); });
window.addEventListener('scroll', () => {   // fallback for scrollbar drags, momentum and anything else
  if (!bannerSeen && heroST && window.scrollY > gateY() + 1) window.scrollTo({ top: gateY(), behavior: 'instant' });
}, { passive: true });
function buildBanner() {
  const h = $('[data-bn="head"]', bannerEl);
  h.innerHTML = h.textContent.trim().split(/\s+/).map((w) => `<span class="w"><span>${w}</span></span>`).join(' ');
  const words = bannerEl.querySelectorAll('.bn-h .w > span'), ups = bannerEl.querySelectorAll('[data-bn="up"]');
  bannerTl = gsap.timeline({ paused: true, onReverseComplete: () => gsap.set(bannerEl, { visibility: 'hidden' }) })
    .set(bannerEl, { visibility: 'visible' }, 0)
    .fromTo(bn, { yPercent: 108 }, { yPercent: 0, duration: 1.5, ease: 'expo.out' }, 0)
    .fromTo('.bn-grid', { opacity: 0, scale: 1.08 }, { opacity: 0.9, scale: 1, duration: 2.4, ease: 'power3.out' }, 0.15)
    .fromTo(words, { yPercent: 118 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07 }, 0.5)
    .fromTo(ups, { autoAlpha: 0, y: 24, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.95, ease: 'power3.out', stagger: 0.12 }, 0.65)
    .fromTo('.bn-sheen', { xPercent: -160, skewX: -22, opacity: 1 }, { xPercent: 440, skewX: -22, opacity: 1, duration: 2.0, ease: 'power2.inOut' }, 0.5)
    .add(() => { bannerSeen = true; }, 1.3);   // headline and copy are in: the page below unlocks
}
function bannerCheck(f) {
  if (!bannerTl) buildBanner();
  const on = f >= STORY_END - 4 && hasScroll;
  if (on === bannerOn) return; bannerOn = on;
  bannerEl.classList.toggle('on', on);
  if (on) { bannerTl.timeScale(1).play(); gsap.to(ui, { autoAlpha: 0, duration: 0.5, overwrite: 'auto' }); toggleHint(false); }
  else { bannerTl.timeScale(1.7).reverse(); gsap.to(ui, { autoAlpha: 1, duration: 0.6, delay: 0.25, overwrite: 'auto' }); }
}


// ================= top navigation =================
const topnav = $('#topnav');
function showNav(delay) { gsap.fromTo(topnav, { autoAlpha: 0, y: -14 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', delay }); }
topnav?.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  e.preventDefault();
  const id = a.getAttribute('href');
  if (id === '#hero') { window.scrollTo({ top: 0, behavior: 'instant' }); return; }
  bannerSeen = true;   // jumping somewhere on purpose is fine: the scroll gate only stops accidental flicks
  document.querySelector(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
});

// "Skip the journey": fast-forwards the truck to the end of the story and the banner rises
function skipJourney() {
  const st = heroST; if (!st || bannerOn) return;
  maxFps = 900;
  gsap.to(ui, { autoAlpha: 0, duration: 0.35, overwrite: 'auto' }); toggleHint(false);
  const y = st.start + STORY_SHARE * (st.end - st.start);
  window.scrollTo({ top: y + 2, behavior: 'instant' });
}
$('.skip', ui)?.addEventListener('click', skipJourney);

// ================= per-frame sync =================
function bindTicker(state) {
  gsap.ticker.add(() => {
    const f = state.shown ?? state.frame;
    if (state.sunE !== undefined) applyTheme(state.sunE);
    if (!uiOn) return;
    bannerCheck(state.frame);
    const idx = stepAt(f);
    if (idx !== cur) swap(idx, idx > (cur ?? -1) ? 1 : -1, cur === null || cur === undefined);
    if (idx >= 0) {
      const a = STEPS[idx].from, b = idx + 1 < STEPS.length ? STEPS[idx + 1].from : STORY_END;
      gsap.set(fills[idx], { scaleX: Math.min(Math.max((f - a) / (b - a), 0), 1) });
    }
  });
}

// ================= reveal =================
const stage = $('#stage');
// curtain: a centred rounded rectangle; width leads, height follows once it is ~2/3 wide, corners grow 12 -> 96
const R = { w: 120, h: 0, r: 12 };
function applyClip() {
  const W = window.innerWidth, H = window.innerHeight;
  const x = Math.max((W - Math.min(R.w, W)) / 2, 0), y = Math.max((H - Math.min(R.h, H)) / 2, 0);
  stage.style.clipPath = `inset(${y.toFixed(1)}px ${x.toFixed(1)}px ${y.toFixed(1)}px ${x.toFixed(1)}px round ${R.r.toFixed(1)}px)`;
}

export async function startExperience({ state, pinned = false, warm = null }) {
  bindTicker(state);
  const canvas = $('canvas', stage);
  // let the renderer draw a couple of real frames behind the loader before it is shown
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  L.finishing = true; await finished;
  if (warm) { await new Promise((r) => setTimeout(r, 60)); await warm(); }   // GPU uploads happen while the logo is still

  if (pinned || qs.has('skipintro')) {
    // debug / deep link: no loader, no intro, straight to scrolling
    window.__hold3D = false;
    gsap.set(stage, { clipPath: 'none', visibility: 'visible' });
    gsap.set(veil, { opacity: 1 }); gsap.set(ui, { visibility: 'visible' }); showNav(0);
    loaderEl.remove();
    uiOn = true;
    if (pinned) return;
    state.frame = INTRO_END; window.__introGo = true;
    enableScroll(state); cur = null; uiOn = true;
    return;
  }

  const W = window.innerWidth, H = window.innerHeight, H0 = 72;
  const tl = gsap.timeline();
  tl.add(fillLogo())
    .to('.ld-inner', { autoAlpha: 0, scale: 0.92, filter: 'blur(6px)', duration: 0.35, ease: 'power2.in' }, '+=0.1')
    .addLabel('curtain', '-=0.1')
    // the curtain starts and the 3D world starts with it: the truck is already driving into place as the rect opens
    .add(() => { window.__hold3D = false; window.__introGo = true; state.frame = INTRO_START; gsap.set(stage, { visibility: 'visible' }); applyClip(); }, 'curtain')
    .set(canvas, { scale: 1.6 }, 'curtain')
    .fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 'curtain+=0.1')   // blur + tint come in with the curtain
    .add(() => {
      introTween = gsap.to(state, {
        frame: INTRO_END, duration: reduced ? 0.01 : INTRO_SECONDS, ease: 'none',
        onComplete: () => { gsap.delayedCall(0.3, () => enableScroll(state)); },
      });
    }, 'curtain')
    // 1) a small rounded rect springs in at the centre (wobbles a little before it settles)
    .fromTo(R, { w: 40, h: 0, r: 12 }, { w: 120, h: H0, duration: 0.9, ease: 'elastic.out(1.1, 0.45)', onUpdate: applyClip }, 'curtain')
    .addLabel('open', '-=0.35')
    // 2) it shoots sideways past ~66% and springs back; the height squashes a touch while it stretches (squash and stretch)
    .to(R, { w: W * 0.66, r: 40, duration: 1.0, ease: 'back.out(2.2)', onUpdate: applyClip }, 'open')
    .to(R, { h: H0 * 1.25, duration: 1.0, ease: 'elastic.out(1, 0.5)', onUpdate: applyClip }, 'open')
    // 3) the height catches up to almost full screen while the corners keep rounding
    .to(R, { w: W * 0.94, h: H * 0.9, r: 80, duration: 0.85, ease: 'expo.inOut', onUpdate: applyClip }, 'open+=0.7')
    // 4) and it lands with a soft spring: a tiny bounce at the edges, then full-bleed with square corners
    .to(R, { w: W, h: H, duration: 1.1, ease: 'elastic.out(1, 0.55)', onUpdate: applyClip }, '>-0.12')
    .to(R, { r: 0, duration: 0.8, ease: 'power3.inOut', onUpdate: applyClip }, '<0.15')
    .to(canvas, { scale: 1, duration: 2.2, ease: 'expo.inOut' }, 'open')
    .add(() => {
      gsap.set(ui, { visibility: 'visible' });
      uiOn = true; cur = undefined;
      swap(-1, 1, true);
      gsap.fromTo(stepper, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: 0.5 });
      showNav(0.3);
    }, 'open+=1.6')
    // NOT clearProps on the clip: that would bring back the stylesheet's closed starting clip and hide the scene
    .add(() => { gsap.set(stage, { clipPath: 'none' }); gsap.set(canvas, { clearProps: 'transform' }); loaderEl.remove(); });
  if (qs.has('hold')) { window.__tl = tl; tl.pause(0); }   // debug: ?hold pauses the reveal so a test can seek it
}
