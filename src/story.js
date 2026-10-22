// Vorta hero: the pre-rendered Blender story (sofa: workshop -> warehouse -> truck -> shop) scrubbed by scroll.
// Same contract as the old three.js scene (main.js): ui.js owns state.frame, this file only shows that frame.
// Story frames are Blender frames (1..1040 at 24 fps) = video time (frame - 1) / 24.
import { loader, startExperience } from './ui.js';
import './widows.js';

const FPS = 24, LAST = 1040;
const base = import.meta.env.BASE_URL + 'assets/story/';
const stage = document.getElementById('stage');
const world = document.createElement('div');   // canvas + live overlays share one box (ui.js scales it during the reveal)
world.id = 'world';
const canvas = document.createElement('canvas');
canvas.style.objectFit = 'cover';
world.appendChild(canvas);
stage.insertBefore(world, stage.firstChild);
const ctx = canvas.getContext('2d', { alpha: false });

const qFrame = new URLSearchParams(location.search).get('frame');
const state = window.__state = { frame: qFrame !== null ? +qFrame : 1, sunE: 5 };   // sunE 5 = daytime ui colours
window.__hold3D = true;

// ---- which video, and how it gets here ----
// Three encodes of the same story. The starting tier comes from screen and connection hints, then the first second of the
// real download is timed: if the whole file would take too long, drop a tier and start over. Later, if this machine cannot
// seek frames fast enough, the player swaps itself to a lighter tier mid-session (see watchSeekSpeed).
const TIERS = [
  { file: 'story_1080.mp4', bytes: 23.7e6, maxEta: 7 },
  { file: 'story_720.mp4',  bytes: 12.2e6, maxEta: 12 },
  { file: 'story_480.mp4',  bytes: 4.9e6,  maxEta: Infinity },
];
const conn = navigator.connection || {};
const phone = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 700;
const bigScreen = Math.max(innerWidth, innerHeight * 16 / 9) * Math.min(devicePixelRatio, 2) > 1500;
// effectiveType is a rough, jumpy estimate: only an outright 2G/save-data signal skips straight to the lightest tier, 3G picks 720
let tier = (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')) ? 2 : (phone || !bigScreen || conn.effectiveType === '3g') ? 1 : 0;
const qp = new URLSearchParams(location.search);   // test hooks: ?tier=0|1|2 forces a tier, ?fail=1 simulates a missing video
if (qp.has('tier')) tier = Math.min(Math.max(+qp.get('tier') || 0, 0), 2);
const SEEK_LIMIT = qp.has('seeklimit') ? +qp.get('seeklimit') : 32;   // ms per frame seek above which the player drops a tier
const GIVE_UP_MS = 40000;   // a download that is still running after this is treated as failed

const video = document.createElement('video');
video.muted = true; video.playsInline = true; video.preload = 'auto'; video.disablePictureInPicture = true;
video.setAttribute('playsinline', '');

let ticks = 0;
// Download one tier completely (so scrubbing never waits on the network). Resolves { blob }, or { slow: true } when the first
// seconds show that this tier would take too long and a lighter one should be tried. `visible` feeds the loader progress.
async function fetchTier(t, visible) {
  const ctl = new AbortController(), t0 = performance.now();
  const res = await fetch(base + (qp.has('fail') ? 'missing.mp4' : TIERS[t].file), { signal: ctl.signal });
  if (!res.ok) throw new Error('video ' + res.status);
  const total = +res.headers.get('content-length') || TIERS[t].bytes;
  if (visible) loader.expect(12);
  const tick = (got) => { if (!visible) return; while (ticks < 11 && got / total > (ticks + 1) / 12) { ticks++; loader.tick(); } };
  if (!res.body) { const b = await res.blob(); while (visible && ticks < 12) { ticks++; loader.tick(); } return { blob: b }; }
  const reader = res.body.getReader(), chunks = []; let got = 0, probed = false;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    chunks.push(value); got += value.length; tick(got);
    const el = performance.now() - t0;
    if (el > GIVE_UP_MS) { ctl.abort(); throw new Error('video timeout'); }
    if (visible && !probed && el > 1200) {
      probed = true;
      const eta = total / (got / (el / 1000));
      if (t < TIERS.length - 1 && eta > TIERS[t].maxEta) { ctl.abort(); return { slow: true }; }
    }
  }
  if (visible) while (ticks < 11) { ticks++; loader.tick(); }
  return { blob: new Blob(chunks, { type: 'video/mp4' }) };
}
async function fetchVideo() {
  for (;;) {
    const r = await fetchTier(tier, true);
    if (r.blob) return r.blob;
    tier++;   // too slow for this tier: start over with the next lighter one
  }
}

let shown = -1, seeking = false;
function draw() {
  if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
  ctx.drawImage(video, 0, 0);
  state.shown = shown;
}
let seekT0 = 0, lat = [], swapping = false;
function pump() {
  if (seeking || swapping) return;
  const f = Math.min(Math.max(Math.round(state.frame), 1), LAST);
  if (f === shown) return;
  shown = f; seeking = true; seekT0 = performance.now();
  video.currentTime = (f - 1) / FPS + 0.002;
}
video.addEventListener('seeked', () => {
  draw(); seeking = false;
  const ms = performance.now() - seekT0;
  if (ms < 250) lat.push(ms);   // longer ones are a hidden tab, not the machine
  if (lat.length >= 60) { const v = lat.slice(10).sort((a, b) => a - b), med = v[v.length >> 1]; lat = []; if (med > SEEK_LIMIT) lowerTier(); }
});
// This machine cannot keep up with 24 fps at this size: quietly fetch the next lighter tier and swap to it at the same time.
async function lowerTier() {
  window.__lowPower = true;   // the live dust overlay is switched off too
  if (swapping || tier >= TIERS.length - 1) return;
  swapping = true;
  try {
    const r = await fetchTier(tier + 1, false); if (!r.blob) return;
    const at = video.currentTime;
    await new Promise((res) => { video.addEventListener('loadeddata', res, { once: true }); video.src = URL.createObjectURL(r.blob); video.load(); });
    tier++; video.currentTime = at;
    await new Promise((res) => video.addEventListener('seeked', res, { once: true }));
    draw(); shown = -1;
  } catch { /* keep playing the current tier */ }
  swapping = false; seeking = false; lat = [];
}
function loop() {
  if (!window.__offscreen) pump();
  requestAnimationFrame(loop);
}

async function showFallback() {   // no video (offline, blocked, too slow): a still of the last frame, the banner and the page
  window.__storyFailed = true;
  const img = new Image(); img.src = base + 'poster.jpg';
  try { await img.decode(); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; ctx.drawImage(img, 0, 0); } catch { /* plain background */ }
  state.frame = LAST; window.__ready = true; window.__cityReady = true;
  startExperience({ state, pinned: false });
}
(async () => {
  try {
    const blob = await fetchVideo();
    video.src = URL.createObjectURL(blob);
    await new Promise((res, rej) => { video.addEventListener('loadeddata', res, { once: true }); video.addEventListener('error', () => rej(new Error('decode')), { once: true }); video.load(); });
    loader.tick();
    pump();
    await new Promise((res) => video.addEventListener('seeked', res, { once: true }));
  } catch (e) { console.warn('story video unavailable:', e); return showFallback(); }
  window.__ready = true; window.__cityReady = true;
  requestAnimationFrame(loop);
  startExperience({ state, pinned: qFrame !== null });
})();


// ---- live layer: the wall clock keeps its own time, independent of scroll / the scrubbed video ----
// The camera is fixed, so the clock face sits at a constant spot of the 1000 x 562.5 frame; the matrix below maps
// clock-plane units (1 = bezel radius, y down) to that frame (projected from the Blender camera).
const NS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(NS, 'svg');
svg.setAttribute('viewBox', '0 0 1000 562.5'); svg.setAttribute('aria-hidden', 'true');
svg.style.cssText = 'position:absolute;pointer-events:none;overflow:visible';
svg.innerHTML = `
<defs>
  <radialGradient id="sg"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".6" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
</defs>
<g id="cam" transform="matrix(1.10127 0 0 1.10127 25.45 -46.439)">
<g id="shim" style="mix-blend-mode:screen">
  <g filter="url(#soft)" fill="#fff">
    <polygon class="sh" points="334.7,40.5 444.2,67.9 444.2,153.9 334.7,126.5"/>
    <polygon class="sh" points="573.6,100.3 688,128.9 688,214.9 573.6,186.3"/>
    <polygon class="sh" points="757.7,146.3 842.3,167.5 842.3,253.5 757.7,232.3"/>
  </g>
  <ellipse class="fl" cx="340" cy="281" rx="118" ry="38" transform="rotate(14 340 281)" fill="url(#sg)"/>
  <ellipse class="fl" cx="581" cy="341" rx="118" ry="38" transform="rotate(14 581 341)" fill="url(#sg)"/>
  <ellipse class="fl" cx="751" cy="384" rx="105" ry="34" transform="rotate(14 751 384)" fill="url(#sg)"/>
</g>
<g transform="matrix(20.9033 5.2273 0 21.7569 501.1011 101.8357)" fill="rgb(52,64,96)">
  <rect id="clk-h" x="-0.065" y="-0.42" width="0.13" height="0.54" rx="0.05"/>
  <rect id="clk-m" x="-0.045" y="-0.66" width="0.09" height="0.78" rx="0.04"/>
  <g id="clk-s"><rect x="-0.012" y="-0.70" width="0.024" height="0.9" fill="rgb(255,107,74)"/><circle r="0.06" fill="rgb(255,107,74)"/></g>
  <circle r="0.075"/>
</g>
</g>`;
world.appendChild(svg);
function fitOverlay() {
  const W = stage.clientWidth, H = stage.clientHeight, k = Math.max(W / 1000, H / 562.5);
  svg.style.width = 1000 * k + 'px'; svg.style.height = 562.5 * k + 'px';
  svg.style.left = (W - 1000 * k) / 2 + 'px'; svg.style.top = (H - 562.5 * k) / 2 + 'px';
}
fitOverlay(); addEventListener('resize', fitOverlay);
const hH = svg.querySelector('#clk-h'), hM = svg.querySelector('#clk-m'), hS = svg.querySelector('#clk-s');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
function tickClock(now = performance.now()) {
  if (calm) {   // reduced motion: honest wall-clock time, one tick a second
    const d = new Date(), min = d.getMinutes() + d.getSeconds() / 60, hr = (d.getHours() % 12) + min / 60;
    hH.setAttribute('transform', `rotate(${hr * 30})`); hM.setAttribute('transform', `rotate(${min * 6})`); hS.setAttribute('transform', `rotate(${d.getSeconds() * 6})`);
    setTimeout(tickClock, 1000); return;
  }
  // time-lapse so the hands read as clearly moving: minute hand 10 s per turn, hour hand 120 s, second hand 2 s
  const t = now / 1000;
  hM.setAttribute('transform', `rotate(${(t * 36) % 360})`);
  hH.setAttribute('transform', `rotate(${(t * 3 + 300) % 360})`);
  hS.setAttribute('transform', `rotate(${(t * 180) % 360})`);
  requestAnimationFrame(tickClock);
}
tickClock();

// ---- live layer 2: fan blades, mug steam, window-light shimmer, dust motes (all real-time, independent of scroll) ----
const shims = [...svg.querySelectorAll('.sh')], floors = [...svg.querySelectorAll('.fl')];
const dust = document.createElement('canvas');
dust.style.cssText = 'position:absolute;pointer-events:none';
world.appendChild(dust);
const dctx = dust.getContext('2d');
const rnd = (a, b) => a + Math.random() * (b - a);
const motes = Array.from({ length: 70 }, () => ({ x: rnd(260, 880), y: rnd(60, 380), vx: rnd(-3, 3), vy: rnd(-5, 1.5), r: rnd(.7, 2), ph: rnd(0, 6.3), sp: rnd(.4, 1.3) }));
let dK = 1, dW = 0, dH = 0;
function fitDust() {
  const W = stage.clientWidth, H = stage.clientHeight, k = Math.max(W / 1000, H / 562.5), dpr = Math.min(devicePixelRatio || 1, 2);
  dK = k * dpr; dW = Math.round(1000 * k * dpr); dH = Math.round(562.5 * k * dpr);
  dust.width = dW; dust.height = dH;
  dust.style.width = 1000 * k + 'px'; dust.style.height = 562.5 * k + 'px';
  dust.style.left = (W - 1000 * k) / 2 + 'px'; dust.style.top = (H - 562.5 * k) / 2 + 'px';
}
fitDust(); addEventListener('resize', fitDust);
let last = performance.now();
function liveLoop(now) {
  const dt = Math.min((now - last) / 1000, .1); last = now; const t = now / 1000;
  shims.forEach((g, i) => { g.style.opacity = (.10 + .06 * Math.sin(t * .35 + i * 1.7) + .035 * Math.sin(t * .83 + i * 3.1)).toFixed(3); });
  floors.forEach((g, i) => { g.style.opacity = (.10 + .07 * Math.sin(t * .3 + i * 2.1 + 1) + .03 * Math.sin(t * .71 + i)).toFixed(3); g.style.transform = `translate(${Math.sin(t * .12 + i) * 18}px,${Math.sin(t * .12 + i) * 4.5}px)`; });
  dctx.clearRect(0, 0, dW, dH);
  for (const m of (window.__lowPower ? [] : motes)) {
    m.x += (m.vx + Math.sin(t * .6 + m.ph) * 3) * dt; m.y += (m.vy + Math.cos(t * .5 + m.ph) * 2.5) * dt;
    if (m.y < 30) { m.y = 400; m.x = rnd(260, 880); } if (m.x < 200) m.x = 880; if (m.x > 900) m.x = 220; if (m.y > 420) m.y = 40;
    const tw = .5 + .5 * Math.sin(t * m.sp * 2 + m.ph), a = (.18 + .5 * tw) * (m.y < 260 ? 1 : .6);
    dctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    dctx.beginPath(); dctx.arc((m.x * 1.10127 + 25.45) * dK, (m.y * 1.10127 - 46.439) * dK, m.r * 1.10127 * dK, 0, 6.2832); dctx.fill();
  }
  if (calm) return;
  requestAnimationFrame(liveLoop);
}
if (!calm) requestAnimationFrame(liveLoop); else liveLoop(performance.now());
