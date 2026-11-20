/* 智能体演练 · 演练结果：与模型演练结果页对齐——搜索 + 靶标 + 风险等级筛选 + ASR 一键排序。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { compareValues } from '../core/table-sort.js';

const view = { q: '', targetId: 'all', risk: 'all', sortDesc: true };

function rowsData() {
  let rows = store.listAgentTasks().filter((t) => t.status === 'done');
  if (view.targetId !== 'all') rows = rows.filter((t) => t.targetId === view.targetId);
  if (view.risk !== 'all') rows = rows.filter((t) => t.risk.key === view.risk);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((t) => (t.name + t.targetName + t.strategyName).toLowerCase().includes(q));
  }
  rows.sort((a, b) => compareValues(a.agg.value, b.agg.value, view.sortDesc));
  return rows;
}

export function agentResultsPage() {
  const rows = rowsData();
  const targets = [...new Map(store.listAgentTasks().map((t) => [t.targetId, t.targetName])).entries()];

  const flt = UI.filters({
    search: { label: '搜索', id: 'agr-q', value: view.q, placeholder: '搜索任务 / 智能体 / 策略', oninput: 'App.agrSearch(this.value)' },
    selects: [
      {
        label: '靶标智能体', id: 'agr-target', value: view.targetId, onchange: "App.agrFilter('targetId',this.value)",
        options: [['all', '全部智能体'], ...targets],
      },
      {
        label: '风险等级', id: 'agr-risk', value: view.risk, onchange: "App.agrFilter('risk',this.value)",
        options: [['all', '全部等级'], ['critical', '高危'], ['high', '中危'], ['medium', '低危'], ['none', '安全']],
      },
    ],
  });

  const table = UI.pagedTable(
    'ag-results',
    [
      { title: '靶标智能体', render: (t) => UI.esc(t.targetName) },
      { title: 'ASR', width: '150px', cls: 'num', sort: { direction: view.sortDesc ? 'descending' : 'ascending', onclick: 'App.agrSort()' }, render: (t) => `<span class="num" title="攻击成功率（ASR）= 攻击成功数 / 总有效判定数">${UI.pct(t.agg.value)}</span>` },
      { title: '风险等级', width: '100px', render: (t) => UI.riskBadge(t.risk) },
      { title: '红队配置', render: (t) => UI.esc(t.strategyName || '—') },
      { title: '裁判模型', render: (t) => UI.esc(t.judgeName || '—') },
      {
        title: '操作', width: '150px', cls: 'actions',
        render: (t) => `<div class="row-actions">
          ${UI.linkBtn('任务详情', { onclick: `App.openAgTask('${t.id}')` })}
          ${UI.linkBtn('查看报告', { onclick: `App.openAgReportOf('${t.id}')` })}
        </div>`,
      },
    ],
    rows,
    '暂无 Agent 评估记录',
  );

  return `${UI.pageHead('Agent 评估')}${flt}${UI.card('', table, '', true)}`;
}

export const actions = {
  agrSearch(v) { view.q = v; UI.resetPage('ag-results'); router.nav('agent', 'ag-results'); },
  agrFilter(k, v) { view[k] = v; UI.resetPage('ag-results'); router.nav('agent', 'ag-results'); },
  agrSort() { view.sortDesc = !view.sortDesc; router.nav('agent', 'ag-results'); },
  openAgTask(id) { router.nav('agent', 'ag-task-detail', id); },
  openAgReportOf(taskId) { router.nav('agent', 'ag-report-detail', taskId); },
};
