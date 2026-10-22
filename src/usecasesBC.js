// Concepts B and C for the use cases page. Both reuse the stops (roles) of concept A.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PEOPLE = { sales: 'Lejla', product: 'Tarik', procurement: 'Ajla', production: 'Emir', warehouse: 'Mirza', logistics: 'Sara', finance: 'Amina', director: 'Haris' };
const HUE = { sales: 168, product: 200, procurement: 32, production: 260, warehouse: 140, logistics: 220, finance: 300, director: 190 };
const avatar = (s, size = 64) => `<span class="av" style="--h:${HUE[s.id]};width:${size}px;height:${size}px"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="25" r="11" fill="currentColor"/><path d="M10 64c1-15 10-23 22-23s21 8 22 23z" fill="currentColor"/></svg></span>`;

// ================================================================ B: pick your role, drag to clean up
export function initPicker(STOPS, chaos) {
  const root = document.querySelector('[data-picker]'); if (!root) return;
  root.innerHTML = `
    <div class="pk-strip" role="tablist" aria-label="Pick your role">${STOPS.map((s, i) => `<button class="pk-av" role="tab" data-i="${i}" aria-selected="false">${avatar(s, 64)}<b>${PEOPLE[s.id]}</b><span>${s.role}</span></button>`).join('')}</div>
    <div class="pk-body">
      <div class="pk-copy" data-copy></div>
      <div class="pk-stage" data-stage>
        <div class="sc-before" data-before></div>
        <div class="sc-after" data-after></div>
        <div class="pk-handle" data-handle role="slider" tabindex="0" aria-label="Drag to clean up" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i><span>Drag to clean up</span></div>
      </div>
    </div>`;
  const stage = root.querySelector('[data-stage]'), before = root.querySelector('[data-before]'), after = root.querySelector('[data-after]');
  const handle = root.querySelector('[data-handle]'), copy = root.querySelector('[data-copy]'), avs = [...root.querySelectorAll('.pk-av')];
  const pos = { x: 0 };
  const apply = () => {
    const x = Math.max(0, Math.min(100, pos.x));
    after.style.clipPath = `inset(0 ${100 - x}% 0 0)`;
    handle.style.left = `${x}%`;
    handle.setAttribute('aria-valuenow', Math.round(x));
    root.classList.toggle('pk-done', x > 92);
    // chaos on the clean side gets swept away, item by item
    before.querySelectorAll('.ch').forEach((el) => {
      const cx = parseFloat(el.style.left) + 8;
      const gone = cx < x;
      if (el._gone !== gone) { el._gone = gone; gsap.to(el, gone ? { x: 60, autoAlpha: 0, rotation: '+=12', filter: 'blur(6px)', duration: 0.45, ease: 'power2.in' } : { x: 0, autoAlpha: 1, rotation: parseFloat(el.style.getPropertyValue('--r')) || 0, filter: 'blur(0px)', duration: 0.5, ease: 'back.out(1.6)' }); }
    });
  };
  let cur = -1, nudge = null;
  const pick = (i) => {
    if (i === cur) return; cur = i;
    const s = STOPS[i];
    avs.forEach((a, n) => { a.classList.toggle('on', n === i); a.setAttribute('aria-selected', String(n === i)); });
    copy.innerHTML = `<p class="stop-meta"><span class="stop-dept">${s.dept}</span><span class="stop-when">${PEOPLE[s.id]}'s ${s.when.split(' ')[0]}</span></p>
      <h3 class="pk-role">${s.role}</h3>
      <blockquote class="stop-quote">“${esc(s.quote)}”</blockquote>
      <p class="stop-ps"><s>${esc(s.problem)}</s><span class="arr">→</span><b>${esc(s.solution)}</b></p>
      <p class="pk-tip">Drag the handle across the desk ↔</p>`;
    before.innerHTML = s.before.map(chaos).join('');
    after.innerHTML = `<div class="vo">${s.after}</div>`;
    before.querySelectorAll('.ch').forEach((el) => gsap.set(el, { rotation: parseFloat(el.style.getPropertyValue('--r')) || 0 }));
    gsap.fromTo(copy.children, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.05 });
    gsap.fromTo(before.querySelectorAll('.ch'), { y: -40, autoAlpha: 0, scale: 0.9 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.7, ease: 'back.out(1.7)', stagger: 0.06 });
    pos.x = 0; apply();
    // a little nudge so it is obvious the handle moves
    nudge?.kill();
    nudge = gsap.timeline({ delay: 0.9 }).to(pos, { x: 14, duration: 0.6, ease: 'power2.out', onUpdate: apply }).to(pos, { x: 0, duration: 0.7, ease: 'power2.inOut', onUpdate: apply });
  };
  root.querySelector('.pk-strip').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) pick(+b.dataset.i); });
  // dragging: anywhere on the stage works, not just the handle
  let drag = false;
  const toX = (e) => { const r = stage.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
  stage.addEventListener('pointerdown', (e) => { drag = true; nudge?.kill(); stage.setPointerCapture(e.pointerId); gsap.killTweensOf(pos); gsap.to(pos, { x: toX(e), duration: 0.25, ease: 'power2.out', onUpdate: apply }); });
  stage.addEventListener('pointermove', (e) => { if (drag) { gsap.killTweensOf(pos); pos.x = toX(e); apply(); } });   // the finger wins over any easing still running
  stage.addEventListener('pointerup', () => { drag = false; });
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { pos.x += 10; apply(); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { pos.x -= 10; apply(); e.preventDefault(); }
  });
  pick(0);
}

// ================================================================ C: which one are you?
const QUESTIONS = [
  { q: 'What eats most of your day?', a: [
    ['Answering “when will it arrive?”', { sales: 2, logistics: 1 }],
    ['Chasing missing stock or materials', { procurement: 2, warehouse: 1 }],
    ['Deciding what to make first', { production: 2 }],
    ['Fixing codes, prices and paperwork', { product: 2, finance: 1 }],
    ['Asking everyone for a status update', { director: 2 }],
  ] },
  { q: 'Which tool do you live in right now?', a: [
    ['My phone and a dozen chat groups', { sales: 1, logistics: 2, warehouse: 1 }],
    ['One giant Excel file', { product: 2, procurement: 1, finance: 1 }],
    ['The whiteboard on the shop floor', { production: 2, warehouse: 1 }],
    ['Ten reports from ten people', { director: 2, finance: 1 }],
  ] },
  { q: 'What would make next Monday better?', a: [
    ['A delivery date I can promise on the spot', { sales: 3 }],
    ['A truck that leaves full, on the right route', { logistics: 3 }],
    ['Knowing exactly where every pallet is', { warehouse: 3 }],
    ['Shortages flagged weeks ahead', { procurement: 3 }],
    ['A schedule nobody argues about', { production: 3 }],
    ['Invoices that are ready before loading', { finance: 3 }],
    ['New variants without new spreadsheets', { product: 3 }],
    ['One screen with everything on it', { director: 3 }],
  ] },
];

export function initQuiz(STOPS, onSeeJourney) {
  const root = document.querySelector('[data-quiz]'); if (!root) return;
  let step = 0, score = {};
  const card = () => root.querySelector('[data-qcard]');
  root.innerHTML = `<div class="qz-dots" data-dots>${QUESTIONS.map(() => '<i></i>').join('')}<i class="res"></i></div><div class="qz-card glass" data-qcard></div>`;
  const dots = [...root.querySelectorAll('[data-dots] i')];
  const swap = (html, after) => {
    const c = card();
    gsap.to(c.children, { autoAlpha: 0, y: -14, filter: 'blur(6px)', duration: 0.25, stagger: 0.02, ease: 'power2.in', onComplete: () => {
      c.innerHTML = html;
      gsap.fromTo(c.children, { autoAlpha: 0, y: 18, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out', stagger: 0.06, clearProps: 'filter' });
      after?.(c);
    } });
  };
  const showQ = (first) => {
    dots.forEach((d, n) => { d.classList.toggle('on', n === step); d.classList.toggle('done', n < step); });
    const Q = QUESTIONS[step];
    const html = `<p class="qz-n">Question ${step + 1} of ${QUESTIONS.length}</p><h3 class="qz-q">${Q.q}</h3>
      <div class="qz-opts">${Q.a.map((o, i) => `<button class="qz-opt" type="button" data-a="${i}"><span class="k">${String.fromCharCode(65 + i)}</span>${esc(o[0])}</button>`).join('')}</div>`;
    if (first) { card().innerHTML = html; } else swap(html);
  };
  const showResult = () => {
    dots.forEach((d, n) => { d.classList.toggle('on', n === dots.length - 1); d.classList.toggle('done', n < dots.length - 1); });
    const ids = STOPS.map((s) => s.id);
    const best = ids.reduce((a, b) => ((score[b] || 0) > (score[a] || 0) ? b : a), ids[0]);
    const s = STOPS.find((x) => x.id === best), idx = STOPS.indexOf(s);
    swap(`<div class="qz-res">
        <div class="qz-res-copy">
          <p class="qz-n">You are most like</p>
          <div class="qz-who">${avatar(s, 72)}<div><h3 class="qz-q">${PEOPLE[s.id]}, ${s.role.toLowerCase()}</h3><span class="stop-dept">${s.dept}</span></div></div>
          <blockquote class="stop-quote">“${esc(s.quote)}”</blockquote>
          <p class="stop-ps"><s>${esc(s.problem)}</s><span class="arr">→</span><b>${esc(s.solution)}</b></p>
          <div class="qz-actions"><a class="btn btn-primary" href="mailto:hello@vorta.io">Book a demo for my role</a><button class="btn btn-ghost" type="button" data-journey="${idx}">See it in the journey</button><button class="qz-again" type="button" data-again>Take it again</button></div>
        </div>
        <div class="qz-res-ui"><div class="vo">${s.after}</div></div>
      </div>`, (c) => {
      gsap.fromTo(c.querySelector('.qz-who .av'), { scale: 0.4, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.9, ease: 'back.out(2.2)', delay: 0.2 });
    });
  };
  root.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-a]');
    if (opt) {
      opt.classList.add('picked');
      Object.entries(QUESTIONS[step].a[+opt.dataset.a][1]).forEach(([k, v]) => { score[k] = (score[k] || 0) + v; });
      step++;
      gsap.delayedCall(0.25, () => (step < QUESTIONS.length ? showQ() : showResult()));
      return;
    }
    if (e.target.closest('[data-again]')) { step = 0; score = {}; showQ(); return; }
    const j = e.target.closest('[data-journey]');
    if (j) onSeeJourney?.(+j.dataset.journey);
  });
  showQ(true);
}
