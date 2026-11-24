/* Agent task routes share the task list and mounted workspace. */
import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';
import { openAgentWizard } from './agent-wizard.js';
import { copyTaskConfig } from './task-wizard.js';
import { taskListPage, openTaskPage, openTaskReport } from './task-list.js';
import { taskWorkspacePage } from './task-workspace.js';
import { agentDetailPage } from './agent-detail.js';
import { reportResultPanel } from './report-result.js';
export const agentTasksPage = () => taskListPage('agent');
export const agentDraftsPage = () => taskListPage('agent', true);
export const agentTaskDetailPage = cur => agentDetailPage(cur);

export function agentResultPanel(t) {
  return reportResultPanel(t);
}

export function agentBaseRows(t) {
  return [
    ['任务名称', UI.esc(t.name)],
    ['演练类型', 'Agent 演练'],
    ['靶标名称', UI.esc(t.targetName)],
    ['任务状态', UI.statusPill(t.status)],
    ['攻击策略', UI.esc(t.strategyName || '—')],
    ['裁判模型', UI.esc(t.judgeName || '—')],
    ['创建时间', `<span class="num">${UI.esc(t.startedAt)}</span>`],
    ['完成时间', `<span class="num">${UI.esc(t.finishedAt || '—')}</span>`],
  ];
}

export function agentConfigRows(t) {
  const s = store.getAgentStrategy(t.strategyId);
  const bank = s ? store.agentStrategyBankLines(s).join('；') : `${t.sceneBankName}·前${t.total} 题`;
  const method = t.attackerName ? `${t.techniqueName}（攻击生成模型：${t.attackerName}）` : t.techniqueName;
  return [
    ['场景题库', UI.esc(bank)],
    ['攻击方法', UI.esc(method || '—')],
    ['执行并发', `${t.concurrency ?? '—'}`],
    ['单题超时', UI.esc(t.executionBudgetNote || (t.targetTimeout ? `${t.targetTimeout} 秒` : t.targetTimeout === 0 ? '不限制执行时长' : '—'))],
  ];
}

export const actions = {
  openAgTask: id => openTaskPage(id, 'agent'),
  openAgReportOf: id => openTaskReport(id, 'agent'),
  newAgTask: () => openAgentWizard(),
  agRetest: id => copyTaskConfig(id, 'agent'),
  agExport(id) { const t=store.getAgentTask(id); if(t)UI.download(`${id}-units.json`,JSON.stringify(t.units,null,2)); },
  agExportLog(id) { const t=store.getAgentTask(id); if(t)UI.download(`${t.name}-运行日志.txt`,store.agentLogText(id)); },
};
