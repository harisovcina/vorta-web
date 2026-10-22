// Sections after the hero. Everything here is driven by GSAP + ScrollTrigger and only plays when the element scrolls into view.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
import { initProto } from './proto.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function splitWords(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.classList.add('split');
  el.innerHTML = text.split(/\s+/).map((w) => `<span class="w" aria-hidden="true"><span>${w}</span></span>`).join(' ');
  return el.querySelectorAll('.w > span');
}

// ordered (Bayer 8x8) dither: every dot is one CSS pixel. data-dz = where it is densest (up = toward the bottom edge, down = toward the top edge, left/right, br/bl/tr/tl = corner)
const BAYER = (() => { const m = [[0, 2], [3, 1]]; let b = m; for (let k = 0; k < 2; k++) { const n = b.length, o = []; for (let y = 0; y < n * 2; y++) { o[y] = []; for (let x = 0; x < n * 2; x++) o[y][x] = 4 * b[y % n][x % n] + m[Math.floor(y / n)][Math.floor(x / n)]; } b = o; } return b; })();
function paintDither(cv) {
  const ps = +(cv.dataset.px || 0) || 1 / (window.devicePixelRatio || 1);   // default: one device pixel per dot (hairline-fine on retina)
  if (cv._h === undefined) cv._h = cv.style.height;      // an explicit height set in the markup wins
  cv.style.width = ''; if (!cv._h) cv.style.height = '';
  const r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return;
  // whole pixels only (and one bleeds past the edge, the parent clips it) so every dot stays a crisp, evenly spaced 1px square
  const w = Math.ceil(r.width / ps), h = Math.ceil(r.height / ps);   // canvas resolution = device pixels
  cv.width = w; cv.height = h; cv.style.width = w * ps + 'px'; if (!cv._h) cv.style.height = h * ps + 'px';
  const hex = (cv.dataset.color || '#ffffff').replace('#', ''), R = parseInt(hex.slice(0, 2), 16), G = parseInt(hex.slice(2, 4), 16), B = parseInt(hex.slice(4, 6), 16);
  const max = +(cv.dataset.max || 0.5), curve = +(cv.dataset.curve || 1.6), dir = cv.dataset.dz || 'up';
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / (w - 1 || 1), v = y / (h - 1 || 1);
    let k = dir === 'up' ? v : dir === 'down' ? 1 - v : dir === 'left' ? 1 - u : dir === 'right' ? u : 0;
    if (dir.length === 2 && dir !== 'up') k = 1 - Math.min(1, Math.hypot(dir[1] === 'r' ? 1 - u : u, dir[0] === 'b' ? 1 - v : v) / 1.15);
    const dens = Math.pow(Math.max(0, Math.min(1, k)), curve) * max;
    if (dens > (BAYER[y & 7][x & 7] + 0.5) / 64) { const i = (y * w + x) * 4; d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
}
function initDither() {
  const all = [...document.querySelectorAll('canvas.dz')];
  const ro = new ResizeObserver((es) => es.forEach((e) => all.filter((cv) => cv.parentElement === e.target).forEach(paintDither)));
  all.forEach((cv) => ro.observe(cv.parentElement));
}

export function initSite() {
  initDither();
  initProto(document.getElementById('proto'));
  const $$ = (s) => gsap.utils.toArray(s);

  // ---- glow borders: ring + halo + spotlight layers on every .fx card ----
  $$('#site .fx').forEach((el) => el.insertAdjacentHTML('beforeend', '<i class="fx-ring"></i><i class="fx-halo"></i><i class="fx-spot"></i>'));

  // ---- subtle 3D tilt that follows the pointer, plus a spotlight under it ----
  if (fine && !reduced) {
    $$('#site .fx').forEach((card) => {
      gsap.set(card, { transformPerspective: 1000, transformOrigin: '50% 50%' });
      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.7, ease: 'power3.out' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.7, ease: 'power3.out' });
      const lift = gsap.quickTo(card, 'z', { duration: 0.7, ease: 'power3.out' });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        const max = r.width > 900 ? 1.6 : 5.5;   // big panels barely move, small cards a little more
        ry((x - 0.5) * 2 * max); rx(-(y - 0.5) * 2 * max); lift(r.width > 900 ? 0 : 14);
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', () => { rx(0); ry(0); lift(0); });
    });
  }

  // ---- benefit icons: strokes ready to be drawn, a blurred twin for the glow ----
  const icos = $$('#site [data-ico]').map((box) => {
    const svg = box.querySelector('svg');
    const prep = (s) => s.querySelectorAll('path,circle,rect,line,polyline,ellipse').forEach((n) => {
      n.setAttribute('pathLength', '1'); n.style.strokeDasharray = '1 1.5'; n.style.strokeDashoffset = reduced ? '0' : '1';
    });
    prep(svg);
    box.style.setProperty('--d', (Math.random() * 1.6).toFixed(2) + 's');
    const halo = svg.cloneNode(true); halo.classList.add('ico-halo'); halo.setAttribute('aria-hidden', 'true'); box.prepend(halo);
    return { box, shapes: box.querySelectorAll('path,circle,rect,line,polyline,ellipse'), halo };
  });

  // ---- marquee of terms (loops forever, slows down under the pointer) ----
  const track = document.querySelector('[data-marquee]');
  if (track && !reduced) {
    const loop = gsap.to(track, { xPercent: -50, duration: 70, ease: 'none', repeat: -1 });
    const view = track.parentElement;
    view.addEventListener('pointerenter', () => gsap.to(loop, { timeScale: 0.2, duration: 0.8 }));
    view.addEventListener('pointerleave', () => gsap.to(loop, { timeScale: 1, duration: 0.8 }));
  }

  if (reduced) return;
  const hid = $$('#site [data-fitli]');

  // ---- titles: word by word, like the stepper ----
  $$('#site [data-title]').forEach((el) => {
    const words = splitWords(el);
    gsap.set(words, { yPercent: 118 });
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07, delay: 0.1 }) });
  });

  // ---- small text / buttons: fade + un-blur ----
  const items = $$('#site [data-reveal]');
  gsap.set(items, { autoAlpha: 0, y: 26, filter: 'blur(10px)' });
  ScrollTrigger.batch(items, { start: 'top 92%', once: true, interval: 0.1,
    onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out', stagger: 0.09, clearProps: 'filter' }) });

  // ---- cards: blurry staggered entrance ----
  const cards = $$('#site [data-card]');
  gsap.set(cards, { autoAlpha: 0, y: 64, scale: 0.97, filter: 'blur(14px)' });
  ScrollTrigger.batch(cards, { start: 'top 94%', once: true, interval: 0.12, batchMax: 6,
    onEnter: (els) => {
      gsap.to(els, { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out', stagger: 0.12, clearProps: 'filter' });
    } });

  // ---- icons: the stroke draws itself, the glow flashes on (same idea as the logo loader) ----
  icos.forEach(({ box, shapes, halo }) => {
    gsap.set(box, { autoAlpha: 0, scale: 0.8 });
    ScrollTrigger.create({ trigger: box, start: 'top 90%', once: true, onEnter: () => {
      const hs = halo.querySelectorAll('path,circle,rect,line,polyline,ellipse');
      gsap.timeline({ delay: 0.35 })
        .to(box, { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'back.out(2)' }, 0)
        .to([...shapes, ...hs], { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut', stagger: 0.07 }, 0.1)
        .fromTo(halo, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.3)
        .to(halo, { opacity: 0.55, duration: 1.2, ease: 'power2.inOut' }, 1.0)
        .add(() => box.classList.add('live'), 2.0);   // from here on it keeps pulsing
    } });
  });

  // ---- fit section: rows slide in one by one, the check badge pops, the emblem scales up ----
  hid.forEach((li, i) => {
    li.style.setProperty('--d', (i * 0.5) + 's'); li.style.setProperty('--li', i);
    const ck = li.querySelector('.fit-ck'), path = li.querySelector('path');
    path.setAttribute('pathLength', '1'); path.style.strokeDasharray = '1 1.5'; path.style.strokeDashoffset = '1';
    gsap.set(li, { autoAlpha: 0, x: -40, filter: 'blur(10px)' }); gsap.set(ck, { scale: 0.4, rotate: -20 });
    ScrollTrigger.create({ trigger: li, start: 'top 92%', once: true, onEnter: () => {
      gsap.timeline({ delay: i * 0.14 })
        .to(li, { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', clearProps: 'filter' }, 0)
        .to(ck, { scale: 1, rotate: 0, duration: 0.8, ease: 'back.out(2.4)' }, 0.15)
        .to(path, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' }, 0.45);
    } });
  });
  const em = document.querySelector('.fit-emblem');
  if (em) {
    gsap.set(em, { autoAlpha: 0, scale: 0.7 });
    const chk = em.querySelector('.fe-check'); chk.setAttribute('pathLength', '1'); chk.style.strokeDasharray = '1 1.5'; chk.style.strokeDashoffset = '1';
    const chip = document.querySelector('[data-fitchip]'); gsap.set(chip, { autoAlpha: 0, y: 14 });
    ScrollTrigger.create({ trigger: em, start: 'top 85%', once: true, onEnter: () => gsap.timeline({ delay: 0.3 })
      .to(em, { autoAlpha: 1, scale: 1, duration: 1.3, ease: 'expo.out' }, 0)
      .to(chk, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 0.5)
      .to(chip, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out' }, 1.0) });
  }

  // ---- real photos drift slightly slower than the page ----
  $$('#site .clay img').forEach((img) => {
    gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
