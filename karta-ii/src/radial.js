(function(){
const C = DATA.cards;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const NS = 'http://www.w3.org/2000/svg';
const ZMAP = Object.fromEntries(ZONES.map(z => [z.id, z]));
const OPN = {}, OPFAM = {};
FAMILIES.forEach(f => f.ops.forEach(([k, n]) => { OPN[k] = n; OPFAM[k] = f.n; }));
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return (m === 1 && h !== 11) ? a : (m >= 2 && m <= 4 && (h < 10 || h >= 20)) ? b : c; };
const ruTag = c => `<span class="ru ru-${c.ru === '?' ? 'q' : c.ru}">${c.ru === 'Д' ? 'в РФ без VPN' : c.ru === 'Н' ? 'с VPN' : 'уточнить'}</span>`;

// theme
const root = document.documentElement;
try { const t = localStorage.getItem('aimap-theme'); if (t) root.setAttribute('data-theme', t); } catch (e) {}
$('#theme').onclick = () => {
  const cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const n = cur === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', n);
  try { localStorage.setItem('aimap-theme', n); } catch (e) {}
};

// ---------- geometry ----------
const R0 = 84, STEP = 15, PADA = 1.6;
const GAP = 14; // градусов сверху под подписи колец
const SPAN = (360 - GAP) / ZONES.length;
const band = c => c.lo ? c.lo - 1 : 5;
// толщина колец под число точек
const BANDS = [];
(function(){
  let r = R0;
  for (let b = 0; b < 6; b++) {
    const m = Math.max(1, ...ZONES.map(z => C.filter(c => c.z[0] === z.id && band(c) === b).length));
    let rows = 1;
    const capAt = rr => Math.max(1, Math.floor((SPAN - 2 * PADA) * Math.PI / 180 * rr / STEP));
    while (true) { let s = 0; for (let k = 0; k < rows; k++) s += capAt(r + 10 + k * STEP); if (s >= m) break; rows++; }
    const th = Math.max(b === 5 ? 34 : 50, rows * STEP + 14);
    BANDS.push([r, r + th]); r += th;
  }
})();
const ROUT = BANDS[5][1];
const CX = ROUT + 200, CY = ROUT + 150;
const ang = i => -90 + GAP / 2 + i * SPAN; // начало сектора зоны с индексом i
const rad = d => d * Math.PI / 180;
const pt = (r, d) => [CX + r * Math.cos(rad(d)), CY + r * Math.sin(rad(d))];
function arcPath(r0, r1, a0, a1){
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  const big = (a1 - a0) > 180 ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${big} 0 ${x3},${y3} Z`;
}
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const dotR = c => c.mw === 'М' ? 6.5 : c.mw === 'П' ? 5.2 : 4;

// ---------- build svg ----------
const svg = $('#radar');
const gRings = el('g', {}, svg), gSec = el('g', {}, svg), gDots = el('g', {}, svg), gLab = el('g', {}, svg);
// ring backgrounds
BANDS.forEach(([r0, r1], i) => {
  el('path', {d: arcPath(r0, r1, -90 + GAP / 2, 270 - GAP / 2), fill: i % 2 ? 'var(--ring2)' : 'var(--ring1)', stroke: 'var(--line)', 'stroke-width': 1, 'stroke-dasharray': i === 5 ? '4 4' : ''}, gRings);
});
// ring labels in the top gap
const RL = ['У1 Чат', 'У2 Инструкции', 'У3 Подключения', 'У4 Агент', 'У5 Агенты', 'ML'];
BANDS.forEach(([r0, r1], i) => {
  const t = el('text', {x: CX, y: CY - (r0 + r1) / 2 + 4, 'text-anchor': 'middle', class: 'rlabel'}, gRings);
  t.textContent = i < 5 ? 'У' + (i + 1) : 'ML';
});
const sectors = {};
ZONES.forEach((z, i) => {
  const a0 = ang(i), a1 = a0 + SPAN;
  const g = el('g', {class: 'sector', 'data-z': z.id}, gSec);
  el('path', {class: 'bgarc', d: arcPath(R0, BANDS[5][1], a0 + .4, a1 - .4), fill: z.c, 'fill-opacity': .07, stroke: z.c, 'stroke-opacity': .35, 'stroke-width': 1}, g);
  el('path', {d: arcPath(BANDS[5][1] + 4, BANDS[5][1] + 12, a0 + .8, a1 - .8), fill: z.c}, g);
  sectors[z.id] = g;
  // label
  const mid = a0 + SPAN / 2;
  const [lx, ly] = pt(BANDS[5][1] + 36, mid);
  const cos = Math.cos(rad(mid));
  const anchor = Math.abs(cos) < .25 ? 'middle' : cos > 0 ? 'start' : 'end';
  const words = z.n.split(' ');
  const lines = []; let cur = '';
  words.forEach(w => { if ((cur + ' ' + w).trim().length > 16 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
  lines.push(cur);
  const lg = el('g', {class: 'zl', 'data-z': z.id, style: 'cursor:pointer'}, gLab);
  const yOff = Math.sin(rad(mid)) < -.5 ? -(lines.length - 1) * 20 : Math.sin(rad(mid)) > .5 ? 0 : -(lines.length - 1) * 10;
  const [nx, ny] = pt(BANDS[5][1] + 8, mid);
  lines.forEach((ln, k) => { const t = el('text', {x: lx, y: ly + yOff + k * 20 + 6, 'text-anchor': anchor, class: 'zlabel'}, lg); t.textContent = ln; });
});
// center
const cg = el('g', {class: 'center'}, svg);
el('circle', {cx: CX, cy: CY, r: R0 - 8, fill: 'var(--hole)'}, cg);
const ct1 = el('text', {x: CX, y: CY - 6, 'text-anchor': 'middle', fill: 'var(--holetext)', 'font-size': 17, 'font-weight': 800}, cg); ct1.textContent = 'ИИ в работе';
const ct2 = el('text', {x: CX, y: CY + 16, 'text-anchor': 'middle', fill: 'var(--holetext)', 'font-size': 12, 'font-weight': 600, opacity: .75}, cg); ct2.textContent = C.length + ' возможностей';

// dots placement
const dots = {};
const RANK = {'М': 0, 'П': 1, 'Э': 2, '-': 3};
ZONES.forEach((z, i) => {
  const a0 = ang(i) + PADA, a1 = ang(i) + SPAN - PADA;
  BANDS.forEach(([r0, r1], b) => {
    const list = C.filter(c => c.z[0] === z.id && band(c) === b).sort((x, y) => RANK[x.mw] - RANK[y.mw] || (x.op || '').localeCompare(y.op || ''));
    if (!list.length) return;
    const step = STEP;
    let rows = 1;
    const cap = r => Math.max(1, Math.floor(rad(a1 - a0) * r / step));
    while (true) {
      const radii = Array.from({length: rows}, (_, k) => r0 + 10 + k * STEP + ((r1 - r0 - 20) - (rows - 1) * STEP) / 2);
      if (radii.reduce((s, r) => s + cap(r), 0) >= list.length || rows >= 12) { place(list, radii, a0, a1, cap); break; }
      rows++;
    }
  });
});
function place(list, radii, a0, a1, cap){
  let idx = 0;
  const total = list.length;
  const caps = radii.map(cap); const sum = caps.reduce((a, b) => a + b, 0);
  radii.forEach((r, k) => {
    const n = k === radii.length - 1 ? total - idx : Math.min(caps[k], Math.round(total * caps[k] / sum));
    for (let j = 0; j < n && idx < total; j++, idx++) {
      const a = a0 + (a1 - a0) * (j + .5) / n + (k % 2 ? (a1 - a0) / n / 4 : 0) * (n > 1 ? 1 : 0);
      const [x, y] = pt(r, a);
      drawDot(list[idx], x, y);
    }
  });
}
function drawDot(c, x, y){
  const z = ZMAP[c.z[0]];
  const solid = c.ru === 'Д';
  const d = el('circle', {cx: x.toFixed(1), cy: y.toFixed(1), r: dotR(c), class: 'dot', 'data-id': c.id,
    fill: solid ? z.c : 'var(--surface)', stroke: z.c, 'stroke-width': solid ? 1.5 : 2.4,
    'stroke-dasharray': c.ru === '?' ? '2 2' : ''}, gDots);
  dots[c.id] = d;
}

// ---------- state ----------
const S = {zone: null, card: null, sc: null, view: 'zones', mode: 'all', q: ''};
const SCL = DATA.scn.clusters, SCM = DATA.scmap;
const SCN = {}; SCL.forEach(cl => cl.sc.forEach(s => { SCN[s.id] = Object.assign({cl: cl.n}, s); }));
const STK = ['prep', 'do', 'res', 'after'];
const inSc = (c, sid) => STK.some(k => (SCM[sid] && SCM[sid][k] || []).includes(c.id));
function matches(c){
  if (S.mode === 'ru' && c.ru !== 'Д') return false;
  if (S.mode === 'any' && c.start !== 'any') return false;
  if (S.mode === 'new' && c.value !== 'new') return false;
  if (S.mode === 'pr' && !c.pr) return false;
  if (S.q) { const h = (c.t + ' ' + (c.before || '') + ' ' + (c.after || '') + ' ' + c.tools + ' ' + (c.feat || '')).toLowerCase(); if (!S.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => h.includes(w))) return false; }
  return true;
}
function applyDim(){
  C.forEach(c => {
    const on = matches(c) && (S.sc ? inSc(c, S.sc) : (!S.zone || c.z.includes(S.zone)));
    dots[c.id].classList.toggle('dim', !on);
  });
  ZONES.forEach(z => {
    const dim = !S.sc && S.zone && S.zone !== z.id;
    sectors[z.id].classList.toggle('dimz', !!dim);
    gLab.querySelector(`[data-z="${z.id}"]`).classList.toggle('dimz', !!dim);
  });
}

// ---------- zoom (viewBox animation) ----------
const FULL = [0, 0, 2 * CX, 2 * CY];
let vb = FULL.slice();
function zoomTo(target){
  const from = vb.slice(), t0 = performance.now(), D = 450;
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  (function step(now){
    const t = Math.min(1, (now - t0) / D), e = ease(t);
    vb = from.map((v, i) => v + (target[i] - v) * e);
    svg.setAttribute('viewBox', vb.join(' '));
    if (t < 1) requestAnimationFrame(step);
  })(t0);
}
function zoneBox(zid){
  const i = ZONES.findIndex(z => z.id === zid);
  const a0 = ang(i), a1 = a0 + SPAN, pts = [[CX, CY]];
  for (let a = a0; a <= a1 + .01; a += SPAN / 6) { pts.push(pt(BANDS[5][1] + 150, a)); pts.push(pt(BANDS[5][1], a)); }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.max(x1 - x0, y1 - y0) + 120, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return [cx - s / 2, cy - s / 2, s, s];
}

// ---------- panel ----------
const panel = $('#panel');
const RUCHATS = 'ГигаЧат, Алиса AI, DeepSeek, Qwen, Perplexity, Mistral';
const startLabel = c => c.start === 'any' ? 'Любой чат-ассистент' : c.start === 'feat' ? 'Чат с функцией: ' + c.feat : (c.tools || 'Требует дополнительного уточнения');
const startTag = c => c.start === 'tool' ? ruTag(c) : `<span class="ru ru-any">${c.start === 'any' ? 'любой чат' : 'чат + функция'}</span>`;
const valTag = c => c.value === 'new' ? '<span class="vb vb-new">Новая возможность</span>' : '<span class="vb vb-time">Экономия времени</span>';
const itemHTML = c => `<button class="item" data-id="${esc(c.id)}"><span class="t">${esc(c.t)}<small>${esc(startLabel(c).length > 80 ? startLabel(c).slice(0, 78) + '…' : startLabel(c))}</small></span>${startTag(c)}</button>`;
const sortC = (a, b) => ({any: 0, feat: 1, tool: 2}[a.start] - {any: 0, feat: 1, tool: 2}[b.start]) || (a.best || 9) - (b.best || 9);
function legendHTML(){
  const legDot = (fill, stroke, dash, r) => `<svg width="22" height="22"><circle cx="11" cy="11" r="${r || 7}" fill="${fill}" stroke="${stroke}" stroke-width="2.2" ${dash ? 'stroke-dasharray="2 2"' : ''}/></svg>`;
  return `<h4>Кольца: лестница усиления</h4>
    <div class="legend">${LEVELS.map(l => `<div class="row"><span class="lvtag">У${l.k}</span><span><b>${esc(l.n)}.</b> <span class="muted">${esc(l.d)}</span></span></div>`).join('')}
      <div class="row"><span class="lvtag">ML</span><span class="muted">Классический ИИ: прогнозы и оптимизация в отраслевых системах.</span></div></div>
    <p class="muted" style="margin-top:8px">Уровни накопительные: всё, что умеет чат, умеют и уровни выше, только с меньшими усилиями с вашей стороны. Точка стоит на уровне, с которого возможность доступна.</p>
    <h4>Точки</h4>
    <div class="legend">
      <div class="row">${legDot('#4f7fd8', '#4f7fd8')}<span>Работает в России без VPN</span></div>
      <div class="row">${legDot('var(--surface)', '#4f7fd8')}<span>Нужен сервис, который работает с VPN</span></div>
      <div class="row">${legDot('var(--surface)', '#4f7fd8', 1)}<span>Инструмент требует уточнения</span></div>
    </div>`;
}
function renderHome(){
  if (S.view === 'scen') return renderScHome();
  panel.innerHTML = `
    <h2>Что ИИ умеет в работе</h2>
    <p class="muted">Каждая точка это рабочая задача, с которой может помочь ИИ. Сектор показывает, с чем вы работаете. Кольцо показывает, какой уровень инструмента нужен. Нажмите на зону или точку. Переключатель «По сценариям» показывает те же возможности по рабочим ситуациям: встречи, продажи, найм.</p>
    <p class="muted">${C.filter(c => c.start === 'any').length} задач можно решать в любом чат-ассистенте. В России без VPN работают ${esc(RUCHATS)}.</p>
    ${legendHTML()}
    <h4>Насколько карта полная</h4>
    <p class="muted">${C.length} возможностей. Собраны в несколько волн: 6 потоков по вопросам сотрудников; 6 независимых проходов по типам данных, функциям компании, продуктам, профессиям, мировым каталогам и российским подборкам; приёмы из практики тренеров Школы Экзомышления и из официальных гайдов OpenAI, Google, Microsoft, Яндекса, Сбера; проверка, что у каждого этапа 42 рабочих сценариев есть хотя бы две возможности. Сверка с внешними каталогами: около 85% их категорий на карте. Срез на 06.10.2026.</p>
    <h4>Зоны</h4>
    <div class="zlist">${ZONES.map(z => `<button class="zbtn" data-z="${z.id}"><i style="background:${z.c}"></i><b>${z.id}. ${esc(z.n)}</b><span>${C.filter(c => c.z.includes(z.id)).length}</span></button>`).join('')}</div>`;
}
function renderScHome(){
  panel.innerHTML = `
    <h2>Рабочие сценарии</h2>
    <p class="muted">Выберите ситуацию из своей работы. На карте подсветятся все возможности, которые в ней помогают, а справа появится путь по этапам: что можно сделать в любом чате, что даёт инструкция, где нужен отдельный сервис.</p>
    ${SCL.map(cl => `<h4>${esc(cl.n)}</h4><div class="zlist">${cl.sc.map(s => {
      const n = C.filter(c => inSc(c, s.id)).length;
      return `<button class="zbtn" data-sc="${s.id}"><b>${esc(s.n)}</b><span>${n}</span></button>`; }).join('')}</div>`).join('')}`;
}
function renderSc(sid){
  const s = SCN[sid];
  panel.innerHTML = `
    <div class="crumbs"><button data-home>Сценарии</button><span>›</span><span>${esc(s.cl)}</span></div>
    <h2>${esc(s.n)}</h2>
    <p class="muted">Путь по этапам. Сверху то, что можно сделать в любом чате, ниже то, что требует функции или отдельного сервиса.</p>
    ${STK.map((k, i) => {
      const all = (SCM[sid] && SCM[sid][k] || []).map(id => C.find(c => c.id === id)).filter(Boolean).sort(sortC);
      const items = all.filter(matches);
      const note = !items.length && all.length ? '<p class="muted" style="margin:4px 8px;font-size:12px">Под выбранную подсветку на этом этапе ничего не попадает. Все возможности этапа:</p>' : '';
      return `<div class="lvgroup"><div class="lvhead"><span class="lvtag">${i + 1}</span>${esc(s.st[i])}</div>${note}${(items.length ? items : all).map(itemHTML).join('')}</div>`;
    }).join('')}`;
}
function renderZone(zid){
  const z = ZMAP[zid];
  const list = C.filter(c => c.z.includes(zid));
  const vis = list.filter(matches);
  const counts = [1, 2, 3, 4, 5, 0].map(l => list.filter(c => (l ? c.lo === l : !c.lo)).length);
  const mx = Math.max(1, ...counts);
  const groups = [1, 2, 3, 4, 5, 0].map(l => ({l, items: vis.filter(c => (l ? c.lo === l : !c.lo)).sort(sortC)})).filter(g => g.items.length);
  panel.innerHTML = `
    <div class="crumbs"><button data-home>Вся карта</button><span>›</span><span>Зона ${z.id}</span></div>
    <h2 style="display:flex;gap:10px;align-items:center"><i style="width:14px;height:14px;border-radius:4px;background:${z.c};flex:none"></i>${esc(z.n)}</h2>
    <p class="muted">${esc(z.d)}. ${list.length} ${plural(list.length, 'возможность', 'возможности', 'возможностей')}, из них ${list.filter(c => c.start === 'any').length} в любом чате.</p>
    <h4>С какого уровня доступно</h4>
    <div class="mini">${counts.map(n => `<div style="height:${8 + 56 * n / mx}px;background:${z.c};opacity:${n ? 1 : .2}" title="${n}"></div>`).join('')}</div>
    <div class="mini-l">${['У1', 'У2', 'У3', 'У4', 'У5', 'ML'].map((t, i) => `<span>${t} · ${counts[i]}</span>`).join('')}</div>
    ${vis.length < list.length ? `<p class="muted" style="margin-top:10px">Показано ${vis.length} из ${list.length} с учётом подсветки и поиска.</p>` : ''}
    ${groups.map(g => `<div class="lvgroup"><div class="lvhead"><span class="lvtag">${g.l ? 'У' + g.l : 'ML'}</span>${g.l ? esc(LEVELS[g.l - 1].n) : 'Классический ИИ'}</div>
      ${g.items.map(itemHTML).join('')}</div>`).join('')}`;
}
function renderCard(id){
  const c = C.find(x => x.id === id); if (!c) return;
  const z = ZMAP[c.z[0]];
  const aut = c.a1 ? AUTONOMY.slice(c.a1 - 1, c.a2).map(a => a[0] + ' ' + a[1].toLowerCase()).join(' → ') : '';
  const MAT = {'М': 'массово', 'П': 'пилоты', 'Э': 'эксперимент', '-': 'нет данных'};
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  const back = S.sc ? `<button data-sc="${S.sc}">${esc(SCN[S.sc].n)}</button>` : `<button data-z="${(S.zone || z.id)}">${esc(ZMAP[S.zone || z.id].n)}</button>`;
  const best = c.best && c.best >= 1 && c.best <= 5 ? c.best : null;
  const startTxt = c.start === 'any' ? `<b>Любой чат-ассистент.</b> <span class="muted">В России без VPN: ${esc(RUCHATS)}.</span>`
    : c.start === 'feat' ? `<b>Чат с функцией: ${esc(c.feat)}.</b> <span class="muted">Проверьте, есть ли она в вашем чате.</span>`
    : c.tools ? `<b>${esc(c.tools)}</b> ${ruTag(c)}` : `<b>Требует дополнительного уточнения.</b>`;
  panel.innerHTML = `
    <div class="crumbs"><button data-home>${S.sc ? 'Сценарии' : 'Вся карта'}</button><span>›</span>${back}</div>
    <div class="chips">${valTag(c)}${c.audience === 'it' ? '<span class="chip">для ИТ</span>' : ''}</div>
    <h2>${esc(c.t)}</h2>
    <div class="ba"><div><span>Было</span>${esc(c.before)}</div><div><span>Стало</span>${esc(c.after)}</div></div>
    <h4>С чего начать</h4><p>${startTxt}</p>
    <h4>Где выигрыш больше</h4>
    <div style="--zc:${z.c}"><div class="ladder">${[1, 2, 3, 4, 5].map(l => `<div class="${l === best ? 'best' : (c.lo && l >= c.lo ? 'on' : '')}"></div>`).join('')}</div>
    <div class="ladder-l">${LEVELS.map(l => `<span>У${l.k}</span>`).join('')}</div></div>
    ${best ? `<p style="margin-top:8px"><b>У${best} ${esc(LEVELS[best - 1].n)}:</b> ${esc(c.best_why)}</p>` : ''}
    ${c.caution ? `<h4>Осторожно</h4><p>${esc(c.caution)}</p>` : ''}
    ${c.sc && c.sc.length ? `<h4>Где пригодится</h4><div class="rel">${[...new Set(c.sc.map(s => s[0]))].map(s => `<button data-sc="${s}">${esc(SCN[s].n)}</button>`).join('')}</div>` : ''}
    <details class="more"><summary>Подробнее</summary>
    <dl class="kv">
      ${row('Зоны', c.z.map(zz => esc(ZMAP[zz].n)).join('; '))}
      ${row('Операция', esc((OPFAM[c.op] || '') + ': ' + (OPN[c.op] || '').toLowerCase()))}
      ${row('Доступно с уровня', c.lo ? 'У' + c.lo : 'классический ИИ')}
      ${row('Автономия', esc(aut))}
      ${c.mw && c.mw !== '-' ? row('Зрелость', `мир: ${MAT[c.mw]}, Россия: ${MAT[c.mr] || 'нет данных'}`) : ''}
      ${row('Источник', c.src && c.src.length ? c.src.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join('<br>') : esc(c.srcnote || ''))}
      ${row('Дата', esc(c.d))}
    </dl></details>`;
}
function setHL(id){
  document.querySelectorAll('.dot.hl').forEach(d => d.classList.remove('hl'));
  if (id && dots[id]) { dots[id].classList.add('hl'); dots[id].parentNode.appendChild(dots[id]); }
}

// ---------- navigation ----------
function go({zone = null, card = null, sc = null, zoom = true} = {}){
  S.zone = zone; S.card = card; S.sc = sc;
  applyDim(); setHL(card);
  if (card) renderCard(card); else if (sc) renderSc(sc); else if (zone) renderZone(zone); else renderHome();
  panel.parentNode.scrollTop = 0;
  if (zoom) zoomTo(zone && !sc ? zoneBox(zone) : FULL);
  if (window.innerWidth <= 900 && (card || sc)) panel.parentNode.scrollIntoView({behavior: 'smooth', block: 'start'});
}
function setView(v){
  S.view = v;
  document.querySelectorAll('#view button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v));
  go();
}
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('#view') || t.closest('#mode')) return;
  const home = t.closest('[data-home]'); if (home) return go();
  const scb = t.closest('[data-sc]'); if (scb) { if (S.view !== 'scen') { S.view = 'scen'; document.querySelectorAll('#view button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'scen')); } return go({sc: scb.dataset.sc, zoom: false}); }
  const dot = t.closest('.dot'); if (dot) { const c = C.find(x => x.id === dot.dataset.id); return go({zone: S.sc ? null : (S.zone || c.z[0]), sc: S.sc, card: c.id, zoom: !S.sc}); }
  const item = t.closest('[data-id]'); if (item) return go({zone: S.zone, sc: S.sc, card: item.dataset.id, zoom: false});
  const zb = t.closest('[data-z]'); if (zb) { if (S.view !== 'zones') { S.view = 'zones'; document.querySelectorAll('#view button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'zones')); } const z = +zb.dataset.z; return go({zone: S.zone === z && !S.card && zb.closest('svg') ? null : z}); }
  if (t.closest('.center')) return go();
});
// hover tooltip + list ↔ dot link
const tip = $('#tip'), stage = $('#stage');
svg.addEventListener('mousemove', e => {
  const d = e.target.closest('.dot');
  if (!d) { tip.style.opacity = 0; return; }
  const c = C.find(x => x.id === d.dataset.id);
  tip.innerHTML = esc(c.t) + `<div style="font-weight:500;opacity:.75;margin-top:2px">${c.lo ? 'с У' + c.lo : 'ML'} · ${esc(c.start === 'any' ? 'любой чат' : c.start === 'feat' ? 'чат + ' + c.feat : (c.ru === 'Д' ? 'сервис, в РФ без VPN' : c.ru === 'Н' ? 'сервис, с VPN' : 'сервис, уточнить'))}</div>`;
  const r = stage.getBoundingClientRect();
  let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
  if (x > r.width - 270) x -= 290;
  tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.opacity = 1;
});
svg.addEventListener('mouseleave', () => tip.style.opacity = 0);
panel.addEventListener('mouseover', e => { const it = e.target.closest('.item'); if (it) setHL(it.dataset.id); });
panel.addEventListener('mouseout', e => { if (e.target.closest('.item')) setHL(S.card); });
// controls
$('#view').onclick = e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); };
const rerender = () => { applyDim(); if (S.card) return; if (S.sc) renderSc(S.sc); else if (S.zone) renderZone(S.zone); };
$('#mode').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.mode = b.dataset.m;
  document.querySelectorAll('#mode button').forEach(x => x.setAttribute('aria-pressed', x === b)); rerender(); };
$('#q').addEventListener('input', e => { S.q = e.target.value.trim(); rerender(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') go(S.card ? {zone: S.zone, sc: S.sc, zoom: false} : {}); });

svg.setAttribute('viewBox', FULL.join(' ')); vb = FULL.slice();
go({zoom: false});
})();
