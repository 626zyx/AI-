/* 策略中心 · 场景题库：列表 + 右侧抽屉详情。
 * 一个 domain 一套题库，与 openart_mid_by_domain 的 14 个包一一对应。
 * 风险标签是题目属性，用于结果归因；这里只展示，不参与任务创建。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { RISK_LABEL } from '../domain/constants.js';
import { detailFields, detailBlock, detailContent, openConfigDetail } from '../core/config-detail.js';

const view = { q: '' };

/* ---------------------------------------------------------------- 列表 */
export function sceneBanksPage() {
  let rows = store.sceneBanks.filter(bank => bank.items?.length);
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
          return UI.tagList(keys.sort((x, y) => cov[y] - cov[x]).map((k) => RISK_LABEL[k]?.label || k));
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
const dView = { id: null, q: '', label: 'all', page: 1 };

function bankBody(b) {
  const cov = store.bankLabelCoverage(b);
  const count = b.items.length || b.total;
  const base = detailBlock('题库基础信息', detailFields([
    ['题库名称', b.name], ['来源', b.source === 'system' ? '系统' : '自建'], ['题目数', count],
    ['风险标签', Object.keys(cov).map(k => RISK_LABEL[k]?.label || k).join('、')],
  ]));
  if (!b.items.length) return detailContent(base + detailBlock('题目内容', '<div class="empty"><strong>题目明细待导入</strong></div>'));

  let items = b.items;
  if (dView.label !== 'all') items = items.filter((i) => (i.labels || []).includes(dView.label));
  if (dView.q.trim()) {
    const q = dView.q.trim().toLowerCase();
    items = items.filter((i) => (i.taskId + i.goal).toLowerCase().includes(q));
  }
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  dView.page = Math.min(dView.page, pages);
  const slice = items.slice((dView.page - 1) * PAGE, dView.page * PAGE);

  /* 与模型演练题库详情同一形态：编号 / 题目 + 标签（灰色） */
  const table = UI.table(
    [
      { title: '编号 / 任务目标', render: (i) => `<div class="mono faint text-support">${UI.esc(i.taskId)}</div>${UI.esc(i.goal || '—')}` },
      { title: '风险标签', width: '32%', render: (i) => UI.tagList((i.labels || []).map((k) => RISK_LABEL[k]?.label || k)) },
    ],
    slice,
    '该筛选条件下暂无题目',
  );
  return detailContent(base + detailBlock('题目内容', UI.filters({
    search: { label: '搜索', id: 'sbd-q', value: dView.q, placeholder: '搜索编号或任务目标', oninput: 'App.sbdSearch(this.value)' },
    selects: [{
      label: '风险标签', id: 'sbd-label', value: dView.label, onchange: 'App.sbdLabel(this.value)',
      options: [['all', '全部标签'], ...Object.keys(cov).map((k) => [k, RISK_LABEL[k]?.label || k])],
    }],
  }) + table + UI.pager({ total: items.length, page: dView.page, count: pages }, 'App.sbdPage({p})')));
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
    Object.assign(dView, { id, q: '', label: 'all', page: 1 });
    openConfigDetail('场景题库详情', bankBody(b), UI.btn('导出', { onclick: `App.sbExport('${id}')` }) + UI.btn('关闭', { onclick: 'UI.closeDrawer()' }));
  },

  sbdSearch(v) { dView.q = v; dView.page = 1; redrawBank(); },
  sbdLabel(v) { dView.label = v; dView.page = 1; redrawBank(); },
  sbdPage(p) { dView.page = p; redrawBank(); },

  sbExport(id) {
    const b = store.getSceneBank(id);
    if (!b) return;
    if (!b.items.length) return UI.toast('题目明细未加载');
    UI.download(`${b.name}.json`, JSON.stringify(b.items, null, 2));
  },
};
