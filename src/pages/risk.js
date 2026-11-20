/* 风险中心：已触发的风险事件 + 轻量处置。
 * 操作列：处理（下拉：忽略 / 已处理，改状态）+ 复测（跳到来源任务的一键复测）。
 * 处理状态只存在内存里（demo），刷新即重置。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { agentMetricLabel, agentMetricDefinition } from '../domain/metrics.js';

const view = { level: 'all', source: 'all', status: 'all', q: '' };

const STATUS = {
  pending: { label: '待处理', tone: 'amber' },
  ignored: { label: '忽略', tone: 'gray' },
  handled: { label: '已处理', tone: 'green' },
};
const handled = new Map(); // `${source}:${id}` -> status
const statusOf = (e) => handled.get(`${e.source}:${e.id}`) || 'pending';

export function riskPage() {
  let rows = store.riskEvents();
  if (view.source !== 'all') rows = rows.filter((e) => e.source === view.source);
  if (view.level !== 'all') rows = rows.filter((e) => e.risk.key === view.level);
  if (view.status !== 'all') rows = rows.filter((e) => statusOf(e) === view.status);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((e) => (e.targetName + e.taskName + e.typeName).toLowerCase().includes(q));
  }
  rows = [...rows].sort((a, b) => b.asr - a.asr);

  const flt = UI.filters({
    search: { label: '搜索', id: 'rk-q', value: view.q, placeholder: '搜索风险事件、靶标或来源任务', oninput: 'App.rkFilter("q",this.value)' },
    selects: [
      {
        label: '来源', id: 'rk-source', value: view.source, onchange: 'App.rkFilter("source",this.value)',
        options: [['all', '全部来源'], ['model', '模型演练'], ['agent', 'Agent 演练']],
      },
      {
        label: '风险等级', id: 'rk-level', value: view.level, onchange: 'App.rkFilter("level",this.value)',
        options: [['all', '全部等级'], ['critical', '高危'], ['high', '中危'], ['medium', '低危']],
      },
      {
        label: '处理状态', id: 'rk-status', value: view.status, onchange: 'App.rkFilter("status",this.value)',
        options: [['all', '全部状态'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])],
      },
    ],
    right: `<span class="faint text-support">${UI.linkBtn('触发与分级规则', { onclick: "App.go('platform','riskrule')" })}</span>`,
  });

  const openTask = (e) => (e.source === 'agent' ? `App.openAgTask('${e.id}')` : `App.openTask('${e.id}')`);
  const retest = (e) => (e.source === 'agent' ? `App.agRetest('${e.id}')` : `App.retest('${e.id}')`);
  const table = UI.pagedTable(
    'risk',
    [
      { title: '风险事件', render: (e) => {
        const task = e.source === 'agent' ? store.getAgentTask(e.id) : null;
        return `<span title="${UI.esc(agentMetricDefinition(task))}">${UI.esc(e.targetName)} · ${UI.esc(agentMetricLabel(task, true))} ${UI.pct(e.asr)}</span>`;
      } },
      { title: '来源', width: '100px', render: (e) => (e.source === 'agent' ? 'Agent 演练' : '模型演练') },
      { title: '风险等级', width: '90px', render: (e) => UI.riskBadge(e.risk) },
      { title: '来源任务', render: (e) => `<button class="link-btn" onclick="${openTask(e)}">${UI.esc(e.taskName)}</button>` },
      { title: '触发时间', width: '150px', cls: 'num', render: (e) => UI.esc(e.at || '—') },
      { title: '处理状态', width: '90px', render: (e) => UI.badge(STATUS[statusOf(e)].label, STATUS[statusOf(e)].tone) },
      {
        title: '操作', width: '150px', cls: 'actions',
        render: (e) => `<div class="row-actions">
          ${UI.moreMenu([['忽略', `App.rkSet('${e.source}','${e.id}','ignored')`], ['已处理', `App.rkSet('${e.source}','${e.id}','handled')`]], '处理')}
          ${UI.linkBtn('复测', { onclick: retest(e) })}
        </div>`,
      },
    ],
    rows,
    '暂无风险事件',
  );
  return `${UI.pageHead('风险中心')}${flt}${UI.card('', table, '', true)}`;
}

export const actions = {
  rkFilter(k, v) { view[k] = v; UI.resetPage('risk'); router.nav('risk', 'events'); },
  rkSet(source, id, status) {
    handled.set(`${source}:${id}`, status);
    UI.toast(`已标记为「${STATUS[status].label}」`);
    router.nav('risk', 'events');
  },
};
