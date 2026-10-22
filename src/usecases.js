// Use cases page: one order travels through the company. Each stop has a "Before / With Vorta" switch.
import './site.css';
import './widows.js';
import './usecases.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Observer } from 'gsap/Observer';
gsap.registerPlugin(ScrollTrigger, Observer);
import { initPicker } from './usecasesBC.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- the eight stops
// before: chaos items, positioned in % of the scene. kinds: chat, me, note, mail, cell, phone, file, map
const STOPS = [
  {
    id: 'sales', dept: 'Sales', role: 'Sales manager', when: 'Mon 09:12', status: 'Customer asks for 14 chairs',
    quote: 'I used to wait on information from other departments. Now I give customers a delivery date right away.',
    problem: 'Waiting for information', solution: 'Instant answers',
    before: [
      { k: 'chat', who: 'Hartmann Möbel', t: 'Can you deliver 14 Amsterdam chairs, smoked oak, by mid November?', x: 4, y: 6, r: -2 },
      { k: 'me', t: 'Let me check with production and get back to you…', x: 40, y: 30, r: 1.5 },
      { k: 'note', t: 'ask Emir about oak stock??', x: 66, y: 4, r: 5 },
      { k: 'phone', t: '3 missed calls', sub: 'Production', x: 8, y: 62, r: -3 },
      { k: 'cell', rows: [['Oak 26 mm', '#N/A'], ['Smoked fabric', '?'], ['Free capacity', 'ask']], x: 50, y: 58, r: 2 },
      { k: 'mail', t: 'RE: RE: RE: delivery date?', sub: 'from: Hartmann Möbel', x: 18, y: 40, r: -4 },
    ],
    after: `<div class="vo-h"><span>Available to promise</span><em>ORD-2851</em></div>
      <div class="vo-atp"><div><b>6</b><span>in stock</span></div><i>+</i><div><b>8</b><span>from production</span></div><i>=</i><div class="hl"><b>14</b><span>chairs</span></div></div>
      <div class="vo-big"><span>Earliest delivery</span><b>CW 46 · 12 Nov</b></div>
      <button class="vo-btn" type="button">Confirm to customer →</button>`,
  },
  {
    id: 'product', dept: 'Products', role: 'Product manager', when: 'Mon 10:30', status: 'A new variant: smoked oak',
    quote: 'The catalog used to be unmanageable. Now Vorta automatically generates every SKU variant.',
    problem: 'Manual SKU management', solution: 'Automatic generation',
    before: [
      { k: 'cell', rows: [['AMS-XL-BLK-1', ''], ['AMS-XL-BLK-1 (copy)', 'dup'], ['AMS-XXL-blk?', ''], ['AMS_XXXL_SMOKED_OAK', 'new?']], x: 6, y: 8, r: -2 },
      { k: 'note', t: 'is SMK-OAK the same as SMOKED_OAK ?!', x: 58, y: 6, r: 4 },
      { k: 'mail', t: 'Which code do I put on the order?', sub: 'from: Sales', x: 44, y: 46, r: 3 },
      { k: 'note', t: 'new colour = 80 new rows by hand', x: 8, y: 64, r: -5 },
      { k: 'file', t: 'catalog_2024_v7_FINAL.xlsx', x: 52, y: 78, r: -1 },
    ],
    after: `<div class="vo-h"><span>Amsterdam Plus XXXL</span><em>Published</em></div>
      <div class="vo-chips"><i class="on">Smoked</i><i class="on">Oak</i><i class="on">Felt</i><i>Walnut</i><i>Sand</i></div>
      <div class="vo-sku"><span>New SKU generated</span><b>AMS-XXXL-SMK-OAK-FLT-VT</b></div>
      <div class="vo-row3"><div><b>80</b><span>variants</span></div><div><b>0</b><span>duplicates</span></div><div><b>8</b><span>price lists</span></div></div>`,
  },
  {
    id: 'procurement', dept: 'Procurement', role: 'Procurement', when: 'Mon 11:05', status: 'Oak is running short',
    quote: 'We used to spot shortages too late. Now Vorta flags them in time.',
    problem: 'Reactive procurement', solution: 'Proactive planning',
    before: [
      { k: 'chat', who: 'Production', t: 'We are OUT of oak boards!! Hartmann chairs are next week', x: 5, y: 6, r: -2 },
      { k: 'mail', t: 'URGENT: material for ORD-2851', sub: 'from: Production', x: 46, y: 22, r: 3 },
      { k: 'cell', rows: [['Oak board 26 mm', '−12 m²'], ['Demand', '48 m²']], x: 8, y: 50, r: -3, bad: true },
      { k: 'note', t: 'order oak on Friday? or Monday?', x: 60, y: 60, r: 5 },
      { k: 'phone', t: 'Supplier not answering', sub: 'Northwood Timber', x: 30, y: 76, r: -2 },
    ],
    after: `<div class="vo-h"><span>Shortage flagged · 3 weeks ahead</span><em class="warn">Oak −12 m²</em></div>
      <div class="vo-list"><div><span>Oak board 26 mm</span><em>needed 48 m²</em><b class="warn">−12</b></div><div><span>Felt glide 24 mm</span><em>needed 320 pcs</em><b class="warn">−40</b></div></div>
      <div class="vo-ok"><i>✓</i><div><b>PO-0418 drafted</b><span>Northwood Timber · arrives Tue 28 Oct</span></div></div>`,
  },
  {
    id: 'production', dept: 'Production', role: 'Production manager', when: 'Tue 07:40', status: 'Into the schedule',
    quote: 'For the first time we have clear priorities. We are no longer guessing what comes first.',
    problem: 'Unclear priorities', solution: 'Clear schedule',
    before: [
      { k: 'note', t: 'ORD-2851 FIRST !!!', x: 6, y: 8, r: -6 },
      { k: 'note', t: 'no, Berger first (director said)', x: 36, y: 4, r: 4 },
      { k: 'note', t: 'Kuhn is waiting since August', x: 66, y: 12, r: -3 },
      { k: 'chat', who: 'Shift lead', t: 'What are we making today?', x: 10, y: 50, r: 2 },
      { k: 'phone', t: 'Sales calling again', sub: '“any news on Hartmann?”', x: 52, y: 58, r: -2 },
    ],
    after: `<div class="vo-h"><span>Production plan · CW 44</span><em>Upholstery line</em></div>
      <div class="vo-gantt">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => `<span>${d}</span>`).join('')}
        <i style="--c:1;--s:1;--w:2">ORD-2846</i><i class="hl" style="--c:2;--s:2;--w:3">ORD-2851 · 14 chairs</i><i style="--c:3;--s:1;--w:1">ORD-2849</i><i style="--c:3;--s:3;--w:3">ORD-2850</i></div>
      <div class="vo-ok"><i>✓</i><div><b>Materials reserved</b><span>Oak arrives Tue · ready Thu 30 Oct</span></div></div>`,
  },
  {
    id: 'warehouse', dept: 'Warehouse', role: 'Warehouse worker', when: 'Thu 14:20', status: '14 chairs, ready to pick',
    quote: 'I used to search the warehouse for goods. Now I know exactly where every item is.',
    problem: 'Searching for goods', solution: 'Precise location',
    before: [
      { k: 'chat', who: 'Logistics', t: 'Where are the 14 chairs for Hartmann?', x: 6, y: 6, r: -2 },
      { k: 'map', x: 44, y: 14, r: 2 },
      { k: 'note', t: 'Hall B? or C?', x: 10, y: 48, r: -5 },
      { k: 'note', t: 'ask Mirza, he moved them', x: 14, y: 72, r: 3 },
    ],
    after: `<div class="vo-h"><span>Pick list · ORD-2851</span><em>14 / 14</em></div>
      <div class="vo-wh">${Array.from({ length: 24 }, (_, i) => `<i class="${i === 15 ? 'hl' : ''}"></i>`).join('')}</div>
      <div class="vo-big"><span>Location</span><b>Hall C · Aisle 4 · Rack 2</b></div>
      <div class="vo-ok"><i>✓</i><div><b>Scanned and staged</b><span>Dock 2 · for shipment C250002</span></div></div>`,
  },
  {
    id: 'logistics', dept: 'Logistics', role: 'Logistics coordinator', when: 'Fri 09:00', status: 'A shared truck to Germany',
    quote: 'Information was everywhere: messages, Excel. Now everything for shipments is in one place.',
    problem: 'Scattered information', solution: 'All in one place',
    before: [
      { k: 'chat', who: 'Driver', t: 'Which address first? Berlin or Aarhus?', x: 6, y: 6, r: -2 },
      { k: 'cell', rows: [['Aarhus', '?'], ['Berlin', 'Fri?'], ['Paris', '—']], x: 54, y: 8, r: 3 },
      { k: 'note', t: 'truck half empty AGAIN', x: 8, y: 52, r: -4 },
      { k: 'mail', t: 'Can you add 2 more pallets?', sub: 'from: Sales', x: 46, y: 56, r: 2 },
    ],
    after: `<div class="vo-h"><span>Shipment C250002</span><em>Planned</em></div>
      <div class="vo-meter"><div><span>Truck filled</span><b>92%</b></div><i><b style="width:92%"></b></i></div>
      <div class="vo-stops"><span><b>1</b>Aarhus</span><span><b>2</b>Berlin</span><span class="hl"><b>3</b>Munich · ORD-2851</span><span><b>4</b>Milan</span></div>
      <div class="vo-ok"><i>✓</i><div><b>Route sent to driver</b><span>Loading Mon 3 Nov · 07:00</span></div></div>`,
  },
  {
    id: 'finance', dept: 'Finance', role: 'Finance', when: 'Fri 11:30', status: 'Invoiced before loading',
    quote: 'Now invoices are ready before loading and nothing slips through.',
    problem: 'Missed invoices', solution: 'Nothing slips through',
    before: [
      { k: 'mail', t: 'Did we invoice Hartmann??', sub: 'from: Director', x: 6, y: 8, r: -3 },
      { k: 'chat', who: 'Logistics', t: 'Truck already left yesterday…', x: 44, y: 24, r: 2 },
      { k: 'cell', rows: [['INV ?', 'ORD-2851'], ['Delivery note', 'missing'], ['Amount', '7,070.20?']], x: 8, y: 50, r: -2, bad: true },
      { k: 'note', t: 'check all delivery notes vs invoices (again)', x: 56, y: 62, r: 5 },
    ],
    after: `<div class="vo-h"><span>Invoice INV-2026-0912</span><em>Ready</em></div>
      <div class="vo-checks"><span><i>✓</i>Delivery note matched</span><span><i>✓</i>Prices from customer price list</span><span><i>✓</i>Sent before loading</span></div>
      <div class="vo-big"><span>Total</span><b>7,070.20 €</b></div>`,
  },
  {
    id: 'director', dept: 'Leadership', role: 'Director', when: 'Fri 16:00', status: 'The whole picture',
    quote: 'For the first time I have a complete view: orders, stock, production, shipments.',
    problem: 'Partial information', solution: 'Complete picture',
    before: [
      { k: 'file', t: 'report_v3_FINAL.xlsx', x: 6, y: 6, r: -2 },
      { k: 'file', t: 'orders_new (2).xlsx', x: 40, y: 14, r: 3 },
      { k: 'file', t: 'stock_Mirza_OLD.xlsx', x: 14, y: 30, r: -4 },
      { k: 'chat', who: 'You', t: 'Who knows where we are with Hartmann?', x: 46, y: 46, r: 2 },
      { k: 'note', t: 'Monday 8:00 meeting to sync everyone', x: 8, y: 66, r: -3 },
    ],
    after: `<div class="vo-h"><span>This week</span><em>Live</em></div>
      <div class="vo-row3"><div><b>94%</b><span>on time</span></div><div><b>847</b><span>open orders</span></div><div><b>81%</b><span>capacity used</span></div></div>
      <svg class="vo-spark" viewBox="0 0 300 70" preserveAspectRatio="none"><path d="M0 55 L40 50 L80 52 L120 38 L160 42 L200 28 L240 30 L300 12" fill="none" stroke="currentColor" stroke-width="2"/><path d="M0 55 L40 50 L80 52 L120 38 L160 42 L200 28 L240 30 L300 12 V70 H0Z" fill="currentColor" opacity=".12"/></svg>
      <div class="vo-ok"><i>✓</i><div><b>ORD-2851 delivered</b><span>Mon 10 Nov · two days early</span></div></div>`,
  },
];

// ---------------------------------------------------------------- render
const icoPhone = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
const icoFile = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5M8 13h8M8 17h8"/></svg>';
function chaos(it) {
  const pos = `style="left:${it.x}%;top:${it.y}%;--r:${it.r}deg"`;
  switch (it.k) {
    case 'chat': return `<div class="ch ch-chat" ${pos}><span>${esc(it.who)}</span>${esc(it.t)}</div>`;
    case 'me': return `<div class="ch ch-chat me" ${pos}>${esc(it.t)}</div>`;
    case 'note': return `<div class="ch ch-note" ${pos}>${esc(it.t)}</div>`;
    case 'mail': return `<div class="ch ch-mail" ${pos}><b>${esc(it.t)}</b><span>${esc(it.sub)}</span></div>`;
    case 'phone': return `<div class="ch ch-phone" ${pos}><i>${icoPhone}</i><div><b>${esc(it.t)}</b><span>${esc(it.sub)}</span></div></div>`;
    case 'file': return `<div class="ch ch-file" ${pos}><i>${icoFile}</i>${esc(it.t)}</div>`;
    case 'cell': return `<div class="ch ch-cell ${it.bad ? 'bad' : ''}" ${pos}>${it.rows.map((r) => `<span>${esc(r[0])}</span><span>${esc(r[1])}</span>`).join('')}</div>`;
    case 'map': return `<div class="ch ch-map" ${pos}>${Array.from({ length: 12 }, (_, i) => `<i>${[2, 5, 9].includes(i) ? '?' : ''}</i>`).join('')}</div>`;
    default: return '';
  }
}

function render() {
  const track = document.querySelector('[data-track]'), rail = document.querySelector('[data-rail]');
  track.innerHTML = STOPS.map((s, i) => `
    <article class="stop" id="${s.id}" data-stop="${i}">
      <div class="stop-in">
        <div class="stop-copy">
          <p class="stop-meta"><span class="stop-n">${String(i + 1).padStart(2, '0')} / 08</span><span class="stop-dept">${s.dept}</span><span class="stop-when">${s.when}</span></p>
          <h2 class="stop-role">${s.role}</h2>
          <p class="stop-status"><i></i>ORD-2851 · ${esc(s.status)}</p>
          <blockquote class="stop-quote">“${esc(s.quote)}”</blockquote>
          <p class="stop-ps"><s>${esc(s.problem)}</s><span class="arr">→</span><b>${esc(s.solution)}</b></p>
          <button class="flip" type="button" role="switch" aria-checked="false" aria-label="Show ${esc(s.role)} with Vorta">
            <span class="flip-l">Before</span><span class="flip-r">With Vorta</span><i class="flip-k"></i>
          </button>
        </div>
        <div class="scene" data-scene>
          <div class="sc-before" aria-hidden="false">${s.before.map(chaos).join('')}<span class="sc-tag">Before</span></div>
          <div class="sc-after" aria-hidden="true"><div class="vo">${s.after}</div><span class="sc-tag">With Vorta</span></div>
          <span class="sc-hint">Click to flip</span>
        </div>
      </div>
    </article>`).join('');
  rail.innerHTML = `<div class="rail-line"><i data-railfill></i></div>
    <div class="rail-token" data-token><span>ORD-2851</span></div>
    ${STOPS.map((s, i) => `<button class="rail-b" type="button" data-go="${i}" style="--p:${i / (STOPS.length - 1)}"><i></i><span>${s.dept}</span></button>`).join('')}`;
  document.querySelector('#journey').insertAdjacentHTML('beforeend', `
    <button class="jr-arrow prev" type="button" data-prev aria-label="Previous role"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
    <button class="jr-arrow next" type="button" data-next aria-label="Next role"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>`);
}

// ---------------------------------------------------------------- the flip
function bindFlip(stopEl) {
  const btn = stopEl.querySelector('.flip'), scene = stopEl.querySelector('[data-scene]');
  const before = scene.querySelector('.sc-before'), after = scene.querySelector('.sc-after');
  const items = [...before.querySelectorAll('.ch')], vo = after.querySelector('.vo'), parts = vo.children;
  let on = false, tl = null;
  // chaos keeps fidgeting a little while it is on screen
  const wobble = items.map((el, i) => gsap.to(el, { rotation: `+=${gsap.utils.random(-1.6, 1.6)}`, y: gsap.utils.random(-3, 3), duration: gsap.utils.random(1.4, 2.4), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * 0.12, paused: reduced }));
  const phone = before.querySelector('.ch-phone i');
  const ring = phone && gsap.to(phone, { rotation: 14, duration: 0.07, yoyo: true, repeat: 7, repeatDelay: 0, ease: 'none', paused: true });
  const ringLoop = phone && gsap.delayedCall(2.4, function again() { ring.restart(); gsap.delayedCall(2.4, again); });
  gsap.set(after, { autoAlpha: 0 });
  const flip = (to) => {
    if (to === on) return; on = to;
    btn.setAttribute('aria-checked', String(on)); stopEl.classList.toggle('is-on', on);
    before.setAttribute('aria-hidden', String(on)); after.setAttribute('aria-hidden', String(!on));
    tl?.kill();
    if (on) {
      wobble.forEach((w) => w.pause());
      tl = gsap.timeline()
        .to(items, { x: () => gsap.utils.random(-260, 260), y: () => gsap.utils.random(-200, 200), rotation: () => gsap.utils.random(-50, 50), scale: 0.7, autoAlpha: 0, filter: 'blur(8px)', duration: 0.6, ease: 'power3.in', stagger: { each: 0.04, from: 'random' } }, 0)
        .to(before, { backgroundColor: 'rgba(17,27,58,1)', duration: 0.5 }, 0.15)
        .set(after, { autoAlpha: 1 }, 0.45)
        .fromTo(vo, { scale: 0.92, filter: 'blur(10px)', autoAlpha: 0 }, { scale: 1, filter: 'blur(0px)', autoAlpha: 1, duration: 0.7, ease: 'expo.out' }, 0.45)
        .fromTo(parts, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out', stagger: 0.07 }, 0.55);
    } else {
      tl = gsap.timeline({ onComplete: () => wobble.forEach((w) => !reduced && w.resume()) })
        .to(vo, { scale: 0.94, autoAlpha: 0, filter: 'blur(8px)', duration: 0.35, ease: 'power2.in' }, 0)
        .set(after, { autoAlpha: 0 }, 0.35)
        .to(before, { backgroundColor: '', duration: 0.4 }, 0.1)
        .to(items, { x: 0, y: 0, rotation: (i, el) => parseFloat(el.style.getPropertyValue('--r')) || 0, scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration: 0.7, ease: 'back.out(1.6)', stagger: { each: 0.04, from: 'random' } }, 0.25);
    }
  };
  items.forEach((el) => gsap.set(el, { rotation: parseFloat(el.style.getPropertyValue('--r')) || 0 }));
  btn.addEventListener('click', () => flip(!on));
  scene.addEventListener('click', (e) => { if (!e.target.closest('.vo-btn')) flip(!on); });
  return { flip, get on() { return on; } };
}

// ---------------------------------------------------------------- page
let jumpTo = (i) => document.getElementById(STOPS[i].id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
function init() {
  render();
  const stops = [...document.querySelectorAll('.stop')];
  const flips = stops.map(bindFlip);
  const rail = document.querySelector('[data-rail]'), token = rail.querySelector('[data-token]'), fillEl = rail.querySelector('[data-railfill]');
  const railBtns = [...rail.querySelectorAll('[data-go]')];
  const tokenLabel = token.querySelector('span');
  let active = -1;
  const setActive = (i) => {
    if (i === active) return; active = i;
    railBtns.forEach((b, n) => { b.classList.toggle('on', n === i); b.classList.toggle('done', n < i); });
    stops.forEach((s, n) => s.classList.toggle('active', n === i));
    tokenLabel.textContent = `ORD-2851 · ${STOPS[i].status}`;
  };

  // hero entrance
  const words = document.querySelectorAll('.uc-h .w > span');
  gsap.fromTo(words, { yPercent: 118 }, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.08, delay: 0.15 });
  gsap.fromTo('.uc-hero [data-up]', { autoAlpha: 0, y: 20, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: 'power3.out', stagger: 0.1, delay: 0.5 });

  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    // Step mode: once the journey fills the screen, page scrolling is captured and every gesture
    // (wheel flick, swipe, arrow key, button) moves exactly ONE stop. You leave the section only from the
    // first stop (going up) or the last stop (going down), so no role can be skipped by scrolling fast.
    const track = document.querySelector('[data-track]'), N = STOPS.length;
    const prevB = document.querySelector('[data-prev]'), nextB = document.querySelector('[data-next]');
    let index = 0, busy = false, ready = true;
    const paint = (i, dur) => {
      const p = i / (N - 1);
      gsap.to(track, { x: () => -i * window.innerWidth, duration: dur, ease: 'expo.inOut' });
      gsap.to(token, { left: `${p * 100}%`, xPercent: -p * 100, duration: dur, ease: 'expo.inOut' });   // stays inside the rail at both ends
      gsap.to(fillEl, { scaleX: p, duration: dur, ease: 'expo.inOut' });
      const sc = stops[i].querySelector('.scene');
      gsap.fromTo(sc, { rotationY: i > active ? -12 : 12, scale: 0.93, autoAlpha: 0.4, transformPerspective: 1400 }, { rotationY: 0, scale: 1, autoAlpha: 1, duration: dur * 1.1, ease: 'expo.out', delay: dur * 0.25 });
      gsap.fromTo(stops[i].querySelectorAll('.stop-copy > *'), { x: i > active ? 40 : -40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: dur, ease: 'expo.out', stagger: 0.05, delay: dur * 0.3 });
      setActive(i);
      prevB.disabled = i === 0; nextB.disabled = i === N - 1;
    };
    const go = (i) => {
      if (i === index || i < 0 || i > N - 1) return;
      busy = true; ready = false;
      paint(i, 0.9); index = i;
      gsap.delayedCall(0.9, () => { busy = false; });
    };
    const intent = Observer.create({
      type: 'wheel,touch', tolerance: 12, preventDefault: true, wheelSpeed: -1,
      onUp: () => step(1), onDown: () => step(-1),   // wheelSpeed -1: "up" = finger/wheel moving content up = next
      onStop: () => { ready = true; }, onStopDelay: 0.18,
      onEnable(self) { self.saved = window.scrollY; self.lock = () => window.scrollTo(0, self.saved); window.addEventListener('scroll', self.lock); },
      onDisable(self) { window.removeEventListener('scroll', self.lock); },
    });
    intent.disable();
    // one gesture = one step: a new step needs the previous animation done AND the previous gesture's inertia to stop
    function step(dir) {
      if (busy || !ready) return;
      const to = index + dir;
      if (to < 0 || to > N - 1) { release(dir); return; }
      go(to);
    }
    function release(dir) {
      intent.disable();
      const st = pinST;
      window.scrollTo(0, dir > 0 ? st.end + 2 : st.start - 2);
    }
    const pinST = ScrollTrigger.create({
      trigger: '#journey', start: 'top top', end: '+=' + Math.round(window.innerHeight * 0.5), pin: true, anticipatePin: 1,
      // only capture when you actually arrive here by scrolling, not when a link jumps straight past the section
      onEnter: (self) => { if (!intent.isEnabled && window.scrollY <= self.end) { self.scroll(self.start + 1); intent.enable(); ready = false; } },
      onEnterBack: (self) => { if (!intent.isEnabled && window.scrollY >= self.start) { self.scroll(self.end - 1); intent.enable(); ready = false; } },
    });
    const onKey = (e) => {
      if (!intent.isEnabled) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); if (!busy) (index === N - 1 ? release(1) : go(index + 1)); }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!busy) (index === 0 ? release(-1) : go(index - 1)); }
    };
    window.addEventListener('keydown', onKey);
    const toJourney = () => { if (!intent.isEnabled) { window.scrollTo(0, pinST.start + 1); intent.enable(); } };
    prevB.addEventListener('click', () => { toJourney(); go(index - 1); });
    nextB.addEventListener('click', () => { toJourney(); go(index + 1); });
    railBtns.forEach((b) => b.addEventListener('click', () => { toJourney(); go(+b.dataset.go); }));
    jumpTo = (i) => { toJourney(); go(i); };
    document.querySelectorAll('a[href="#journey"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); toJourney(); }));
    const onResize = () => gsap.set(track, { x: -index * window.innerWidth });
    window.addEventListener('resize', onResize);
    paint(0, 0);
    return () => { intent.kill(); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); gsap.set(track, { clearProps: 'transform' }); };
  });
  mm.add('(max-width: 900px)', () => {
    stops.forEach((s, i) => ScrollTrigger.create({ trigger: s, start: 'top 60%', end: 'bottom 40%', onToggle: (st) => st.isActive && setActive(i) }));
    setActive(0);
  });

  // count-up for the testimonial number
  const big = document.querySelector('[data-count]');
  if (big) {
    const n = { v: 0 }, target = +big.dataset.count;
    ScrollTrigger.create({ trigger: big, start: 'top 85%', once: true, onEnter: () => gsap.to(n, { v: target, duration: 2.2, ease: 'expo.out', onUpdate: () => { big.textContent = Math.round(n.v).toLocaleString('en-US'); } }) });
  }
  gsap.utils.toArray('[data-reveal]').forEach((el) => gsap.fromTo(el, { autoAlpha: 0, y: 24, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: 'power3.out', clearProps: 'filter', scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));

  // "Flip all" for the presenter
  document.querySelector('[data-flipall]')?.addEventListener('click', (e) => {
    const to = !flips.every((f) => f.on);
    flips.forEach((f, i) => gsap.delayedCall(i * 0.08, () => f.flip(to)));
    e.currentTarget.querySelector('span').textContent = to ? 'Show the chaos again' : 'Flip every stop to Vorta';
  });

  initPicker(STOPS, chaos);
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
init();
