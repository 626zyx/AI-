/* UI 原语：所有页面共用的渲染片段。页面不得手写这里已有的结构。 */
import { icon } from './icons.js';
import { TASK_STATUS, VERDICT, RISK_LEVEL } from '../domain/constants.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const pct = (v, digits = 1) => `${(v * 100).toFixed(digits)}%`;


/* ---------------------------------------------------------------- 按钮 */
/* 带框按钮的宽度只有三档，按字数取档：2 字 / 3–4 字 / 5 字及以上。
 * 全站不允许出现第四种宽度——要加按钮先看能不能塞进现有三档。 */
export function btnWidth(label) {
  const n = String(label).replace(/\s/g, '').length;
  return n <= 2 ? 'w-sm' : n <= 4 ? 'w-md' : 'w-lg';
}

export const btn = (label, { kind = '', onclick = '', ico = '', disabled = false } = {}) =>
  `<button class="btn ${btnWidth(label)} ${kind}" ${onclick ? `onclick="${onclick}"` : ''} ${disabled ? 'disabled' : ''}>${ico ? icon(ico, 15) : ''}${esc(label)}</button>`;

export const linkBtn = (label, { onclick = '', danger = false, disabled = false } = {}) =>
  `<button class="link-btn ${danger ? 'danger' : ''}" ${onclick ? `onclick="${onclick}"` : ''} ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;

/* 行内「更多」：点开为下拉菜单，items = [[文案, onclick], ...] */
export function moreMenu(items, label = '更多') {
  return `<span class="dd">
    <button class="link-btn" onclick="UI.toggleMenu(event,this)">${esc(label)}</button>
    <span class="dd-menu" hidden>${items
      .map(([l, fn]) => `<button onclick="UI.closeMenus();${fn}">${esc(l)}</button>`)
      .join('')}</span></span>`;
}
export function closeMenus() {
  document.querySelectorAll('.dd-menu').forEach((m) => (m.hidden = true));
}
/* 下拉用 position:fixed 浮在视口上，不占表格高度、不被滚动容器裁切；
 * 下方空间不够时向上展开。滚动或缩放时直接收起，避免菜单与触发按钮错位。 */
export function toggleMenu(e, el) {
  e.stopPropagation();
  const m = el.nextElementSibling;
  const open = m.hidden;
  closeMenus();
  if (!open) return;
  m.hidden = false;
  const r = el.getBoundingClientRect();
  const h = m.offsetHeight;
  const w = m.offsetWidth;
  const below = window.innerHeight - r.bottom;
  m.style.top = `${below < h + 12 ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
  m.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;
}
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', closeMenus, true);
  window.addEventListener('resize', closeMenus);
}

/* ---------------------------------------------------------------- 页面头 */
export function pageHead(title, { actions = '', back = '', extra = '' } = {}) {
  return `${back}
    <div class="page-heading">
      <h1>${esc(title)}${extra}</h1>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>`;
}

/* 返回键：只有图标，不写目的地。始终回到上一步所在页面（router.back） */
export const backBtn = () =>
  `<button class="back-btn" onclick="App.back()" title="返回" aria-label="返回">${icon('back', 18)}</button>`;

/* ---------------------------------------------------------------- 筛选器 */
export function filters({ search = null, selects = [], sort = null, extra = '', right = '' } = {}) {
  const parts = [];
  if (search) {
    parts.push(`<label class="filter search"><span>${esc(search.label)}</span>
      <input type="text" id="${search.id}" value="${esc(search.value || '')}"
        placeholder="${esc(search.placeholder || '')}"
        oninput="${esc(search.oninput || '')}" /></label>`);
  }
  for (const s of selects) {
    parts.push(`<label class="filter"><span>${esc(s.label)}</span>
      <select id="${s.id}" onchange="${esc(s.onchange || '')}">
        ${s.options.map(([v, l]) => `<option value="${esc(v)}" ${v === s.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select></label>`);
  }
  /* 排序紧跟在筛选器之后，不居右：右侧是页面主操作的对齐线 */
  if (sort) {
    parts.push(`<button class="sort-btn" onclick="${sort.onclick}">${icon('arrowUpDown', 14)}${esc(sort.label)}</button>`);
  }
  /* extra：跟在筛选器后的行内操作（如多选控制）；right：本行唯一靠右的操作（如导出） */
  if (extra) parts.push(extra);
  if (right) parts.push(`<div class="filters-right">${right}</div>`);
  return `<div class="filters">${parts.join('')}</div>`;
}

/* ---------------------------------------------------------------- 表格 */
export function table(columns, rows, emptyText = '暂无数据') {
  const head = columns.map((c) => `<th ${c.width ? `style="width:${c.width}"` : ''}>${c.raw ? c.title : esc(c.title)}</th>`).join('');
  const body = rows.length
    ? rows.map((r) => `<tr>${columns.map((c) => `<td class="${c.cls || ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')
    : `<tr><td class="empty-cell" colspan="${columns.length}">${esc(emptyText)}</td></tr>`;
  return `<div class="table-wrap"><table class="grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* ---------------------------------------------------------------- 分页 */
/* 全站列表每页最多 15 条。页码按列表 key 存在这里，筛选变化时由页面调用 resetPage。 */
export const PAGE_SIZE = 15;
const pages = {};
let pageRerender = null;
export const bindPageRerender = (fn) => (pageRerender = fn);
export const resetPage = (key) => (pages[key] = 1);

export function paginate(key, rows) {
  const count = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const p = Math.min(Math.max(1, pages[key] || 1), count);
  pages[key] = p;
  return { slice: rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), page: p, count, total: rows.length, offset: (p - 1) * PAGE_SIZE };
}
export function setPage(key, p) {
  pages[key] = p;
  if (pageRerender) pageRerender(key);
}

/* 分页条：共 N 条 · 第一页 / 上一页 / 页码 / 下一页 / 最后一页。onPage 为 JS 表达式模板，{p} 替换为页码 */
export function pager(pg, onPage) {
  const go = (p) => esc(onPage.replace('{p}', p));
  const b = (ico, label, p, dis) =>
    `<button class="pg-btn" title="${label}" aria-label="${label}" ${dis ? 'disabled' : `onclick="${go(p)}"`}>${icon(ico, 14)}</button>`;
  return `<div class="pager">
    <span class="muted text-support num">共 ${pg.total} 条</span>
    ${b('first', '第一页', 1, pg.page <= 1)}
    ${b('prev', '上一页', pg.page - 1, pg.page <= 1)}
    <span class="num text-support">${pg.page} / ${pg.count}</span>
    ${b('next', '下一页', pg.page + 1, pg.page >= pg.count)}
    ${b('last', '最后一页', pg.count, pg.page >= pg.count)}
  </div>`;
}

/* 分页表格：列表页统一入口 */
export function pagedTable(key, columns, rows, emptyText) {
  const pg = paginate(key, rows);
  return table(columns, pg.slice, emptyText) + pager(pg, `UI.setPage('${key}',{p})`);
}

/* 单行截断：超出部分省略号，悬停浮窗显示全文（浮窗由 main.js 统一挂载） */
export const clip = (text) => `<span class="clip-1" data-full="${esc(text)}">${esc(text)}</span>`;

/* 键值表：一行一条，单列内容 */
export function kvTable(pairs) {
  const rows = pairs
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`)
    .join('');
  return `<table class="kv"><tbody>${rows}</tbody></table>`;
}

/* ---------------------------------------------------------------- 状态 / 徽章 */
/* 任务状态：图标 + 文案。列表里的状态列和详情页标题后的状态都用这一个函数产出，
   保证同一状态在全站长得完全一样。 */
export function statusPill(status) {
  const s = TASK_STATUS[status] || TASK_STATUS.draft;
  return `<span class="status ${s.cls}">${icon(s.icon, 14)}${esc(s.label)}</span>`;
}

/* 详情页标题后只需要图标，不要文案 */
export function statusIcon(status) {
  const s = TASK_STATUS[status] || TASK_STATUS.draft;
  return `<span class="status-icon ${s.cls}" title="${esc(s.label)}">${icon(s.icon, 20)}</span>`;
}

export const badge = (text, tone = 'gray') => `<span class="badge ${tone}">${esc(text)}</span>`;
export const riskBadge = (risk) => `<span class="badge ${risk.cls}">${esc(risk.label)}</span>`;
/* 判定纯文字：无底色无边框，颜色与演练结果色块一致 */
export const verdictText = (v) => `<span class="verdict ${v.key}">${esc(v.label)}</span>`;

/* ---------------------------------------------------------------- 卡片 */
export const card = (title, body, actions = '', flush = false) =>
  `<section class="card">${title ? `<div class="card-head"><h3>${esc(title)}</h3>${actions ? `<div class="head-actions">${actions}</div>` : ''}</div>` : ''}
    <div class="card-body ${flush ? 'flush' : ''}">${body}</div></section>`;

/* ---------------------------------------------------------------- 图表 */
/* 图表色板：顺序固定，页面只按下标取，不自己写 var(--c*) */
export const CHART_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
export const chartColor = (i) => CHART_COLORS[i % CHART_COLORS.length];

/* 圆环：color 为占比段颜色，track 为底环颜色（默认浅灰）。
 * 判定类圆环传 color=攻破色、track=守住色，使两段与图例一一对应。 */
export function ring(value, { size = 132, label = '', sub = '', color = null, track = 'var(--line)' } = {}) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const on = c * Math.max(0, Math.min(1, value));
  color ||= value >= 0.6 ? 'var(--rk-critical)' : value >= 0.3 ? 'var(--rk-high)' : value > 0 ? 'var(--primary)' : 'var(--vd-safe)';
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="9"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="9"
        stroke-linecap="round" stroke-dasharray="${on} ${c}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="ring-text"><strong>${pct(value)}</strong>${label ? `<span>${esc(label)}</span>` : ''}${sub ? `<small>${esc(sub)}</small>` : ''}</div>
  </div>`;
}

/* 水平条形图：用于方法对比 */
export function bars(items, { max = null } = {}) {
  const top = max || Math.max(...items.map((i) => i.value), 0.0001);
  return `<div class="bars">${items
    .map(
      (i) => `<div class="bar-row">
        <span class="bar-label">${esc(i.label)}</span>
        <div class="bar"><i style="width:${(i.value / top) * 100}%;background:${i.color || 'var(--c1)'}"></i></div>
        <span class="bar-value num">${pct(i.value)}</span>
      </div>`,
    )
    .join('')}</div>`;
}

/* 雷达图：items = [{label, value(0–1), covered}]。未覆盖的维度轴名置灰、数值按 0 画，
 * 让用户看到「全部维度」中本次覆盖了哪些。 */
export function radar(items, { size = 300, color = 'var(--vd-breach)' } = {}) {
  const n = items.length;
  if (n < 3) return '';
  const cx = size / 2, cy = size / 2, R = size / 2 - 64;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const top = Math.max(0.0001, ...items.map((i) => i.value));
  const scale = Math.min(1, Math.ceil(top * 10) / 10 || 0.1);
  const rings = [0.25, 0.5, 0.75, 1]
    .map((k) => `<polygon points="${items.map((_, i) => pt(i, R * k).join(',')).join(' ')}" fill="none" stroke="var(--line)"/>`)
    .join('');
  const axes = items
    .map((it, i) => {
      const [x, y] = pt(i, R);
      const [lx, ly] = pt(i, R + 14);
      const anchor = Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end';
      const short = it.label.length > 7 ? it.label.slice(0, 7) + '…' : it.label;
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/>
        <text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" class="${it.covered ? '' : 'off'}"><title>${esc(it.label)}${it.covered ? ` ${pct(it.value)}` : '（本次未覆盖）'}</title>${esc(short)}</text>`;
    })
    .join('');
  const poly = items.map((it, i) => pt(i, (R * it.value) / scale).join(',')).join(' ');
  const dots = items
    .map((it, i) => (it.covered ? `<circle cx="${pt(i, (R * it.value) / scale)[0]}" cy="${pt(i, (R * it.value) / scale)[1]}" r="3" fill="${color}"/>` : ''))
    .join('');
  return `<div class="radar"><svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size + 40}px">
    ${rings}${axes}
    <polygon points="${poly}" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="1.5"/>${dots}
  </svg><div class="radar-note faint text-support">刻度上限 ${pct(scale, 0)} · 灰色维度为本次未覆盖</div></div>`;
}

export function legend(items) {
  return `<div class="legend">${items
    .map((i) => `<span><i style="background:${i.color}"></i>${esc(i.label)} <b class="num">${i.value}</b></span>`)
    .join('')}</div>`;
}

export function progressBar(value, { showText = true } = {}) {
  return `<div class="flex">
    <div class="bar flex-fill"><i style="width:${Math.max(0, Math.min(1, value)) * 100}%"></i></div>
    ${showText ? `<span class="num muted text-support">${pct(value, 0)}</span>` : ''}
  </div>`;
}

/* ---------------------------------------------------------------- 弹窗 */
export function modal(title, body, footer = '', { wide = false, cls = '' } = {}) {
  closeMenus();
  const el = document.getElementById('modal');
  el.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${esc(title)}</h2>
      <button class="icon-btn" onclick="UI.closeModal()" aria-label="关闭">${icon('close', 18)}</button></div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
  </div>`;
  el.classList.add('open');
}
export const closeModal = () => document.getElementById('modal').classList.remove('open');

export function drawer(title, body, footer = '') {
  closeMenus();
  const el = document.getElementById('drawer');
  el.innerHTML = `<div class="drawer" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${esc(title)}</h2>
      <button class="icon-btn" onclick="UI.closeDrawer()" aria-label="关闭">${icon('close', 18)}</button></div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
  </div>`;
  el.classList.add('open');
}
export const closeDrawer = () => document.getElementById('drawer').classList.remove('open');

let toastTimer = null;
export function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function download(name, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('文件已生成');
}
