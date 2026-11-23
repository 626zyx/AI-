/* 策略中心底层：攻击方法 / 场景题库（列表 + 详情 + 新建题库） */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { detailFields, detailBlock, detailContent, detailTableField, parameterTable, openConfigDetail } from '../core/config-detail.js';
import { authoringListRows, authoringState, authoringRowActions } from './resource-authoring.js';
import { methodDependencies } from '../domain/method-catalog.js';

/* ---------------------------------------------------------------- 攻击方法 */
const mView = { q: '', family: 'all' };

export function methodsPage() {
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
        options: [['all', '全部路线'], ...store.methodFamilies.map((f) => [f, f])],
      },
    ],
  });
  const table = UI.pagedTable(
    'methods',
    [
      { title: '名称 / 说明', render: (m) => `<button class="link-btn" onclick="App.${m.userResource ? 'raOpen' : 'openMethod'}('${m.id}')">${UI.esc(m.name)}</button><div class="faint text-support">${UI.esc(m.desc || '')}</div>` },
      { title: '来源', width: '90px', render: () => UI.badge('系统', 'gray') },
      { title: '类别', width: '150px', render: (m) => UI.esc(m.family || '自建模板') },
      
      { title: '依赖模型', width: '200px', render: (m) => UI.esc(depsOf(m).join('、') || '无') },
      {
        title: '操作', width: '90px', cls: 'actions',
        render: (m) => m.userResource ? authoringRowActions(m) : `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openMethod('${m.id}')` })}</div>`,
      },
    ],
    rows,
    '暂无攻击方法',
  );
  return `${UI.pageHead('演练方法')}${flt}${UI.card('', table, '', true)}`;
}

const depsOf = methodDependencies;

/* ---------------------------------------------------------------- 场景题库 */
const bView = { q: '' };

export function banksPage() {
  let rows = [...store.banks.filter(b => !b.authoringId), ...authoringListRows('model')];
  if (bView.q.trim()) {
    const q = bView.q.trim().toLowerCase();
    rows = rows.filter((b) => b.name.toLowerCase().includes(q));
  }
  const flt = UI.filters({
    search: { label: '搜索', id: 'bk-q', value: bView.q, placeholder: '搜索题库名称', oninput: 'App.bkSearch(this.value)' },
  });
  const table = UI.pagedTable(
    'banks',
    [
      { title: '名称', width: '200px', cls: 'nowrap', render: (b) => `<button class="link-btn" onclick="App.${b.userResource ? 'raOpen' : 'openBank'}('${b.id}')">${UI.esc(b.name)}</button>` },
      { title: '来源', width: '80px', render: (b) => UI.badge(b.source === 'system' ? '系统' : '自建', 'gray') },
      { title: '行业', width: '90px', render: (b) => UI.esc(b.industry) },
      { title: '场景标签', render: (b) => UI.tagList(b.scenes.map((id) => store.sceneLabel(id))) },
      { title: '数量', width: '80px', cls: 'num', render: (b) => `<span class="num">${b.items.length}</span>` },
      { title: '版本', width: '145px', render: b => b.userResource ? authoringState(b) : '—' },
      { title: '创建时间', width: '150px', cls: 'num', render: (b) => UI.esc(b.createdAt || '—') },
      {
        title: '操作', width: '120px', cls: 'actions',
        render: (b) => b.userResource ? authoringRowActions(b) : `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openBank('${b.id}')` })}
          ${UI.linkBtn('导出', { onclick: `App.exportBank('${b.id}')` })}
        </div>`,
      },
    ],
    rows,
    '暂无场景题库',
  );
  return `${UI.pageHead('场景题库', {
    actions: UI.btn('新建题库', { kind: 'primary', ico: 'plus', onclick: 'App.newBank()' }),
  })}${flt}${UI.card('', table, '', true)}`;
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
    ['行业', b.industry], ['题目数', b.items.length], ['创建时间', b.createdAt],
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
    openConfigDetail('演练方法详情', detailContent(
      detailBlock('方法基础信息', detailFields([
        ['方法名称', m.name], ['说明', m.desc], ['来源', '系统'], ['类别', m.family],
      ])) + detailBlock('详细配置信息', detailFields([
        ['交互轮次', m.turns], ['依赖模型', depsOf(m).join('、') || '无'], ['适用要求', m.requirements || '文本输入'], ...(m.runtime ? [['运行依赖', m.runtime]] : []),
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
    UI.download(`${b.name}.json`, JSON.stringify(data, null, 2));
  },

  newBank() {
    window.App.raCreate('model');
  },

};
