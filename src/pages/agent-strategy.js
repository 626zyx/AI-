/* 策略中心 · Agent 演练策略：列表 + 详情 + 新建编辑 + 草稿箱。
 * 策略 = 场景题库 + 题目范围。一期无攻击方法维度。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';

const view = { q: '', status: 'all' };

/* ---------------------------------------------------------------- 列表 */
export function agentStrategyPage() {
  let rows = store.agentStrategies;
  if (view.status !== 'all') rows = rows.filter((s) => s.status === view.status);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((s) => s.name.toLowerCase().includes(q));
  }
  rows = [...rows].sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''));

  const flt = UI.filters({
    search: { label: '搜索', id: 'ags-q', value: view.q, placeholder: '搜索策略名称', oninput: 'App.agsSearch(this.value)' },
    selects: [{
      label: '状态', id: 'ags-status', value: view.status, onchange: 'App.agsStatus(this.value)',
      options: [['all', '全部状态'], ['published', '已发布'], ['draft', '待发布']],
    }],
  });

  const table = UI.pagedTable(
    'ag-strategies',
    [
      { title: '策略名称', render: (s) => `<button class="link-btn" onclick="App.openAgStrategy('${s.id}')">${UI.esc(s.name)}</button>` },
      { title: '场景题库', render: (s) => `<div class="cfg-lines">${store.agentStrategyBankLines(s).map((l) => `<div>${UI.esc(l)}</div>`).join('') || '—'}</div>` },
      { title: '题目数', width: '90px', cls: 'num', render: (s) => `<span class="num">${store.agentStrategyTaskCount(s)}</span>` },
      { title: '迭代轮数', width: '100px', cls: 'num', render: (s) => `<span class="num">${s.maxIterations ?? 1}</span>` },
      { title: '状态', width: '100px', render: (s) => UI.badge(store.AG_STRATEGY_STATUS[s.status], s.status === 'published' ? 'blue' : 'gray') },
      { title: '更新时间', width: '150px', cls: 'num', render: (s) => UI.esc(s.updatedAt || '—') },
      {
        title: '操作', width: '120px', cls: 'actions',
        render: (s) => `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openAgStrategy('${s.id}')` })}
          ${UI.linkBtn('编辑', { onclick: `App.editAgStrategy('${s.id}')`, disabled: s.status === 'published' })}
          ${s.status === 'draft' ? UI.linkBtn('删除', { danger: true, onclick: `App.delAgStrategy('${s.id}')` }) : ''}
        </div>`,
      },
    ],
    rows,
    '暂无 Agent 演练策略',
  );

  return `${UI.pageHead('Agent 演练策略', {
    actions: `
      ${UI.btn('策略草稿箱', { onclick: "App.go('strategy','ag-strategy-drafts')" })}
      ${UI.btn('新建演练策略', { kind: 'primary', ico: 'plus', onclick: 'App.newAgStrategy()' })}`,
  })}${flt}
  ${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 详情 */
export function agentStrategyDetailPage(cur) {
  const s = store.getAgentStrategy(cur?.param);
  if (!s) return `${UI.pageHead('策略详情')}<div class="empty"><strong>策略不存在</strong></div>`;

  const bankRows = (s.banks || []).map(({ bankId, count }) => {
    const b = store.getSceneBank(bankId);
    if (!b) return '';
    const total = b.items.length || b.total;
    return `<tr>
      <td><button class="link-btn" onclick="App.openSceneBank('${b.id}')">${UI.esc(b.name)}</button></td>
      <td class="num">${total}</td>
      <td class="num">${count && count < total ? count : total}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="3" class="empty-cell">未引用题库</td></tr>';

  return `${UI.backBtn()}
  ${UI.pageHead(s.name, {
    extra: UI.badge(store.AG_STRATEGY_STATUS[s.status], s.status === 'published' ? 'blue' : 'gray'),
    actions: s.status === 'draft'
      ? `${UI.btn('编辑', { onclick: `App.editAgStrategy('${s.id}')` })}
         ${UI.btn('发布', { kind: 'primary', onclick: `App.pubAgStrategy('${s.id}')` })}`
      : '',
  })}
  ${UI.card('基础信息', UI.kvTable([
    ['策略名称', UI.esc(s.name)],
    ['策略说明', UI.esc(s.desc || '—')],
    ['题目总数', `<span class="num">${store.agentStrategyTaskCount(s)}</span>`],
    ['迭代轮数', `<span class="num">${s.maxIterations ?? 1}</span>`],
    ['状态', UI.badge(store.AG_STRATEGY_STATUS[s.status], s.status === 'published' ? 'blue' : 'gray')],
    ['更新时间', `<span class="num">${UI.esc(s.updatedAt || '—')}</span>`],
  ]))}
  ${UI.card('引用题库', `<table class="kv-table tight">
    <thead><tr><th>题库</th><th class="num">题库题数</th><th class="num">本策略取用</th></tr></thead>
    <tbody>${bankRows}</tbody></table>`, '', true)}`;
}

/* ---------------------------------------------------------------- 编辑 */
let form = null;

function blankForm() {
  return { id: '', name: '', desc: '', banks: [], maxIterations: 1, status: 'draft' };
}

export function openAgStrategyForm(id) {
  const old = id && store.getAgentStrategy(id);
  if (old && old.status === 'published') return UI.toast('已发布的策略不可编辑');
  form = old ? { ...blankForm(), ...old, banks: (old.banks || []).map((b) => ({ ...b })) } : blankForm();
  renderForm();
}

function renderForm() {
  const picked = new Map(form.banks.map((b) => [b.bankId, b]));

  const bankRows = store.sceneBanks.map((b) => {
    const on = picked.has(b.id);
    const cur = picked.get(b.id);
    const total = b.items.length || b.total;
    return `<tr class="${on ? 'on' : ''}">
      <td><label class="chk">
        <input type="checkbox" ${on ? 'checked' : ''} onchange="App.agsBank('${b.id}',this.checked)" />
        <span>${UI.esc(b.name)}</span>
      </label></td>
      <td class="num">${total}</td>
      <td class="num">
        <input type="number" class="se-n" min="1" max="${total}" value="${cur?.count ?? total}"
          ${on ? '' : 'disabled'} oninput="App.agsBankCount('${b.id}',this.value)" />
      </td>
    </tr>`;
  }).join('');

  const body = `<div class="form-secs">
    <div class="form-sec">
      <h3>策略信息</h3>
      <div class="form-stack">
        <label class="field"><span>策略名称<i class="req">*</i></span>
          <input type="text" value="${UI.esc(form.name)}" oninput="App.agsSet('name',this.value)" placeholder="如 采购场景基线" />
        </label>
        <label class="field"><span>策略说明</span>
          <textarea rows="2" oninput="App.agsSet('desc',this.value)" placeholder="说明本策略覆盖的范围与用途">${UI.esc(form.desc)}</textarea>
        </label>
      </div>
    </div>

    <div class="form-sec">
      <h3>场景题库<i class="req">*</i></h3>
      <p class="faint text-support">勾选题库并设定取用题数。多选时题目按题库顺序拼接。</p>
      <table class="kv-table tight">
        <thead><tr><th>题库</th><th class="num">题库题数</th><th class="num">取用题数</th></tr></thead>
        <tbody>${bankRows}</tbody>
      </table>
    </div>

    <div class="form-sec">
      <h3>执行参数</h3>
      <div class="form-row">
        <label class="field"><span>迭代轮数</span>
          <input type="number" min="1" max="5" value="${form.maxIterations}" oninput="App.agsSet('maxIterations',this.value)" />
        </label>
      </div>
    </div>
  </div>`;

  const foot = `
    ${UI.btn('取消', { onclick: 'UI.closeModal()' })}
    ${UI.btn('存为草稿', { onclick: 'App.agsSave(false)' })}
    ${UI.btn('保存并发布', { kind: 'primary', onclick: 'App.agsSave(true)' })}`;

  UI.modal(form.id ? '编辑演练策略' : '新建演练策略', body, foot, { wide: true, cls: 'modal-wiz' });
}

/* ---------------------------------------------------------------- 草稿箱 */
export function agentStrategyDraftsPage() {
  const rows = store.agentStrategies.filter((s) => s.status === 'draft');
  const table = UI.pagedTable(
    'ag-stg-drafts',
    [
      { title: '策略名称', render: (s) => UI.esc(s.name || '未命名策略') },
      { title: '场景题库', render: (s) => UI.esc(store.agentStrategyBankLines(s).join('、') || '未选择') },
      { title: '题目数', width: '90px', cls: 'num', render: (s) => `<span class="num">${store.agentStrategyTaskCount(s)}</span>` },
      { title: '更新时间', width: '150px', cls: 'num', render: (s) => UI.esc(s.updatedAt || '—') },
      {
        title: '操作', width: '170px', cls: 'actions',
        render: (s) => `<div class="row-actions">
          ${UI.linkBtn('继续编辑', { onclick: `App.editAgStrategy('${s.id}')` })}
          ${UI.linkBtn('发布', { onclick: `App.pubAgStrategy('${s.id}')` })}
          ${UI.linkBtn('删除', { danger: true, onclick: `App.delAgStrategy('${s.id}')` })}
        </div>`,
      },
    ],
    rows,
    '暂无草稿策略',
  );
  return `${UI.backBtn()}${UI.pageHead('策略草稿箱')}${UI.card('', table, '', true)}`;
}

export const actions = {
  agsSearch(v) { view.q = v; UI.resetPage('ag-strategies'); router.nav('strategy', 'ag-strategy'); },
  agsStatus(v) { view.status = v; UI.resetPage('ag-strategies'); router.nav('strategy', 'ag-strategy'); },
  openAgStrategy(id) { router.nav('strategy', 'ag-strategy-detail', id); },
  newAgStrategy() { openAgStrategyForm(); },
  editAgStrategy(id) { openAgStrategyForm(id); },

  agsSet(k, v) {
    form[k] = k === 'maxIterations' ? Number(v) || 1 : v;
    if (k !== 'name' && k !== 'desc') renderForm();
  },
  agsBank(bankId, on) {
    if (on) {
      const b = store.getSceneBank(bankId);
      form.banks.push({ bankId, count: b ? (b.items.length || b.total) : null });
    } else {
      form.banks = form.banks.filter((x) => x.bankId !== bankId);
    }
    renderForm();
  },
  agsBankCount(bankId, v) {
    const hit = form.banks.find((x) => x.bankId === bankId);
    if (hit) hit.count = Number(v) || null;
  },
  agsSave(publish) {
    if (!form.name.trim()) return UI.toast('请填写策略名称');
    if (!form.banks.length) return UI.toast('请至少选择一个场景题库');
    store.saveAgentStrategy({ ...form, name: form.name.trim(), status: publish ? 'published' : 'draft' });
    UI.closeModal();
    UI.toast(publish ? '策略已发布' : '已存为草稿');
    router.nav('strategy', 'ag-strategy');
  },
  pubAgStrategy(id) {
    const s = store.getAgentStrategy(id);
    if (!s || s.status !== 'draft') return;
    store.saveAgentStrategy({ ...s, status: 'published' });
    UI.toast('策略已发布');
    router.nav('strategy', 'ag-strategy');
  },
  delAgStrategy(id) {
    const s = store.getAgentStrategy(id);
    if (!s || s.status !== 'draft') return;
    UI.modal('删除演练策略', `<p>确定删除「${UI.esc(s.name)}」？删除后不可恢复。</p>`,
      `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('删除', { kind: 'danger', onclick: `App.delAgStrategyOk('${id}')` })}`);
  },
  delAgStrategyOk(id) {
    store.deleteAgentStrategy(id);
    UI.closeModal();
    UI.toast('已删除');
    router.nav('strategy', 'ag-strategy');
  },
};
