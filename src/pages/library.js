/* 策略中心底层：攻击方法 / 攻击题库（列表 + 详情 + 新建题库） */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';

/* ---------------------------------------------------------------- 攻击方法 */
const mView = { q: '', family: 'all' };

export function methodsPage() {
  let rows = store.methods;
  if (mView.family !== 'all') rows = rows.filter((m) => m.family === mView.family);
  if (mView.q.trim()) {
    const q = mView.q.trim().toLowerCase();
    rows = rows.filter((m) => (m.name + m.desc).toLowerCase().includes(q));
  }
  const flt = UI.filters({
    search: { label: '搜索', id: 'md-q', value: mView.q, placeholder: '搜索名称或说明', oninput: 'App.mdSearch(this.value)' },
    selects: [
      {
        label: '技术路线', id: 'md-family', value: mView.family, onchange: 'App.mdFamily(this.value)',
        options: [['all', '全部路线'], ...store.methodFamilies.map((f) => [f, f])],
      },
    ],
  });
  const table = UI.pagedTable(
    'methods',
    [
      { title: '名称 / 说明', render: (m) => `<button class="link-btn" onclick="App.openMethod('${m.id}')">${UI.esc(m.name)}</button><div class="faint text-support">${UI.esc(m.desc)}</div>` },
      { title: '技术路线', width: '150px', render: (m) => UI.esc(m.family) },
      { title: '依赖模型', width: '200px', render: (m) => UI.esc(depsOf(m).join('、') || '无') },
      {
        title: '操作', width: '90px', cls: 'actions',
        render: (m) => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openMethod('${m.id}')` })}</div>`,
      },
    ],
    rows,
    '暂无攻击方法',
  );
  return `${UI.pageHead('攻击方法')}${flt}${UI.card('', table, '', true)}`;
}

const depsOf = (m) => [m.generator ? '攻击生成模型' : '', m.process ? '过程裁判' : ''].filter(Boolean);
const paramValue = (v) => (v === true ? '开启' : v === false ? '关闭' : String(v));

/* ---------------------------------------------------------------- 攻击题库 */
const bView = { q: '' };

export function banksPage() {
  let rows = store.banks;
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
      { title: '名称', width: '200px', cls: 'nowrap', render: (b) => `<button class="link-btn" onclick="App.openBank('${b.id}')">${UI.esc(b.name)}</button>` },
      { title: '来源', width: '80px', render: (b) => UI.badge(b.source === 'system' ? '系统' : '自建', b.source === 'system' ? 'blue' : 'gray') },
      { title: '行业', width: '90px', render: (b) => UI.esc(b.industry) },
      { title: '场景标签', render: (b) => `<span class="tags">${b.scenes.map((id) => UI.badge(store.sceneLabel(id), 'gray')).join('')}</span>` },
      { title: '数量', width: '80px', cls: 'num', render: (b) => `<span class="num">${b.items.length}</span>` },
      { title: '创建时间', width: '150px', cls: 'num', render: (b) => UI.esc(b.createdAt || '—') },
      {
        title: '操作', width: '120px', cls: 'actions',
        render: (b) => `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openBank('${b.id}')` })}
          ${UI.linkBtn('导出', { onclick: `App.exportBank('${b.id}')` })}
        </div>`,
      },
    ],
    rows,
    '暂无攻击题库',
  );
  return `${UI.pageHead('攻击题库', {
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
      { title: '攻击场景', width: '170px', render: (i) => UI.badge(store.sceneLabel(i.scene), 'gray') },
    ],
    slice,
    '该筛选条件下暂无题目',
  );
  return `<div class="flex mb-12">${UI.badge(b.source === 'system' ? '系统' : '自建', b.source === 'system' ? 'blue' : 'gray')}
      <span>${UI.esc(b.industry)}</span><span class="num">${b.items.length} 题</span></div>
    ${UI.filters({
      search: { label: '搜索', id: 'bd-q', value: dView.q, placeholder: '搜索编号或题目', oninput: 'App.bdSearch(this.value)' },
      selects: [{
        label: '攻击场景', id: 'bd-scene', value: dView.scene, onchange: 'App.bdScene(this.value)',
        options: [['all', '全部场景'], ...b.scenes.map((id) => [id, store.sceneLabel(id)])],
      }],
    })}
    ${UI.card('', table + UI.pager({ total: items.length, page: dView.page, count: pages }, 'App.bdPage({p})'), '', true)}`;
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


/* ---------------------------------------------------------------- 新建题库 */
/* 模板：列出系统已分类的参考场景，方便复制；scene 也可填新场景名称 */
const template = () => ({
  说明: 'items 为题目数组；scene 填写下方参考场景中的名称，也可直接填写新的场景名称',
  参考场景: store.scenes.map((s) => s.label),
  items: [
    { prompt: '题目原文', scene: store.scenes[0].label },
    { prompt: '题目原文', scene: '自定义的新场景名称' },
  ],
});
const nb = { name: '', industry: '通用', custom: '', items: [], error: '' };

function newBankBody() {
  const opts = [...store.INDUSTRIES, '__custom'];
  const rows = nb.items.length
    ? UI.table(
        [
          { title: '#', width: '46px', render: (i) => `<span class="faint num">${i.n}</span>` },
          { title: '题目', render: (i) => UI.esc(i.prompt) },
          { title: '攻击场景', width: '180px', render: (i) => UI.esc(store.sceneLabel(i.scene)) },
        ],
        nb.items.map((it, n) => ({ ...it, n: n + 1 })),
      )
    : '<div class="empty"><strong>尚未上传</strong></div>';
  return `<div class="form-secs">
    <section class="form-sec">
      <div class="field"><label for="nb-name">题库名称 *</label>
        <input type="text" id="nb-name" value="${UI.esc(nb.name)}" oninput="App.nbField('name',this.value)" /></div>
      <div class="field"><label for="nb-industry">行业 *</label>
        <select id="nb-industry" onchange="App.nbIndustry(this.value)">
          ${opts.map((o) => `<option value="${UI.esc(o)}" ${o === nb.industry ? 'selected' : ''}>${o === '__custom' ? '自定义' : UI.esc(o)}</option>`).join('')}
        </select></div>
      ${nb.industry === '__custom' ? `<div class="field"><label for="nb-custom">自定义行业 *</label>
        <input type="text" id="nb-custom" value="${UI.esc(nb.custom)}" oninput="App.nbField('custom',this.value)" /></div>` : ''}
    </section>
    <section class="form-sec">
      <h3>上传题目</h3>
      <div class="flex">
        <label class="btn w-lg">上传 JSON<input type="file" accept=".json,application/json" hidden onchange="App.nbUpload(this)" /></label>
        ${UI.linkBtn('下载模板', { onclick: 'App.nbTemplate()' })}
        ${nb.error ? `<span class="text-danger text-support">${UI.esc(nb.error)}</span>` : ''}
      </div>
    </section>
    <section class="form-sec">
      <h3>待入库题目${nb.items.length ? `<span class="faint num"> · ${nb.items.length}</span>` : ''}</h3>
      <div class="nb-preview">${rows}</div>
    </section>
  </div>`;
}

function renderNewBank() {
  UI.modal(
    '新建题库',
    newBankBody(),
    `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('确认入库', { kind: 'primary', onclick: 'App.nbSave()' })}`,
    { wide: true },
  );
}

/* 解析：数组，元素为 {prompt, scene}；scene 可填场景 id 或中文名 */
function parseItems(json) {
  const arr = Array.isArray(json) ? json : json?.items;
  if (!Array.isArray(arr) || !arr.length) throw new Error('JSON 需为非空数组');
  return arr.map((x, i) => {
    const prompt = String(x?.prompt ?? '').trim();
    if (!prompt) throw new Error(`第 ${i + 1} 条缺少 prompt`);
    return { id: `U-${String(i + 1).padStart(4, '0')}`, prompt, scene: store.sceneIdFor(x.scene) };
  });
}

/* ---------------------------------------------------------------- 操作 */

export const actions = {
  mdSearch(v) { mView.q = v; UI.resetPage('methods'); router.nav('strategy', 'methods'); },
  mdFamily(v) { mView.family = v; UI.resetPage('methods'); router.nav('strategy', 'methods'); },
  openMethod(id) {
    const m = store.methods.find((x) => x.id === id);
    if (!m) return;
    const params = m.params.length
      ? UI.table(
          [
            { title: '参数', render: (p) => UI.esc(p.label) },
            { title: '默认值', render: (p) => `<span class="mono text-support">${UI.esc(paramValue(p.value))}</span>` },
          ],
          m.params,
        )
      : '<p class="muted">无可配置参数</p>';
    UI.drawer(
      m.name,
      `${UI.card('基本信息', UI.kvTable([
        ['说明', UI.esc(m.desc)],
        ['技术路线', UI.esc(m.family)],
        ['交互轮次', UI.esc(m.turns)],
        ['依赖模型', UI.esc(depsOf(m).join('、') || '无')],
      ]))}
      <div class="mt-16">${UI.card('参数', params, '', !!m.params.length)}</div>`,
      UI.btn('关闭', { onclick: 'UI.closeDrawer()' }),
    );
  },

  bkSearch(v) { bView.q = v; UI.resetPage('banks'); router.nav('strategy', 'banks'); },
  openBank(id) {
    const b = store.getBank(id);
    if (!b) return;
    Object.assign(dView, { id, q: '', scene: 'all', page: 1 });
    UI.drawer(b.name, bankBody(b), `${UI.btn('导出', { onclick: `App.exportBank('${id}')` })}${UI.btn('关闭', { onclick: 'UI.closeDrawer()' })}`);
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
    Object.assign(nb, { name: '', industry: '通用', custom: '', items: [], error: '' });
    renderNewBank();
  },
  nbField(k, v) { nb[k] = v; },
  nbIndustry(v) { nb.industry = v; renderNewBank(); },
  nbTemplate() { UI.download('题库模板.json', JSON.stringify(template(), null, 2)); },
  nbUpload(input) {
    const f = input.files?.[0];
    if (!f) return;
    f.text().then((txt) => {
      try {
        nb.items = parseItems(JSON.parse(txt));
        nb.error = '';
      } catch (e) {
        nb.items = [];
        nb.error = `解析失败：${e.message}`;
      }
      renderNewBank();
    });
  },
  nbSave() {
    const industry = nb.industry === '__custom' ? nb.custom.trim() : nb.industry;
    if (!nb.name.trim()) return UI.toast('请填写题库名称');
    if (!industry) return UI.toast('请填写自定义行业');
    if (!nb.items.length) return UI.toast('请上传题目');
    store.addBank({ name: nb.name.trim(), industry, items: nb.items });
    UI.closeModal();
    UI.toast('题库已入库');
    router.nav('strategy', 'banks');
  },
};
