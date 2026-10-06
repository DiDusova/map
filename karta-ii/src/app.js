(function(){
const C = DATA.cards;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const linkify = s => esc(s).replace(/https?:\/\/[^\s,;)]+/g, u => '<a href="' + u + '" target="_blank" rel="noopener">источник</a>');
const ZMAP = Object.fromEntries(ZONES.map(z => [z.id, z]));
const OPN = {}; const OPFAM = {};
FAMILIES.forEach(f => f.ops.forEach(([k, n]) => { OPN[k] = n; OPFAM[k] = f.n; }));
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };

// ---------- theme ----------
const root = document.documentElement;
function setTheme(t){ if (t) root.setAttribute('data-theme', t); else root.removeAttribute('data-theme'); try { localStorage.setItem('aimap-theme', t || ''); } catch (e) {} }
try { const t = localStorage.getItem('aimap-theme'); if (t) root.setAttribute('data-theme', t); } catch (e) {}
$('#themeBtn').onclick = () => {
  const cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(cur === 'dark' ? 'light' : 'dark');
};

// ---------- tabs ----------
const TABS = [['map','Карта'],['ladder','Лестница усиления'],['scen','Сценарии'],['q','30 вопросов'],['anti','Антикарта'],['nums','Зрелость и цифры'],['gaps','Пробелы']];
$('#tabs').innerHTML = TABS.map(([k, n]) => `<button role="tab" data-t="${k}">${n}</button>`).join('');
function go(t){
  document.querySelectorAll('section.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + t));
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t));
  try { localStorage.setItem('aimap-tab', t); } catch (e) {}
}
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) { go(b.dataset.t); window.scrollTo({top: $('nav.tabs').offsetTop, behavior: 'smooth'}); } };

// ---------- badges ----------
function lvBadge(c){
  if (!c.lo) return `<span class="b ml" title="Классический ИИ или правила, вне лестницы генеративного ИИ">ML</span>`;
  const t = c.lo === c.hi ? 'У' + c.lo : `У${c.lo}-${c.hi}`;
  return `<span class="b lv lv${c.hi}" title="${esc(LEVELS[c.hi-1].n)}">${t}</span>`;
}
const autBadge = c => c.a1 ? `<span class="b" title="Автономия">${c.a1 === c.a2 ? 'А' + c.a1 : 'А' + c.a1 + '-' + c.a2}</span>` : '';
const ruBadge = c => `<span class="b ru-${c.ru}" title="${esc(RU[c.ru][1])}">${RU[c.ru][0]}</span>`;
const matBadge = c => `<span class="b" title="Зрелость: мир / Россия">${c.mw}/${c.mr}</span>`;
const unvBadge = c => '';
const zdots = c => `<span class="zdots">${c.z.map(z => `<i class="zdot" style="background:${ZMAP[z].c}" title="${esc(ZMAP[z].n)}"></i>`).join('')}</span>`;

// ---------- state ----------
const S = {zone: null, op: null, lv: null, q: '', ru: '', mw: '', aut: '', live: '', iface: '', fam: '', shown: 24};
const inLv = (c, l) => l === 0 ? c.lo === 0 : (c.lo && c.lo <= l && l <= c.hi);
function match(c, skipCell){
  if (S.zone && !c.z.includes(S.zone)) return false;
  if (!skipCell && S.op && c.op !== S.op) return false;
  if (!skipCell && S.lv !== null && !inLv(c, S.lv)) return false;
  if (S.fam && OPFAM[c.op] !== S.fam) return false;
  if (S.ru && c.ru !== S.ru) return false;
  if (S.mw && c.mw !== S.mw) return false;
  if (S.aut && !(c.a1 && c.a1 <= +S.aut && +S.aut <= c.a2)) return false;
  if (S.live && c.live !== S.live) return false;
  if (S.iface && !c.iface.includes(S.iface)) return false;
  if (S.q) {
    const hay = (c.t + ' ' + (c.before || '') + ' ' + (c.after || '') + ' ' + c.tools + ' ' + (c.feat || '') + ' ' + (OPN[c.op] || '')).toLowerCase();
    if (!S.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
  }
  return true;
}

// ---------- zones ----------
function renderZones(){
  $('#zall').setAttribute('aria-pressed', S.zone === null);
  $('#zall').textContent = `Все зоны (${C.length})`;
  $('#zones').innerHTML = ZONES.map(z => {
    const n = C.filter(c => c.z.includes(z.id)).length;
    return `<button class="zone" style="--zc:${z.c}" aria-pressed="${S.zone === z.id}" data-z="${z.id}"><span class="cnt">${n}</span><div class="num">${z.id}</div><div class="nm">${esc(z.n)}</div><div class="ds">${esc(z.d)}</div></button>`;
  }).join('');
}
$('#zall').onclick = () => { S.zone = null; S.op = null; S.lv = null; S.shown = 24; renderAll(); };
$('#zones').onclick = e => {
  const b = e.target.closest('.zone'); if (!b) return;
  S.zone = b.dataset.z ? +b.dataset.z : null; S.op = null; S.lv = null; S.shown = 24;
  renderAll();
};

// ---------- matrix ----------
function renderMatrix(){
  const OL = DATA.opl;
  let h = `<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline"><b>Что даёт каждый уровень для каждой операции</b><span class="mx-legend">Уровни накопительные: всё, что умеет чат, умеют и уровни выше, с меньшими усилиями с вашей стороны</span></div>
  <div class="scroll" style="margin-top:10px"><table class="tbl" style="min-width:900px"><thead><tr><th style="width:15%">Операция</th>${LEVELS.map(l => `<th>У${l.k} ${esc(l.n)}</th>`).join('')}</tr></thead><tbody>`;
  FAMILIES.forEach(f => {
    h += `<tr><td colspan="6" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);font-weight:800;background:var(--surface2)">${f.n}</td></tr>`;
    f.ops.forEach(([k, n]) => {
      const o = OL[k]; if (!o) return;
      h += `<tr><td><b>${esc(n)}</b><div style="color:var(--muted);margin-top:4px">${esc(o.example)}</div></td>${o.l.map(x => `<td>${esc(x.how)}<div style="margin-top:6px;color:var(--ok);font-weight:600">${esc(x.gain)}</div></td>`).join('')}</tr>`;
    });
  });
  $('#mxbox').innerHTML = h + '</tbody></table></div>';
}


// ---------- filters ----------
function sel(id, label, opts){
  return `<select id="${id}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('')}</select>`;
}
$('#filters').innerHTML =
  `<input type="search" id="fq" placeholder="Поиск: протокол, договор, 1С, GigaChat...">` +
  sel('ffam', 'Операции: все', FAMILIES.map(f => [f.n, f.n])) +
  sel('fru', 'Россия: все', [['Д', 'Работает в РФ без VPN'], ['Н', 'С VPN'], ['?', 'Требует уточнения']]) +
  sel('fmw', 'Зрелость в мире: все', [['М', 'Массово'], ['П', 'Пилоты'], ['Э', 'Эксперимент']]) +
  sel('faut', 'Автономия: любая', AUTONOMY.map(([k, n], i) => [i + 1, k + ' ' + n])) +
  sel('flive', 'Где живёт: везде', Object.entries(LIVE)) +
  sel('fif', 'Интерфейс: любой', [['текст', 'Текст'], ['голос', 'Голос'], ['камера', 'Камера'], ['экран', 'Экран']]);
const bind = (id, key) => $(id).addEventListener(id === '#fq' ? 'input' : 'change', e => { S[key] = e.target.value; S.shown = 24; renderAll(); });
bind('#fq', 'q'); bind('#ffam', 'fam'); bind('#fru', 'ru'); bind('#fmw', 'mw'); bind('#faut', 'aut'); bind('#flive', 'live'); bind('#fif', 'iface');

function renderCards(){
  const list = C.filter(c => match(c)).sort((a, b) => (a.lo || 9) - (b.lo || 9) || (a.a1 || 0) - (b.a1 || 0));
  const parts = [];
  if (S.zone) parts.push(ZMAP[S.zone].n);
  if (S.op) parts.push(OPN[S.op] + ' · ' + (S.lv ? 'У' + S.lv : 'ML'));
  $('#state').innerHTML = `<b style="color:var(--text)">${list.length}</b> ${plural(list.length, 'возможность', 'возможности', 'возможностей')}${parts.length ? ' · ' + esc(parts.join(' · ')) : ''}` +
    ((S.zone || S.op || S.q || S.ru || S.mw || S.aut || S.live || S.iface || S.fam) ? ` <button type="button" id="reset">Сбросить всё</button>` : '');
  const r = $('#reset'); if (r) r.onclick = () => { Object.assign(S, {zone: null, op: null, lv: null, q: '', ru: '', mw: '', aut: '', live: '', iface: '', fam: '', shown: 24}); document.querySelectorAll('#filters select, #filters input').forEach(x => x.value = ''); renderAll(); };
  if (!list.length) { $('#cards').innerHTML = `<div class="empty">Ничего не найдено. Ослабьте фильтры или посмотрите вкладку «Пробелы».</div>`; $('#more').hidden = true; return; }
  $('#cards').innerHTML = list.slice(0, S.shown).map(cardHTML).join('');
  $('#more').hidden = list.length <= S.shown;
  $('#more').textContent = `Показать ещё (${list.length - S.shown})`;
}
const RUCHATS = 'ГигаЧат, Алиса AI, DeepSeek, Qwen, Perplexity, Mistral';
const startLabel = c => c.start === 'any' ? 'Любой чат-ассистент' : c.start === 'feat' ? 'Чат с функцией: ' + c.feat : (c.tools || 'Требует дополнительного уточнения');
const valBadge = c => c.value === 'new' ? '<span class="b" style="background:#6b4fd6;color:#fff">Новая возможность</span>' : '<span class="b ru-Д">Экономия времени</span>';
const cardHTML = c => `<button class="card" data-id="${esc(c.id)}" type="button">
  <div class="badges">${zdots(c)}${valBadge(c)}${lvBadge(c)}${c.start === 'tool' ? ruBadge(c) : ''}</div>
  <div class="t">${esc(c.t)}</div>
  <div class="ex">${esc(c.after || '')}</div>
  <div class="tools">${esc(startLabel(c))}</div></button>`;
$('#more').onclick = () => { S.shown += 48; renderCards(); };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-id]'); if (b && !b.closest('dialog')) openCard(b.dataset.id);
});
function plural(n, a, b, c){ const m = n % 10, h = n % 100; return (m === 1 && h !== 11) ? a : (m >= 2 && m <= 4 && (h < 10 || h >= 20)) ? b : c; }

// ---------- dialog ----------
const dlg = $('#dlg');
function openCard(id){
  const c = C.find(x => x.id === id); if (!c) return;
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  const autText = c.a1 ? AUTONOMY.slice(c.a1 - 1, c.a2).map(a => a[0] + ' ' + a[1]).join(' → ') : '';
  const best = c.best >= 1 && c.best <= 5 ? c.best : null;
  const start = c.start === 'any' ? `<b>Любой чат-ассистент.</b> В России без VPN: ${esc(RUCHATS)}.` : c.start === 'feat' ? `<b>Чат с функцией: ${esc(c.feat)}.</b> Проверьте, есть ли она в вашем чате.` : c.tools ? `<b>${esc(c.tools)}</b> ${ruBadge(c)}` : '<b>Требует дополнительного уточнения.</b>';
  $('#dlgBody').innerHTML = `<button class="close" type="button" aria-label="Закрыть">×</button>
    <div class="badges">${zdots(c)}${valBadge(c)}${c.audience === 'it' ? '<span class="b">для ИТ</span>' : ''}</div>
    <h3>${esc(c.t)}</h3>
    <dl class="kv">
      ${row('Было', esc(c.before))}
      ${row('Стало', '<b>' + esc(c.after) + '</b>')}
      ${row('С чего начать', start)}
      ${row('Где выигрыш больше', best ? `<b>У${best} ${esc(LEVELS[best - 1].n)}.</b> ${esc(c.best_why)}` : '')}
      ${row('Осторожно', esc(c.caution))}
    </dl>
    <details style="margin-top:14px"><summary style="cursor:pointer;color:var(--muted);font-weight:700;font-size:13px">Подробнее</summary>
    <dl class="kv">
      ${row('Зоны', c.z.map(z => esc(z + '. ' + ZMAP[z].n)).join('; '))}
      ${row('Операция', esc((OPFAM[c.op] || '') + ': ' + (OPN[c.op] || '')))}
      ${row('Доступно с уровня', c.lo ? 'У' + c.lo : 'классический ИИ')}
      ${row('Автономия', autText)}
      ${c.mw && c.mw !== '-' ? row('Зрелость', `мир: ${MAT[c.mw]}, Россия: ${MAT[c.mr] || 'нет данных'}`) : ''}
      ${row('Источник', c.src && c.src.length ? '<span class="srcs">' + c.src.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join('<br>') + '</span>' : esc(c.srcnote || ''))}
      ${row('Дата', esc(c.d))}
    </dl></details>`;
  dlgBody.querySelector('.close').onclick = () => dlg.close();
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}
const dlgBody = $('#dlgBody');
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

function renderAll(){ renderZones(); renderMatrix(); renderCards(); }

// ---------- ladder ----------
function renderLadder(){
  $('#ladder').innerHTML = LEVELS.map(l => {
    const n = C.filter(c => inLv(c, l.k)).length;
    return `<div class="step" style="min-height:${150 + l.k * 22}px">
      <div class="bar" style="background:var(--l${l.k})"></div>
      <div class="h"><span class="b lv lv${l.k}">У${l.k}</span><span class="n">${esc(l.n)}</span></div>
      <p>${esc(l.d)}</p><div class="who">${esc(l.who)}</div>
      <button class="cnt" type="button" data-lv="${l.k}">${n} ${plural(n, 'возможность', 'возможности', 'возможностей')} на карте →</button></div>`;
  }).join('');
  $('#ladder').onclick = e => { const b = e.target.closest('[data-lv]'); if (!b) return;
    Object.assign(S, {zone: null, op: null, lv: null, shown: 24}); S.ladderLv = +b.dataset.lv;
    S.q = ''; $('#fq').value = '';
    S.op = null; S.lv = null; go('map'); filterByLevel(+b.dataset.lv); };
  $('#k26').innerHTML = esc(QUESTIONS.find(q => q.k === 'К26').a.replace(' Подробно во вкладке «Лестница».', ''));
  const rows = [1, 2, 3, 4, 5].map(k => {
    const w = DATA.ladder.find(r => r.lv.startsWith('У' + k) && !r.lv.includes('РФ'));
    const r = DATA.ladder.find(r => r.lv.startsWith('У' + k) && r.lv.includes('РФ'));
    return `<tr><td><span class="b lv lv${k}">У${k}</span><div style="margin-top:4px;font-weight:700">${esc(w.cls)}</div><div style="color:var(--muted)">${esc(w.add)}</div></td>
      <td>${esc(w.prod)}<div class="mt" style="color:var(--muted)">Пример: ${esc(w.ex)} · ${esc(w.aut)}</div><div class="mt">${w.src.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(' · ')}</div></td>
      <td>${esc(r.prod)}<div class="mt" style="color:var(--muted)">Пример: ${esc(r.ex)} · ${esc(r.aut)}</div><div class="mt">${r.src.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(' · ')}</div></td></tr>`;
  }).join('');
  $('#ladderTbl').innerHTML = `<thead><tr><th style="width:18%">Уровень</th><th>Мир</th><th>Россия</th></tr></thead><tbody>${rows}</tbody>`;
  $('#aut').innerHTML = AUTONOMY.map(([k, n, d]) => `<div><b>${k} · ${n}</b><span>${esc(d)}</span></div>`).join('');
  $('#prog').innerHTML = `<thead><tr><th>Задача</th>${LEVELS.map(l => `<th>У${l.k} ${esc(l.n)}</th>`).join('')}</tr></thead><tbody>` +
    DATA.prog.map(p => `<tr><td><b>${esc(p.t)}</b></td>${p.l.map(x => `<td${/^Не найдено/.test(x) ? ' style="color:var(--faint)"' : ''}>${esc(x)}</td>`).join('')}</tr>`).join('') + `</tbody>`;
  $('#deploy').innerHTML = DEPLOY.map(([n, d], i) => `<div class="box"><b>${i + 1}. ${esc(n)}</b><span>${esc(d)}</span></div>`).join('');
}
function filterByLevel(l){
  S.lvOnly = l; // handled via search of level chip: emulate with matrix-less filter
  S.op = null; S.lv = null;
  // use a temporary level filter through the matrix column: pick no op, so filter manually
  const list = C.filter(c => inLv(c, l));
  renderZones(); renderMatrix();
  $('#state').innerHTML = `<b style="color:var(--text)">${list.length}</b> ${plural(list.length, 'возможность', 'возможности', 'возможностей')} уровня У${l} · ${esc(LEVELS[l-1].n)} <button type="button" id="reset2">Показать всю карту</button>`;
  $('#reset2').onclick = () => renderAll();
  $('#cards').innerHTML = list.map(cardHTML).join(''); $('#more').hidden = true;
  $('#state').scrollIntoView({behavior: 'smooth', block: 'start'});
}

// ---------- scenarios ----------
function renderScen(){
  const SCM = DATA.scmap, K = ['prep', 'do', 'res', 'after'];
  $('#scen').innerHTML = DATA.scn.clusters.map(cl => `<h3>${esc(cl.n)}</h3>` + cl.sc.map(s => `<details class="scen"><summary style="cursor:pointer;font-weight:700;font-size:16px">${esc(s.n)}</summary>
    <div class="flow" style="margin-top:10px">${K.map((k, i) => {
      const items = (SCM[s.id] && SCM[s.id][k] || []).map(id => C.find(c => c.id === id)).filter(Boolean).sort((a, b) => ({any: 0, feat: 1, tool: 2}[a.start] - {any: 0, feat: 1, tool: 2}[b.start]));
      return (i ? '<span class="arrow">→</span>' : '') + `<div class="stage"><b>${i + 1}. ${esc(s.st[i])}</b>${items.map(c => `<button type="button" data-id="${esc(c.id)}" style="text-align:left;border:0;background:var(--surface);border-radius:8px;padding:6px 8px;cursor:pointer;font-size:12.5px">${esc(c.t)}<span class="lv" style="display:block;margin-top:2px">${esc(c.start === 'any' ? 'любой чат' : c.start === 'feat' ? 'чат + ' + c.feat : (c.tools || 'требует уточнения'))}</span></button>`).join('')}</div>`;
    }).join('')}</div></details>`).join('')).join('');
}

// ---------- questions ----------
function renderQ(){
  const full = QUESTIONS.filter(q => q.s === 1).length, part = QUESTIONS.length - full;
  $('#qsum').innerHTML = `<div class="prog"><div style="width:${full / QUESTIONS.length * 100}%;background:var(--ok)"></div><div style="width:${part / QUESTIONS.length * 100}%;background:var(--warn)"></div></div>
    <p class="note" style="margin-bottom:14px">Ответ: ${full} · Частично: ${part} · Без ответа: 0</p>`;
  $('#qs').innerHTML = QUESTIONS.map(q => `<details class="q"><summary><span class="k">${q.k}</span><span>${esc(q.q)}</span><span class="st b ${q.s === 1 ? 'ru-Д' : 'ru-VPN'}">${q.s === 1 ? 'ответ' : 'частично'}</span></summary>
    <div class="body">${esc(q.a)}
      ${q.c.length ? `<div class="rel">${q.c.map(id => { const c = C.find(x => x.id === id); return c ? `<button type="button" data-id="${esc(id)}">${esc(c.t)}</button>` : ''; }).join('')}</div>` : ''}
      ${q.go ? `<div class="rel"><button type="button" data-go="${q.go}">Открыть раздел →</button></div>` : ''}
    </div></details>`).join('');
  $('#qs').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { go(b.dataset.go); window.scrollTo({top: $('nav.tabs').offsetTop}); } });
}

// ---------- anti ----------
function renderAnti(){
  $('#anti').innerHTML = DATA.anti.map(a => `<div class="ac"><div class="t">${esc(a.t)}</div><div class="x">${esc(a.ex)}</div><div class="w">Почему: ${esc(a.why)}</div><div class="d">Что делать: ${esc(a.todo)}</div>
    <div class="s">${a.src.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(' · ')} · ${esc(a.d)}</div></div>`).join('');
}

// ---------- numbers ----------
function renderNums(){
  $('#calib').innerHTML = `<thead><tr><th>Зона или уровень</th><th>Мир</th><th>Россия</th><th>Основание</th></tr></thead><tbody>` +
    DATA.calib.map(r => `<tr><td><b>${esc(r.t)}</b></td><td>${esc(r.w)}</td><td>${esc(r.r)}</td><td style="color:var(--muted)">${esc(r.why)}</td></tr>`).join('') + `</tbody>`;
  $('#facts').innerHTML = `<thead><tr><th>Утверждение</th><th>Цифра</th><th>Выборка и дата</th><th>Первоисточник открыт?</th></tr></thead><tbody>` +
    DATA.facts.map(f => `<tr><td>${esc(f.t)}<div class="mt">${f.src.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(' · ')}</div></td><td><b>${esc(f.v)}</b></td><td style="color:var(--muted)">${esc(f.smp)}</td><td><span class="b ${/^Да/.test(f.ok) ? 'ru-Д' : 'ru-VPN'}">${/^Да/.test(f.ok) ? 'да' : 'нет'}</span> <span style="color:var(--muted)">${esc(f.ok.replace(/^(Да|Нет)[,;]?\s*/, ''))}</span></td></tr>`).join('') + `</tbody>`;
}

// ---------- gaps ----------
function renderGaps(){
  const full = QUESTIONS.filter(q => q.s === 1).length;
  const part = QUESTIONS.filter(q => q.s !== 1).map(q => q.k).join(', ');
  const nsrc = C.filter(c => c.src.length).length, nunv = C.filter(c => c.unv).length;
  $('#pass').textContent = `ПОЛНОТА
Контрольных вопросов: ${QUESTIONS.length}
Закрыто: ${full} из ${QUESTIONS.length}
Частично: ${part}
Возможностей на карте: ${C.length}; со ссылкой на источник: ${nsrc}; с пометкой «не проверено»: ${nunv}
Антикарта: ${DATA.anti.length} пунктов; сценариев: ${DATA.scen.length}
Волн исследования: 2 (6 потоков по вопросам + 6 независимых проходов инвентаризации)
Сверка с внешними каталогами: около 85% категорий уже на карте; насыщение по категориям близко, по конкретным продуктам нет`;
  $('#gaps').innerHTML = GAPS.map(g => `<h3>${esc(g.g)}</h3><ul class="gaps">${g.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('');
  $('#method').innerHTML = esc('Структура карты (10 зон, 11 операций в 4 семействах, лестница У1-У5, автономия А1-А5) собрана из каркасов DeepMind Levels of AGI, Anthropic «Building effective agents», уровней автономии Feng, McDonald, Zhang (2025), классификации OECD и данных об использовании (NBER по ChatGPT, Anthropic Economic Index), затем проверена двумя критиками полноты. Первая волна: 6 параллельных потоков поиска по 30 контрольным вопросам. Каждая возможность хранит источник и дату; строки, которые не удалось перепроверить из-за исчерпанного лимита поиска, помечены «не проверено». Зрелость калибровалась по McKinsey 2026, BCG 2025, ВЦИОМ и ВШЭ. Зона 10 показана обзорно: это отдельная тема. Цены и доступность продуктов меняются быстро, карта датирована.');
}

renderAll(); renderLadder(); renderScen(); renderQ(); renderAnti(); renderNums(); renderGaps();
let t0 = 'map'; try { t0 = localStorage.getItem('aimap-tab') || 'map'; } catch (e) {}
go(TABS.some(t => t[0] === t0) ? t0 : 'map');
})();
