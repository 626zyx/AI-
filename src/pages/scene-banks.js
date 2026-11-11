/* 策略中心 · 场景题库：列表 + 右侧抽屉详情。
 * 一个 domain 一套题库，与 openart_mid_by_domain 的 14 个包一一对应。
 * 风险标签是题目属性，用于结果归因；这里只展示，不参与任务创建。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { RISK_LABEL, SCENE_FLAG } from '../domain/constants.js';

const view = { q: '' };

/* ---------------------------------------------------------------- 列表 */
export function sceneBanksPage() {
  let rows = store.sceneBanks;
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((b) => (b.name + b.code).toLowerCase().includes(q));
  }

  const flt = UI.filters({
    search: { label: '搜索', id: 'sb-q', value: view.q, placeholder: '搜索题库名称', oninput: 'App.sbSearch(this.value)' },
  });

  const table = UI.pagedTable(
    'scenebanks',
    [
      { title: '题库名称', render: (b) => `<button class="link-btn" onclick="App.openSceneBank('${b.id}')">${UI.esc(b.name)}</button>` },
      { title: '来源', width: '80px', render: (b) => UI.badge(b.source === 'system' ? '系统' : '自建', b.source === 'system' ? 'blue' : 'gray') },
      { title: '题目数', width: '90px', cls: 'num', render: (b) => `<span class="num">${b.items.length || b.total}</span>` },
      {
        title: '覆盖风险标签',
        render: (b) => {
          const cov = store.bankLabelCoverage(b);
          const keys = Object.keys(cov);
          if (!keys.length) return '<span class="faint">明细未加载</span>';
          return `<span class="tags">${keys
            .sort((x, y) => cov[y] - cov[x])
            .map((k) => UI.badge(`${RISK_LABEL[k]?.label || k} ${cov[k]}`, RISK_LABEL[k]?.cls || 'gray'))
            .join('')}</span>`;
        },
      },
      {
        title: '操作', width: '120px', cls: 'actions',
        render: (b) => `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openSceneBank('${b.id}')` })}
          ${UI.linkBtn('导出', { onclick: `App.sbExport('${b.id}')` })}
        </div>`,
      },
    ],
    rows,
    '暂无场景题库',
  );

  return `${UI.pageHead('场景题库')}${flt}${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 题库详情（右侧抽屉） */
const PAGE = UI.PAGE_SIZE;
const dView = { id: null, q: '', label: 'all', flag: 'all', page: 1 };

function bankBody(b) {
  const cov = store.bankLabelCoverage(b);
  const count = b.items.length || b.total;

  const head = `<div class="flex mb-12">
    ${UI.badge(b.source === 'system' ? '系统' : '自建', b.source === 'system' ? 'blue' : 'gray')}
    <span class="num">${count} 题</span>
    <span class="faint text-support">${UI.esc(b.code)}</span>
  </div>`;

  const covBlock = Object.keys(cov).length
    ? `<div class="sb-cov">
        <div class="sub-label">风险标签覆盖
          <span class="hint" title="一条题可带多个标签，各项之和大于题目总数。标签用于结果归因，不参与任务创建">?</span>
        </div>
        <span class="tags">${Object.keys(cov).sort((x, y) => cov[y] - cov[x])
      .map((k) => UI.badge(`${RISK_LABEL[k]?.label || k} ${cov[k]}`, RISK_LABEL[k]?.cls || 'gray')).join('')}</span>
      </div>`
    : '';

  if (!b.items.length) {
    return `${head}${covBlock}
      <div class="empty"><strong>题目明细待导入</strong>
      <p class="faint">运行 scripts/extract_scenebank.py 从打包结果生成</p></div>`;
  }

  let items = b.items;
  if (dView.label !== 'all') items = items.filter((i) => (i.labels || []).includes(dView.label));
  if (dView.flag !== 'all') items = items.filter((i) => store.sceneFlags(i).includes(dView.flag));
  if (dView.q.trim()) {
    const q = dView.q.trim().toLowerCase();
    items = items.filter((i) => (i.taskId + i.goal).toLowerCase().includes(q));
  }

  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  dView.page = Math.min(dView.page, pages);
  const slice = items.slice((dView.page - 1) * PAGE, dView.page * PAGE);

  const table = UI.table(
    [
      {
        title: '编号 / 任务目标',
        render: (i) => `<div class="mono faint text-support">${UI.esc(i.taskId)}
          <span class="sb-dom">${UI.esc(i.domainOriginal || '')}</span></div>${UI.esc(i.goal || '—')}`,
      },
      {
        title: '风险标签', width: '220px',
        render: (i) => `<span class="tags">${(i.labels || [])
          .map((k) => UI.badge(RISK_LABEL[k]?.label || k, RISK_LABEL[k]?.cls || 'gray')).join('')}</span>`,
      },
      {
        title: '标记 / 资源', width: '90px', cls: 'num',
        render: (i) => `<span class="num">${i.markerCount ?? '—'} / ${i.resourceCount ?? '—'}</span>`,
      },
      {
        title: '标注', width: '130px',
        render: (i) => {
          const fl = store.sceneFlags(i);
          return fl.length
            ? `<span class="tags">${fl.map((k) => `<span class="badge ${SCENE_FLAG[k].cls}" title="${UI.esc(SCENE_FLAG[k].desc)}">${UI.esc(SCENE_FLAG[k].label)}</span>`).join('')}</span>`
            : '<span class="faint">—</span>';
        },
      },
    ],
    slice,
    '该筛选条件下暂无题目',
  );

  return `${head}${covBlock}
    ${UI.filters({
    search: { label: '搜索', id: 'sbd-q', value: dView.q, placeholder: '搜索编号或任务目标', oninput: 'App.sbdSearch(this.value)' },
    selects: [
      {
        label: '风险标签', id: 'sbd-label', value: dView.label, onchange: 'App.sbdLabel(this.value)',
        options: [['all', '全部标签'], ...Object.keys(cov).map((k) => [k, RISK_LABEL[k]?.label || k])],
      },
      {
        label: '质量标注', id: 'sbd-flag', value: dView.flag, onchange: 'App.sbdFlag(this.value)',
        options: [['all', '全部题目'], ...Object.entries(SCENE_FLAG).map(([k, v]) => [k, v.label])],
      },
    ],
  })}
    ${UI.card('', table + UI.pager({ total: items.length, page: dView.page, count: pages }, 'App.sbdPage({p})'), '', true)}`;
}

/* 抽屉内局部重绘：只换 body，保留输入焦点 */
function redrawBank() {
  const b = store.getSceneBank(dView.id);
  const el = document.querySelector('#drawer .modal-body');
  if (!b || !el) return;
  const f = document.activeElement?.id;
  const pos = document.activeElement?.selectionStart;
  el.innerHTML = bankBody(b);
  const n = f && document.getElementById(f);
  if (n) { n.focus(); if (pos != null && n.setSelectionRange) n.setSelectionRange(pos, pos); }
}

export const actions = {
  sbSearch(v) { view.q = v; UI.resetPage('scenebanks'); router.nav('strategy', 'scenebanks'); },

  openSceneBank(id) {
    const b = store.getSceneBank(id);
    if (!b) return;
    Object.assign(dView, { id, q: '', label: 'all', flag: 'all', page: 1 });
    UI.drawer(b.name, bankBody(b));
  },

  sbdSearch(v) { dView.q = v; dView.page = 1; redrawBank(); },
  sbdLabel(v) { dView.label = v; dView.page = 1; redrawBank(); },
  sbdFlag(v) { dView.flag = v; dView.page = 1; redrawBank(); },
  sbdPage(p) { dView.page = p; redrawBank(); },

  sbExport(id) {
    const b = store.getSceneBank(id);
    if (!b) return;
    if (!b.items.length) return UI.toast('题目明细未加载');
    UI.download(`${b.name}.json`, JSON.stringify(b.items, null, 2));
  },
};
