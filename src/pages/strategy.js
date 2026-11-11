/* 策略中心：攻击策略 / 防护策略 */
import { icon } from '../core/icons.js';
import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';
import * as router from '../core/router.js';

/* ---------------------------------------------------------------- 攻击策略 */
const sView = { q: '', status: 'all' };

export function attackStrategyPage() {
  let rows = store.strategies;
  if (sView.status !== 'all') rows = rows.filter((s) => s.status === sView.status);
  if (sView.q.trim()) {
    const q = sView.q.trim().toLowerCase();
    rows = rows.filter((s) => s.name.toLowerCase().includes(q));
  }
  rows = [...rows].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  const flt = UI.filters({
    search: { label: '搜索', id: 'sg-q', value: sView.q, placeholder: '搜索策略名称', oninput: 'App.sgSearch(this.value)' },
    selects: [{
      label: '状态', id: 'sg-status', value: sView.status, onchange: 'App.sgStatus(this.value)',
      options: [['all', '全部状态'], ['published', '已发布'], ['draft', '待发布']],
    }],
  });
  const table = UI.pagedTable(
    'strategies',
    [
      { title: '策略名称', render: (s) => `<button class="link-btn" onclick="App.openStrategy('${s.id}')">${UI.esc(s.name)}</button>` },
      { title: '攻击方法', render: (s) => `<span class="mono text-support">${UI.esc(s.methods.map((m) => m.name).join(' · ') || '—')}</span>` },
      { title: '攻击题库', render: (s) => `<div class="cfg-lines">${store.strategyBankLines(s).map((l) => `<div>${UI.esc(l)}</div>`).join('') || '—'}</div>` },
      { title: '状态', width: '100px', render: (s) => UI.badge(store.STRATEGY_STATUS[s.status], s.status === 'published' ? 'blue' : 'gray') },
      { title: '更新时间', width: '150px', cls: 'num', render: (s) => UI.esc(s.updatedAt) },
      {
        title: '操作', width: '120px', cls: 'actions',
        render: (s) => `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openStrategy('${s.id}')` })}
          ${UI.linkBtn('编辑', { onclick: `App.editStrategy('${s.id}')`, disabled: s.status === 'published' })}
          ${s.status === 'draft' ? UI.linkBtn('删除', { danger: true, onclick: `App.delStrategy('${s.id}')` }) : ''}
        </div>`,
      },
    ],
    rows,
    '暂无攻击策略',
  );

  return `${UI.pageHead('攻击策略', {
    actions: UI.btn('新建攻击策略', { kind: 'primary', ico: 'plus', onclick: 'App.newStrategy()' }),
  })}${flt}
  ${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 防护策略 */
export function guardStrategyPage() {
  const table = UI.pagedTable(
    'guards',
    [
      { title: '策略名称', render: (g) => `<button class="link-btn" onclick="App.openGuard('${g.id}')">${UI.esc(g.name)}</button>` },
      { title: '来源', width: '90px', render: () => '系统' },
      { title: '审核维度', render: (g) => g.dims.map(([n]) => UI.badge(n, 'gray')).join(' ') },
      { title: '可部署位置', width: '130px', render: (g) => g.stages.join(' / ') },
      {
        title: '操作', width: '90px', cls: 'actions',
        render: (g) => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openGuard('${g.id}')` })}</div>`,
      },
    ],
    store.guards,
    '暂无防护策略',
  );
  return `${UI.pageHead('防护策略')}
  ${UI.card('', table, '', true)}`;
}

export const actions = {
  delStrategy(id) {
    const s = store.strategies.find((x) => x.id === id);
    if (!s || s.status !== 'draft') return;
    UI.modal('删除攻击策略', `<p>确定删除「${UI.esc(s.name)}」？删除后不可恢复。</p>`,
      `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('删除', { kind: 'danger', onclick: `App.delStrategyOk('${id}')` })}`);
  },
  delStrategyOk(id) {
    store.deleteStrategy(id);
    UI.closeModal(); UI.closeDrawer(); UI.toast('已删除');
    router.nav('strategy', 'attack');
  },
  sgSearch(v) { sView.q = v; UI.resetPage('strategies'); router.nav('strategy', 'attack'); },
  sgStatus(v) { sView.status = v; UI.resetPage('strategies'); router.nav('strategy', 'attack'); },
  /* 详情抽屉：攻击题库 / 攻击方法与任务详情「详细配置」同一写法 */
  openStrategy(id) {
    const s = store.strategies.find((x) => x.id === id);
    if (!s) return;
    const lines = (arr) => `<div class="cfg-lines">${arr.map((l) => `<div>${UI.esc(l)}</div>`).join('')}</div>`;
    const body = `
      ${UI.card('基本信息', UI.kvTable([
        ['策略名称', UI.esc(s.name)],
        ['策略描述', UI.esc(s.desc || '—')],
        ['状态', UI.badge(store.STRATEGY_STATUS[s.status], s.status === 'published' ? 'blue' : 'gray')],
        [s.status === 'published' ? '发布时间' : '更新时间', `<span class="num">${UI.esc(s.updatedAt)}</span>`],
      ]))}
      <div class="mt-16">${UI.card('策略配置', UI.kvTable([
        ['攻击题库', lines(store.strategyBankLines(s))],
        ['攻击方法', lines(s.methods.map((m) => store.methodConfigText(m)))],
      ]))}</div>`;
    const foot = `${s.status === 'draft' ? UI.btn('删除', { kind: 'danger', onclick: `App.delStrategy('${s.id}')` }) : ''}${s.status === 'draft' ? UI.btn('编辑', { onclick: `UI.closeDrawer();App.editStrategy('${s.id}')` }) : ''}${UI.btn('关闭', { onclick: 'UI.closeDrawer()' })}`;
    UI.drawer('攻击策略详情', body, foot);
  },
  openGuard(id) {
    const g = store.guards.find((x) => x.id === id);
    if (!g) return;
    UI.drawer('防护策略详情',
      `${UI.card('基本信息', UI.kvTable([
        ['策略名称', UI.esc(g.name)],
        ['来源', '系统'],
        ['可部署位置', `输入侧：审核发给靶标的提示词<br>输出侧：审核靶标生成的回复`],
        ['判定结果', '安全 / 有争议 / 不安全'],
      ]))}
      <div class="mt-16">${UI.card(`审核维度（${g.dims.length}）`, UI.kvTable(g.dims.map(([n, d]) => [UI.esc(n), UI.esc(d)])))}</div>`,
      UI.btn('关闭', { onclick: 'UI.closeDrawer()' }));
  },
};
