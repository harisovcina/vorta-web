// Interactive product mockup for "The product" section.
// Everything here is sample data: it shows how Vorta works, it is not connected to anything.
import gsap from 'gsap';
import { ico } from './protoIcons.js';

const eur = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- sample data
const ORDERS = [
  { no: 'ORD-2851', customer: 'Hartmann Möbel', country: 'DE', status: 'Confirmed', prod: 'Ordered', ship: 'N/A', cw: 46, items: 14, amount: 7070.2 },
  { no: 'ORD-2850', customer: 'Nordhaus Interiors', country: 'DK', status: 'In production', prod: 'Partial', ship: 'Planned', cw: 44, items: 32, amount: 5412.0 },
  { no: 'ORD-2849', customer: 'Kuhn & Söhne', country: 'AT', status: 'Shipped', prod: 'Done', ship: 'In transit', cw: 43, items: 8, amount: 1890.5 },
  { no: 'ORD-2848', customer: 'Atelier Ravel', country: 'FR', status: 'In production', prod: 'Partial', ship: 'Planned', cw: 44, items: 21, amount: 3366.4 },
  { no: 'ORD-2847', customer: 'Casa Milano', country: 'IT', status: 'Confirmed', prod: 'Ordered', ship: 'N/A', cw: 47, items: 6, amount: 1204.0 },
  { no: 'ORD-2846', customer: 'Berger Handel', country: 'DE', status: 'Shipped', prod: 'Done', ship: 'Delivered', cw: 42, items: 40, amount: 6280.0 },
  { no: 'ORD-2845', customer: 'Skandi Living', country: 'SE', status: 'In production', prod: 'Ordered', ship: 'Planned', cw: 45, items: 12, amount: 2210.8 },
  { no: 'ORD-2844', customer: 'Van Dijk Wonen', country: 'NL', status: 'Shipped', prod: 'Done', ship: 'Delivered', cw: 41, items: 3, amount: 189.0 },
];
const STATUS_CLS = { Confirmed: 's-conf', 'In production': 's-prod', Shipped: 's-ship', Ordered: 's-muted', Partial: 's-prod', Done: 's-ok', 'N/A': 's-muted', Planned: 's-conf', 'In transit': 's-prod', Delivered: 's-ok' };
const pill = (t) => `<span class="pr-pill ${STATUS_CLS[t] || 's-muted'}"><i></i>${esc(t)}</span>`;

const SHIP_ORDERS = [
  { no: 'ORD-2850', to: 'Aarhus, DK', kg: 980, m3: 11.2, pal: 8, on: true },
  { no: 'ORD-2848', to: 'Paris, FR', kg: 640, m3: 7.9, pal: 5, on: true },
  { no: 'ORD-2845', to: 'Berlin, DE', kg: 412, m3: 4.6, pal: 3, on: true },
  { no: 'ORD-2843', to: 'Milan, IT', kg: 767, m3: 8.0, pal: 6, on: true },
  { no: 'ORD-2841', to: 'Munich, DE', kg: 1240, m3: 9.8, pal: 7, on: false },
  { no: 'ORD-2839', to: 'Lyon, FR', kg: 520, m3: 5.1, pal: 4, on: false },
];
const CAP = { kg: 24000, m3: 46, pal: 33 };
const STOPS = [   // in driving order
  { city: 'Aarhus', cc: 'DK', x: 214, y: 34, date: '04–05 Nov' },
  { city: 'Berlin', cc: 'DE', x: 268, y: 92, date: '06 Nov' },
  { city: 'Munich', cc: 'DE', x: 246, y: 160, date: 'Date needs to be set', warn: true, need: 'ORD-2841' },
  { city: 'Milan', cc: 'IT', x: 226, y: 222, date: '08 Nov' },
  { city: 'Lyon', cc: 'FR', x: 138, y: 206, date: 'Date needs to be set', warn: true, need: 'ORD-2839' },
  { city: 'Paris', cc: 'FR', x: 112, y: 150, date: '10–11 Nov' },
];

const OPTION_GROUPS = [
  { name: 'Upholstery', opts: [['Black', 1], ['Natural', 1], ['Smoked', 1], ['White', 0], ['Sand', 0]] },
  { name: 'Wood', opts: [['Beech', 1], ['Oak', 1], ['Walnut', 0], ['Ash', 0]] },
  { name: 'Glides', opts: [['Felt', 1], ['Plastic', 1]] },
  { name: 'Label', opts: [['Vorta', 1], ['Private label', 0]] },
];
const CODES = { Black: 'BLK', Natural: 'NAT', Smoked: 'SMK', White: 'WHT', Sand: 'SND', Beech: 'BCH', Oak: 'OAK', Walnut: 'WAL', Ash: 'ASH', Felt: 'FLT', Plastic: 'PLS', Vorta: 'VT', 'Private label': 'PL' };

const MATERIALS = [
  { name: 'Oak board 26 mm', type: 'Wood', unit: 'm²', stock: -12, demand: 48, min: 30, sup: 'Northwood Timber', wh: 'Sarajevo' },
  { name: 'Beech board 22 mm', type: 'Wood', unit: 'm²', stock: 64, demand: 40, min: 30, sup: 'Northwood Timber', wh: 'Sarajevo' },
  { name: 'Wood screw 4×40', type: 'Hardware', unit: 'pcs', stock: 820, demand: 1400, min: 1000, sup: 'FastFix Metals', wh: 'Tuzla' },
  { name: 'Velvet fabric, smoked', type: 'Fabric', unit: 'm', stock: 18, demand: 62, min: 40, sup: 'Lumen Textiles', wh: 'Sarajevo' },
  { name: 'PU foam 40 kg/m³', type: 'Foam', unit: 'pcs', stock: 96, demand: 70, min: 60, sup: 'FoamWorks Ltd', wh: 'Tuzla' },
  { name: 'Matt lacquer 5 L', type: 'Finish', unit: 'can', stock: 4, demand: 11, min: 8, sup: 'Clearcoat Finishes', wh: 'Sarajevo' },
  { name: 'Metal leg, black', type: 'Hardware', unit: 'pcs', stock: 140, demand: 132, min: 120, sup: 'IronBase Works', wh: 'Tuzla' },
  { name: 'Felt glide 24 mm', type: 'Hardware', unit: 'pcs', stock: -40, demand: 320, min: 200, sup: 'FastFix Metals', wh: 'Tuzla' },
];
const matState = (m) => (m.stock < m.min ? (m.stock + 0 >= m.min * 0.8 ? 'near' : 'low') : (m.stock < m.min * 1.15 ? 'near' : 'ok'));

const REPORT = {
  Weekly: { labels: ['W38', 'W39', 'W40', 'W41', 'W42', 'W43', 'W44', 'W45'], vals: [42, 51, 47, 63, 58, 71, 66, 79], ontime: 94, lead: 11 },
  Monthly: { labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], vals: [182, 204, 171, 158, 236, 261], ontime: 92, lead: 12 },
  Yearly: { labels: ['2021', '2022', '2023', '2024', '2025', '2026'], vals: [1.4, 1.9, 2.2, 2.6, 2.9, 3.3], ontime: 89, lead: 14, unit: 'M €' },
};

// ---------------------------------------------------------------- modules
const MODULES = [
  { id: 'orders', label: 'Orders', icon: 'shopping-cart', slug: 'orders' },
  { id: 'shipments', label: 'Shipments', icon: 'truck', slug: 'shipments/C250002' },
  { id: 'products', label: 'Products', icon: 'package', slug: 'products/amsterdam-plus-xxxl' },
  { id: 'inventory', label: 'Inventory', icon: 'warehouse', slug: 'inventory/materials' },
  { id: 'reports', label: 'Reports', icon: 'chart-column', slug: 'reports/sales' },
  { id: 'portal', label: 'Customer portal', icon: 'store', slug: 'portal/preview' },
];

const head = (title, sub, right = '') => `<header class="pr-head"><div><p class="pr-crumb">${esc(sub)}</p><h3 class="pr-title">${esc(title)}</h3></div><div class="pr-head-r">${right}</div></header>`;

// ---------- Orders
function viewOrders(root, ctx) {
  let filter = 'All', q = '';
  const tabs = ['All', 'Confirmed', 'In production', 'Shipped'];
  root.innerHTML = head('Customer orders', 'Sales · Orders', `<button class="pr-btn pr-btn-p" data-new>${ico('plus', 14)}New order</button>`) + `
    <div class="pr-kpis">
      <div class="pr-kpi"><b>${ORDERS.length}</b><span>Open orders</span></div>
      <div class="pr-kpi"><b>94%</b><span>On time</span></div>
      <div class="pr-kpi"><b>${ORDERS.filter((o) => o.ship === 'Planned').length}</b><span>Ready to ship</span></div>
      <div class="pr-kpi"><b>${(ORDERS.reduce((a, o) => a + o.amount, 0) / 1000).toFixed(1)}k €</b><span>Order value</span></div>
    </div>
    <div class="pr-bar">
      <div class="pr-tabs" role="tablist">${tabs.map((t) => `<button role="tab" class="pr-tab" data-tab="${t}">${t}</button>`).join('')}</div>
      <label class="pr-search">${ico('search', 14)}<input type="search" placeholder="Search customer or order" aria-label="Search orders"></label>
    </div>
    <div class="pr-table pr-orders" role="table">
      <div class="pr-tr pr-th" role="row"><span class="col-no">Order</span><span>Customer</span><span>Status</span><span class="hide-s">Production</span><span class="hide-s">Shipment</span><span class="hide-m">CW</span><span class="num">Amount</span></div>
      <div data-rows></div>
    </div>
    <p class="pr-foot">Click a row to open the order</p>
    <div class="pr-drawer" data-drawer aria-hidden="true"></div>`;
  const rowsEl = root.querySelector('[data-rows]'), drawer = root.querySelector('[data-drawer]');
  const draw = () => {
    const rows = ORDERS.filter((o) => (filter === 'All' || o.status === filter) && (!q || (o.customer + o.no).toLowerCase().includes(q)));
    rowsEl.innerHTML = rows.length ? rows.map((o) => `<button class="pr-tr pr-row" data-no="${o.no}" role="row"><span class="mono col-no">${o.no}</span><span class="cust"><i class="cc">${o.country}</i>${esc(o.customer)}</span><span>${pill(o.status)}</span><span class="hide-s">${pill(o.prod)}</span><span class="hide-s">${pill(o.ship)}</span><span class="hide-m mono">${o.cw}</span><span class="num mono">${eur(o.amount)}</span></button>`).join('')
      : '<p class="pr-empty">No orders match. Try another filter.</p>';
    root.querySelectorAll('.pr-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === filter));
    gsap.fromTo(rowsEl.children, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.025, ease: 'power2.out' });
  };
  root.querySelector('.pr-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { filter = b.dataset.tab; draw(); } });
  root.querySelector('input').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
  root.querySelector('[data-new]').addEventListener('click', () => ctx.toast('This is a mockup: new orders are not saved'));
  const steps = ['Ordered', 'Confirmed', 'In production', 'Shipped', 'Delivered'];
  rowsEl.addEventListener('click', (e) => {
    const r = e.target.closest('[data-no]'); if (!r) return;
    const o = ORDERS.find((x) => x.no === r.dataset.no);
    const at = o.ship === 'Delivered' ? 4 : o.status === 'Shipped' ? 3 : o.status === 'In production' ? 2 : 1;
    drawer.innerHTML = `<div class="pr-dr-in">
      <div class="pr-dr-h"><div><p class="pr-crumb">Order</p><h4>${o.no}</h4></div><button class="pr-icon" data-close aria-label="Close">${ico('x', 16)}</button></div>
      <p class="pr-dr-c">${esc(o.customer)} · ${o.country}</p>
      <ol class="pr-steps">${steps.map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><i>${i < at ? ico('check', 12) : ''}</i>${s}</li>`).join('')}</ol>
      <div class="pr-dr-grid"><div><span>Items</span><b>${o.items}</b></div><div><span>Delivery</span><b>CW ${o.cw}</b></div><div><span>Amount</span><b>${eur(o.amount)}</b></div></div>
      <div class="pr-lines">${['Amsterdam Plus chair, oak / smoked', 'Lund table 180, beech', 'Felt glides, pack of 4'].map((l, i) => `<div><span>${l}</span><span class="mono">${[Math.ceil(o.items * 0.6), Math.ceil(o.items * 0.3), Math.max(1, Math.floor(o.items * 0.1))][i]} ×</span></div>`).join('')}</div>
    </div>`;
    drawer.classList.add('on'); drawer.setAttribute('aria-hidden', 'false');
    gsap.fromTo(drawer.firstElementChild, { xPercent: 100 }, { xPercent: 0, duration: 0.5, ease: 'expo.out' });
    gsap.fromTo(drawer.querySelectorAll('.pr-steps li'), { autoAlpha: 0, x: 10 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.06, delay: 0.15 });
  });
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer || e.target.closest('[data-close]')) {
      gsap.to(drawer.firstElementChild, { xPercent: 100, duration: 0.35, ease: 'power2.in', onComplete: () => { drawer.classList.remove('on'); drawer.setAttribute('aria-hidden', 'true'); } });
    }
  });
  draw();
}

// ---------- Shipments
function viewShipments(root, ctx) {
  root.innerHTML = head('Shipment C250002', 'Logistics · Collective shipment', `<span class="pr-tag">Planned</span><button class="pr-btn pr-btn-p" data-save>${ico('check', 14)}Save</button>`) + `
    <div class="pr-ship">
      <div class="pr-ship-l">
        <div class="pr-caps" data-caps></div>
        <p class="pr-sub">Orders in this truck <em>tick to add or remove</em></p>
        <div class="pr-checks" data-checks></div>
      </div>
      <div class="pr-ship-r">
        <div class="pr-map" data-map></div>
        <ol class="pr-stops" data-stops></ol>
      </div>
    </div>`;
  const capsEl = root.querySelector('[data-caps]'), checks = root.querySelector('[data-checks]'), mapEl = root.querySelector('[data-map]'), stopsEl = root.querySelector('[data-stops]');
  const cap = (k, label, unit, dec = 0) => {
    const v = SHIP_ORDERS.filter((o) => o.on).reduce((a, o) => a + o[k], 0), pct = Math.min(100, (v / CAP[k]) * 100);
    return `<div class="pr-cap"><div class="pr-cap-t"><span>${label}</span><b>${v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })} <i>/ ${CAP[k].toLocaleString('en-US')} ${unit}</i></b></div><div class="pr-meter"><i style="width:${pct}%"></i></div></div>`;
  };
  const draw = (first) => {
    const prev = [...capsEl.querySelectorAll('.pr-meter i')].map((i) => i.style.width);
    const loaded = SHIP_ORDERS.filter((o) => o.on);
    const fill = Math.round(Math.max(...['kg', 'm3', 'pal'].map((k) => loaded.reduce((a, o) => a + o[k], 0) / CAP[k])) * 100);
    capsEl.innerHTML = `<div class="pr-cap-big"><b data-fill>${fill}%</b><span>truck filled<br>MAN TGX 18.500 · A12-B-456</span></div>` + cap('kg', 'Weight', 'kg') + cap('m3', 'Volume', 'm³', 1) + cap('pal', 'Pallets', '');
    if (!first) capsEl.querySelectorAll('.pr-meter i').forEach((i, n) => gsap.fromTo(i, { width: prev[n] }, { width: i.style.width, duration: 0.7, ease: 'expo.out' }));
    checks.innerHTML = SHIP_ORDERS.map((o, n) => `<button class="pr-check ${o.on ? 'on' : ''}" data-i="${n}" aria-pressed="${o.on}"><i>${ico('check', 12)}</i><span class="mono">${o.no}</span><span class="to">${o.to}</span><span class="mono dim">${o.pal} pal</span></button>`).join('');
    const active = STOPS.filter((s) => !s.need || SHIP_ORDERS.find((o) => o.no === s.need)?.on);
    const pts = active.map((s) => `${s.x},${s.y}`).join(' ');
    mapEl.innerHTML = `<svg viewBox="0 0 340 250" aria-label="Route map">
      <defs><pattern id="pr-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="currentColor" opacity=".25"/></pattern></defs>
      <rect width="340" height="250" fill="url(#pr-dots)"/>
      <path d="M150 20 L230 10 L300 60 L310 130 L280 200 L250 245 L180 240 L120 220 L70 180 L60 120 L90 60 Z" fill="currentColor" opacity=".06"/>
      <polyline points="${pts}" fill="none" stroke="var(--color-accent)" stroke-width="1.6" stroke-dasharray="4 5" class="pr-route"/>
      ${active.map((s, i) => `<g class="pr-pin ${s.warn ? 'warn' : ''}" data-stop="${s.city}"><circle cx="${s.x}" cy="${s.y}" r="11" class="halo"/><circle cx="${s.x}" cy="${s.y}" r="8"/><text x="${s.x}" y="${s.y + 3.5}" text-anchor="middle">${i + 1}</text></g>`).join('')}
    </svg>`;
    stopsEl.innerHTML = active.map((s, i) => `<li data-stop="${s.city}" tabindex="0"><b>${i + 1}</b><span>${s.city}, ${s.cc}</span><em class="${s.warn ? 'warn' : ''}">${s.date}</em></li>`).join('');
    const route = mapEl.querySelector('.pr-route');
    gsap.fromTo(route, { strokeDashoffset: 60 }, { strokeDashoffset: 0, duration: 1.6, ease: 'none', repeat: -1 });
  };
  checks.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const o = SHIP_ORDERS[+b.dataset.i]; o.on = !o.on;
    const kg = SHIP_ORDERS.filter((x) => x.on).reduce((a, x) => a + x.kg, 0);
    draw(false);
    ctx.toast(o.on ? `${o.no} added: ${o.to}` : `${o.no} removed from the truck`);
    if (kg === 0) ctx.toast('Empty truck. Add an order to plan the route');
  });
  const hl = (city, on) => root.querySelectorAll(`[data-stop="${city}"]`).forEach((n) => n.classList.toggle('hl', on));
  root.addEventListener('pointerover', (e) => { const s = e.target.closest('[data-stop]'); if (s) hl(s.dataset.stop, true); });
  root.addEventListener('pointerout', (e) => { const s = e.target.closest('[data-stop]'); if (s) hl(s.dataset.stop, false); });
  root.querySelector('[data-save]').addEventListener('click', () => ctx.toast('Shipment saved (not really, this is a mockup)'));
  draw(true);
}

// ---------- Products
function viewProducts(root, ctx) {
  root.innerHTML = head('Amsterdam Plus XXXL', 'Catalog · Lounge chair', `<span class="pr-tag ok">Published</span>`) + `
    <div class="pr-prod">
      <div class="pr-prod-l">
        <div class="pr-kpis pr-kpis-3"><div class="pr-kpi"><b data-sku>0</b><span>SKUs generated</span></div><div class="pr-kpi"><b data-pl>0</b><span>Price lists</span></div><div class="pr-kpi"><b>0</b><span>Duplicates</span></div></div>
        <p class="pr-sub">Options <em>click to switch variants on or off</em></p>
        <div class="pr-groups" data-groups></div>
      </div>
      <div class="pr-prod-r">
        <p class="pr-sub">Generated SKUs</p>
        <ul class="pr-skus" data-skus></ul>
      </div>
    </div>`;
  const groupsEl = root.querySelector('[data-groups]'), skusEl = root.querySelector('[data-skus]');
  const skuEl = root.querySelector('[data-sku]'), plEl = root.querySelector('[data-pl]');
  const counter = { sku: 0, pl: 0 };
  const draw = () => {
    groupsEl.innerHTML = OPTION_GROUPS.map((g, gi) => {
      const n = g.opts.filter((o) => o[1]).length;
      return `<div class="pr-group"><div class="pr-group-h"><span>${g.name}</span><em class="mono">${n} of ${g.opts.length}</em></div><div class="pr-opts">${g.opts.map((o, oi) => `<button class="pr-opt ${o[1] ? 'on' : ''}" data-g="${gi}" data-o="${oi}" aria-pressed="${!!o[1]}">${o[1] ? ico('check', 12) : ico('plus', 12)}${o[0]}</button>`).join('')}</div></div>`;
    }).join('');
    const on = OPTION_GROUPS.map((g) => g.opts.filter((o) => o[1]).map((o) => o[0]));
    const total = on.reduce((a, l) => a * Math.max(l.length, 1), 1);
    const combos = [];
    const walk = (i, acc) => { if (combos.length >= 7) return; if (i === on.length) { combos.push(acc); return; } (on[i].length ? on[i] : ['—']).forEach((v) => walk(i + 1, [...acc, v])); };
    walk(0, []);
    skusEl.innerHTML = combos.map((c) => `<li><span class="mono">AMS-XXXL-${c.map((v) => CODES[v] || '—').join('-')}</span><em>${c.join(' · ')}</em></li>`).join('') + (total > combos.length ? `<li class="more">+ ${total - combos.length} more</li>` : '');
    gsap.to(counter, { sku: total, pl: on[3].length * 4, duration: 0.6, ease: 'power2.out', onUpdate: () => { skuEl.textContent = Math.round(counter.sku); plEl.textContent = Math.round(counter.pl); } });
    gsap.fromTo(skusEl.children, { autoAlpha: 0, x: 8 }, { autoAlpha: 1, x: 0, duration: 0.3, stagger: 0.03 });
  };
  groupsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const g = OPTION_GROUPS[+b.dataset.g], o = g.opts[+b.dataset.o];
    if (o[1] && g.opts.filter((x) => x[1]).length === 1) { ctx.toast(`${g.name} needs at least one option`); return; }
    o[1] = o[1] ? 0 : 1; draw();
  });
  draw();
}

// ---------- Inventory
function viewInventory(root, ctx) {
  let wh = 'All warehouses';
  const ordered = new Set();
  root.innerHTML = head('Material inventory', 'Production · Materials', `<label class="pr-select">${ico('warehouse', 14)}<select aria-label="Warehouse"><option>All warehouses</option><option>Sarajevo</option><option>Tuzla</option></select></label>`) + `
    <div class="pr-kpis pr-kpis-3" data-sum></div>
    <div class="pr-table pr-inv" role="table">
      <div class="pr-tr pr-th" role="row"><span>Material</span><span class="hide-s">Supplier</span><span class="num">In stock</span><span class="num hide-m">Demand</span><span>Status</span><span></span></div>
      <div data-rows></div>
    </div>
    <div class="pr-actions"><p class="pr-foot">Shortages are calculated from open orders</p><button class="pr-btn pr-btn-p" data-gen>${ico('sparkles', 14)}Generate supplier orders</button></div>`;
  const rowsEl = root.querySelector('[data-rows]'), sum = root.querySelector('[data-sum]');
  const label = { low: 'Below minimum', near: 'Near minimum', ok: 'OK' };
  const draw = () => {
    const list = MATERIALS.filter((m) => wh === 'All warehouses' || m.wh === wh);
    const c = { low: 0, near: 0, ok: 0 }; list.forEach((m) => c[matState(m)]++);
    sum.innerHTML = `<div class="pr-kpi"><b class="t-low">${c.low}</b><span>Below minimum</span></div><div class="pr-kpi"><b class="t-near">${c.near}</b><span>Near minimum</span></div><div class="pr-kpi"><b>${c.ok}</b><span>OK</span></div>`;
    rowsEl.innerHTML = list.map((m) => {
      const st = matState(m), done = ordered.has(m.name);
      return `<div class="pr-tr pr-row" role="row"><span>${esc(m.name)}<em class="dim"> · ${m.type}</em></span><span class="hide-s dim">${m.sup}</span><span class="num mono ${m.stock < 0 ? 't-low' : ''}">${m.stock} ${m.unit}</span><span class="num mono hide-m">${m.demand}</span><span><span class="pr-pill st-${st}"><i></i>${label[st]}</span></span><span class="num">${st === 'ok' ? '' : done ? `<span class="pr-done">${ico('check', 12)}Ordered</span>` : `<button class="pr-btn pr-btn-s" data-order="${esc(m.name)}">Order</button>`}</span></div>`;
    }).join('');
    gsap.fromTo(rowsEl.children, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.025 });
  };
  root.querySelector('select').addEventListener('change', (e) => { wh = e.target.value; draw(); });
  rowsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-order]'); if (!b) return; ordered.add(b.dataset.order); ctx.toast(`Order drafted for ${b.dataset.order}`); draw(); });
  root.querySelector('[data-gen]').addEventListener('click', () => {
    const need = MATERIALS.filter((m) => matState(m) !== 'ok' && !ordered.has(m.name));
    if (!need.length) { ctx.toast('Nothing left to order'); return; }
    need.forEach((m) => ordered.add(m.name));
    const sups = new Set(need.map((m) => m.sup)).size;
    ctx.toast(`${need.length} materials grouped into ${sups} supplier orders`); draw();
  });
  draw();
}

// ---------- Reports
function viewReports(root, ctx) {
  let period = 'Weekly';
  root.innerHTML = head('Sales report', 'Business intelligence · Sales', `<div class="pr-tabs" role="tablist">${Object.keys(REPORT).map((p) => `<button class="pr-tab" data-p="${p}">${p}</button>`).join('')}</div>`) + `
    <div class="pr-kpis pr-kpis-3" data-k></div>
    <div class="pr-chart" data-chart></div>
    <p class="pr-foot">Hover the bars for values</p>`;
  const chart = root.querySelector('[data-chart]'), kEl = root.querySelector('[data-k]');
  const draw = () => {
    const r = REPORT[period], max = Math.max(...r.vals), unit = r.unit || 'k €';
    root.querySelectorAll('[data-p]').forEach((b) => b.classList.toggle('on', b.dataset.p === period));
    const total = r.vals.reduce((a, v) => a + v, 0);
    kEl.innerHTML = `<div class="pr-kpi"><b>${unit === 'k €' ? total + 'k €' : total.toFixed(1) + 'M €'}</b><span>Revenue</span></div><div class="pr-kpi"><b>${r.ontime}%</b><span>Delivered on time</span></div><div class="pr-kpi"><b>${r.lead} days</b><span>Avg. lead time</span></div>`;
    chart.innerHTML = `<div class="pr-bars">${r.vals.map((v, i) => `<div class="pr-bar-c" tabindex="0"><span class="pr-tip">${v}${unit === 'k €' ? 'k €' : 'M €'}</span><i style="height:${(v / max) * 100}%"></i><em>${r.labels[i]}</em></div>`).join('')}</div>`;
    gsap.fromTo(chart.querySelectorAll('.pr-bar-c i'), { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: 'expo.out', stagger: 0.04, transformOrigin: '50% 100%' });
  };
  root.querySelector('.pr-head .pr-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) { period = b.dataset.p; draw(); } });
  draw();
}

// ---------- Customer portal
function viewPortal(root, ctx) {
  root.innerHTML = head('Customer portal preview', 'What your customers see', `<span class="pr-tag">portal.nordhaus.com</span>`) + `
    <div class="pr-portal">
      <div class="pr-portal-top"><b>NORDHAUS</b><nav><button class="on" data-pt="overview">Overview</button><button data-pt="orders">Orders</button><button data-pt="ship">Shipments</button></nav><span class="dim">Lukas M.</span></div>
      <div class="pr-portal-body" data-pb></div>
      <p class="pr-powered">Powered by Vorta</p>
    </div>`;
  const pb = root.querySelector('[data-pb]');
  const views = {
    overview: `<h4 class="pr-hello">Good evening, Lukas</h4>
      <div class="pr-kpis pr-kpis-3"><div class="pr-kpi"><b>4</b><span>Active shipments</span></div><div class="pr-kpi"><b>40</b><span>Open orders</span></div><div class="pr-kpi"><b>18 Nov</b><span>Next delivery</span></div></div>
      <div class="pr-portal-cta"><button class="pr-btn" data-browse>Browse inventory</button><button class="pr-btn pr-btn-p" data-place>Place an order ${ico('arrow-right', 14)}</button></div>`,
    orders: `<div class="pr-list">${[['MBS-147-01419', 'Confirmed', '8,940.00 €'], ['MBS-147-01418', 'In production', '2,310.00 €'], ['MBS-147-01415', 'Shipped', '142.20 €']].map(([n, s, a]) => `<div><span class="mono">${n}</span>${pill(s)}<span class="mono">${a}</span></div>`).join('')}</div>`,
    ship: `<div class="pr-list">${[['S-204-0350', 'In transit', 'ETA 06 Nov'], ['S-204-0251', 'Planned', '12 Nov'], ['S-204-0246', 'Planned', '18 Nov']].map(([n, s, a]) => `<div><span class="mono">${n}</span>${pill(s)}<span class="mono">${a}</span></div>`).join('')}</div>`,
  };
  const show = (k) => {
    pb.innerHTML = views[k];
    root.querySelectorAll('[data-pt]').forEach((b) => b.classList.toggle('on', b.dataset.pt === k));
    gsap.fromTo(pb.children, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05 });
  };
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-pt]'); if (t) show(t.dataset.pt);
    if (e.target.closest('[data-place]')) ctx.toast('Your customers order here, with their own prices and live stock');
    if (e.target.closest('[data-browse]')) ctx.toast('Live stock, shown under your brand');
  });
  show('overview');
}

const VIEWS = { orders: viewOrders, shipments: viewShipments, products: viewProducts, inventory: viewInventory, reports: viewReports, portal: viewPortal };

// ---------------------------------------------------------------- shell
export function initProto(el) {
  if (!el) return;
  el.innerHTML = `
    <div class="pr-chrome"><span class="pr-dots"><i></i><i></i><i></i></span><span class="pr-url">${ico('globe', 12) || ''}app.vorta.io/<b data-url>orders</b></span><span class="pr-badge"><i></i>Interactive mockup</span></div>
    <div class="pr-body">
      <aside class="pr-side">
        <p class="pr-side-l">Workspace</p>
        <nav class="pr-nav" aria-label="Mockup modules">${MODULES.map((m, i) => `<button class="pr-nav-b" data-m="${m.id}" aria-current="${i === 0}">${ico(m.icon, 16)}<span>${m.label}</span>${i === 0 ? '' : ''}</button>`).join('')}</nav>
        <div class="pr-hint" data-hint>${ico('arrow-right', 12)}Click a module to explore</div>
        <div class="pr-user"><i>AK</i><span>Amra K.<em>Operations</em></span></div>
      </aside>
      <main class="pr-main" data-main aria-live="polite"></main>
    </div>
    <div class="pr-toasts" data-toasts aria-live="polite"></div>`;
  const main = el.querySelector('[data-main]'), url = el.querySelector('[data-url]'), toasts = el.querySelector('[data-toasts]'), hint = el.querySelector('[data-hint]');
  const ctx = {
    toast(msg) {
      const t = document.createElement('div'); t.className = 'pr-toast'; t.innerHTML = `${ico('circle-check', 14)}<span>${esc(msg)}</span>`;
      toasts.appendChild(t);
      gsap.fromTo(t, { autoAlpha: 0, y: 12, filter: 'blur(6px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.4, ease: 'power3.out' });
      gsap.to(t, { autoAlpha: 0, y: -6, duration: 0.35, delay: 2.6, onComplete: () => t.remove() });
      while (toasts.children.length > 3) toasts.firstElementChild.remove();
    },
  };
  let cur = null, touched = false;
  const open = (id) => {
    if (id === cur) return; cur = id;
    const m = MODULES.find((x) => x.id === id);
    el.querySelectorAll('.pr-nav-b').forEach((b) => b.setAttribute('aria-current', String(b.dataset.m === id)));
    url.textContent = m.slug;
    gsap.killTweensOf(main);
    gsap.to(main, { autoAlpha: 0, y: 8, filter: 'blur(6px)', duration: 0.18, ease: 'power2.in', onComplete: () => {
      VIEWS[id](main, ctx);
      gsap.fromTo(main, { autoAlpha: 0, y: 10, filter: 'blur(6px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: 'power3.out', clearProps: 'filter' });
    } });
  };
  el.querySelector('.pr-nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    if (!touched) { touched = true; gsap.to(hint, { autoAlpha: 0, height: 0, marginTop: 0, duration: 0.4 }); el.classList.add('touched'); }
    open(b.dataset.m);
  });
  VIEWS.orders(main, ctx); cur = 'orders';
}
