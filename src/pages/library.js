/* 策略中心底层：攻击方法 / 攻击题库（列表 + 详情 + 新建题库） */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { detailFields, detailBlock, detailContent, detailTableField, parameterTable, openConfigDetail } from '../core/config-detail.js';
import { authoringListRows } from './resource-authoring.js';
import { openRtJsonl } from '../domain/resource-authoring.js';
import { getModelBankUsage } from '../domain/model-bank-authoring.js';

/* ---------------------------------------------------------------- 攻击方法 */
const mView = { q: '', family: 'all' };

export function methodsPage({ embedded = false } = {}) {
  let rows = store.methods.filter(m => !m.authoringId);
  if (mView.family !== 'all') rows = rows.filter((m) => m.family === mView.family);
  if (mView.q.trim()) {
    const q = mView.q.trim().toLowerCase();
    rows = rows.filter((m) => (m.name + m.desc).toLowerCase().includes(q));
  }
  const flt = UI.filters({
    search: { label: '搜索', id: 'md-q', value: mView.q, placeholder: '搜索名称或说明', oninput: 'App.mdSearch(this.value)' },
    selects: [
      {
        label: '类别', id: 'md-family', value: mView.family, onchange: 'App.mdFamily(this.value)',
        options: [['all', '全部类别'], ...store.methodFamilies.map((f) => [f, f])],
      },
    ],
  });
  const table = UI.pagedTable(
    'methods',
    [
      { title: '名称 / 说明', render: (m) => `<button class="link-btn" onclick="App.openMethod('${m.id}')">${UI.esc(m.name)}</button>${m.available === false ? ' <span class="mtag gray">需适配</span>' : ''}<div class="faint text-support">${UI.esc(m.desc || '')}</div>` },
      { title: '来源', width: '80px', render: () => UI.badge('系统', 'blue') },
      { title: '类别', width: '150px', render: (m) => UI.esc(m.family) },
      { title: '依赖模型', width: '220px', render: (m) => UI.esc(m.available === false ? m.requires : (depsOf(m).join('、') || '无')) },
      {
        title: '操作', width: '90px', cls: 'actions',
        render: (m) => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openMethod('${m.id}')` })}</div>`,
      },
    ],
    rows,
    '暂无攻击方法',
  );
  return `${embedded ? '' : UI.pageHead('攻击库')}${flt}${UI.card('', table, '', true)}`;
}

const depsOf = (m) => [m.generator ? '攻击生成模型' : '', m.process ? '裁判' : ''].filter(Boolean);

/* ---------------------------------------------------------------- 攻击题库 */
const bView = { q: '' };

export function banksPage({ embedded = false } = {}) {
  let rows = [...store.banks.filter(b => !b.authoringId), ...authoringListRows('model')];
  if (bView.q.trim()) {
    const q = bView.q.trim().toLowerCase();
    rows = rows.filter((b) => b.name.toLowerCase().includes(q));
  }
  const flt = UI.filters({
    search: { label: '搜索', id: 'bk-q', value: bView.q, placeholder: '搜索题库名称', oninput: 'App.bkSearch(this.value)' },
    right: embedded ? UI.btn('新建题库', { onclick: 'App.newBank()' }) : '',
  });
  const table = UI.pagedTable(
    'banks',
    [
      { title: '名称', width: '200px', render: (b) => `<button class="link-btn" onclick="App.${b.userResource ? 'mbOpen' : 'openBank'}('${b.id}')">${UI.esc(b.name)}</button>` },
      { title: '来源', width: '80px', render: (b) => UI.badge(b.source === 'system' ? '系统' : '自建', b.source === 'system' ? 'blue' : 'gray') },
      { title: '业务领域', width: '100px', render: (b) => UI.esc(b.industry) },
      { title: '场景标签', render: (b) => UI.tagList(b.scenes.map((id) => store.sceneLabel(id))) },
      { title: '数量', width: '80px', cls: 'num', render: (b) => `<span class="num">${b.items.length}</span>` },
      { title: '版本', width: '70px', render: b => b.userResource ? `<span class="mono">${UI.esc(b.version)}</span>` : '<span class="faint">—</span>' },
      { title: '状态', width: '85px', render: b => UI.badge(b.status === 'draft' ? '草稿' : '已发布', b.status === 'draft' ? 'gray' : 'green') },
      { title: '创建时间', width: '150px', cls: 'num', render: (b) => UI.esc(b.createdAt || '—') },
      {
        title: '操作', width: '120px', cls: 'actions',
        render: bankActions,
      },
    ],
    rows,
    '暂无场景题库',
  );
  return `${embedded ? '' : UI.pageHead('场景题库', {
    actions: UI.btn('新建题库', { kind: 'primary', ico: 'plus', onclick: 'App.newBank()' }),
  })}${flt}${UI.card('', table, '', true)}`;
}

function bankActions(b) {
  const more = b.userResource ? [
    ['版本更新', `App.mbNewVersion('${b.id}')`, { disabled: b.status === 'draft' }],
    ['导出', `App.mbExport('${b.id}')`],
    ['删除', `App.mbDelete('${b.id}')`, { danger: true, disabled: getModelBankUsage(b.id).used }],
  ] : [
    ['导出', `App.exportBank('${b.id}')`],
  ];
  return `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.${b.userResource ? 'mbOpen' : 'openBank'}('${b.id}')` })}${UI.moreMenu(more)}</div>`;
}

/* ---------------------------------------------------------------- 题库详情（右侧抽屉） */
const PAGE = UI.PAGE_SIZE;
const dView = { id: null, q: '', scene: 'all', page: 1 };

function bankBody(b) {
  let items = b.items;
  if (dView.scene !== 'all') items = items.filter((i) => i.scene === dView.scene);
  if (dView.q.trim()) {
    const q = dView.q.trim().toLowerCase();
    items = items.filter((i) => (i.id + i.prompt).toLowerCase().includes(q));
  }
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  dView.page = Math.min(dView.page, pages);
  const slice = items.slice((dView.page - 1) * PAGE, dView.page * PAGE);
  const table = UI.table(
    [
      { title: '编号 / 题目', render: (i) => `<div class="mono faint text-support">${UI.esc(i.id)}</div>${UI.esc(i.prompt)}` },
      { title: '攻击场景', width: '30%', render: (i) => UI.badge(store.sceneLabel(i.scene), 'gray') },
    ],
    slice,
    '该筛选条件下暂无题目',
  );
  return detailContent(detailBlock('题库基础信息', detailFields([
    ['题库名称', b.name], ['来源', b.source === 'system' ? '系统' : '自建'],
    ['业务领域', b.industry], ['题目数', b.items.length], ['创建时间', b.createdAt],
  ])) + detailBlock('题目内容', UI.filters({
      search: { label: '搜索', id: 'bd-q', value: dView.q, placeholder: '搜索编号或题目', oninput: 'App.bdSearch(this.value)' },
      selects: [{
        label: '攻击场景', id: 'bd-scene', value: dView.scene, onchange: 'App.bdScene(this.value)',
        options: [['all', '全部场景'], ...b.scenes.map((id) => [id, store.sceneLabel(id)])],
      }],
    }) + table + UI.pager({ total: items.length, page: dView.page, count: pages }, 'App.bdPage({p})')));
}

/* 抽屉内局部重绘：只换 body，保留输入焦点 */
function redrawBank() {
  const b = store.getBank(dView.id);
  const el = document.querySelector('#drawer .modal-body');
  if (!b || !el) return;
  const f = document.activeElement?.id;
  const pos = document.activeElement?.selectionStart;
  el.innerHTML = bankBody(b);
  const n = f && document.getElementById(f);
  if (n) { n.focus(); if (pos != null && n.setSelectionRange) n.setSelectionRange(pos, pos); }
}


/* ---------------------------------------------------------------- 操作 */

export const actions = {
  mdSearch(v) { mView.q = v; UI.resetPage('methods'); router.nav('strategy', 'methods'); },
  mdFamily(v) { mView.family = v; UI.resetPage('methods'); router.nav('strategy', 'methods'); },
  openMethod(id) {
    const m = store.methods.find((x) => x.id === id);
    if (!m) return;
    openConfigDetail('攻击方法详情', detailContent(
      detailBlock('方法基础信息', detailFields([
        ['方法名称', m.name], ['说明', m.desc], ['来源', '系统'], ['技术路线', m.family],
      ])) + detailBlock('详细配置信息', detailFields([
        ['交互轮次', m.turns], ['依赖模型', depsOf(m).join('、') || '无'],
      ]) + detailTableField('方法参数', parameterTable(m.params.map(p => [p.label, p.value]))))));
  },

  bkSearch(v) { bView.q = v; UI.resetPage('banks'); router.nav('strategy', 'banks'); },
  openBank(id) {
    const b = store.getBank(id);
    if (!b) return;
    Object.assign(dView, { id, q: '', scene: 'all', page: 1 });
    openConfigDetail('场景题库详情', bankBody(b), `${UI.btn('导出', { onclick: `App.exportBank('${id}')` })}${UI.btn('关闭', { onclick: 'UI.closeDrawer()' })}`);
  },
  bdSearch(v) { dView.q = v; dView.page = 1; redrawBank(); },
  bdScene(v) { dView.scene = v; dView.page = 1; redrawBank(); },
  bdPage(p) { dView.page = p; redrawBank(); },
  exportBank(id) {
    const b = store.getBank(id);
    if (!b) return;
    const data = b.items.map((i) => ({ id: i.id, prompt: i.prompt, scene: store.sceneLabel(i.scene) }));
    UI.download(`${b.name}.jsonl`, openRtJsonl(data));
  },

  newBank() {
    window.App.mbCreate();
  },
};
