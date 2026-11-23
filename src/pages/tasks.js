/* Model task routes reuse the shared lifecycle presenters. */
import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';
import { OBJECT_TYPE, GUARD_NONE } from '../domain/constants.js';
import { openWizard, openRetest } from './wizard.js';
import { taskListPage, openTaskPage, openTaskReport } from './task-list.js';
import { taskWorkspacePage } from './task-workspace.js';
import { reportResultPanel } from './report-result.js';
const NOT_RECORDED = '<span class="faint">—</span>';
export const tasksPage = () => taskListPage('model');
export const draftsPage = () => taskListPage('model', true);
export const taskDetailPage = cur => taskWorkspacePage(cur, 'model');
export const openTask = id => openTaskPage(id, 'model');

export function resultPanel(t) {
  return reportResultPanel(t);
}

export function baseInfoRows(t) {
  return [
    ['任务名称', UI.esc(t.name)],
    ['演练类型', OBJECT_TYPE[t.objectType]?.label || '—'],
    ['靶标名称', UI.esc(t.targetName)],
    ['任务状态', UI.statusPill(t.status)],
    ['演练策略', UI.esc(t.strategyName)],
    ['裁判模型', UI.esc(t.judgeName)],
    ['防护方法', t.guardId ? `${UI.esc(t.guardName)}·${(t.guardStages?.length ? t.guardStages : ['输入', '输出']).join('+')}` : `<span class="faint">${GUARD_NONE}</span>`],
    ['创建时间', `<span class="num">${UI.esc(t.startedAt)}</span>`],
    ['完成时间', `<span class="num">${UI.esc(t.finishedAt || '—')}</span>`],
  ];
}

export function configRows(t) {
  const methods = (t.configSnapshot?.methods || t.methods || [])
    .map((m) => `<div>${UI.esc(m.name)}（最大攻击轮数：${UI.esc(m.maxRounds ?? '—')}）</div>`)
    .join('');
  return [
    ['场景题库', UI.esc(store.bankRefText(t.bankName, t.bankCount))],
    ['攻击方法', `<div class="cfg-lines">${methods}</div>`],
    ['执行并发', t.concurrency ? `${t.concurrency}` : NOT_RECORDED],
    ['单次输出上限', t.maxTokens ? `${t.maxTokens} tokens` : NOT_RECORDED],
  ];
}

export const actions = {
  openTask,
  openReportOf: id => openTaskReport(id, 'model'),
  retest(id) { const t=store.getTask(id); if(t)openRetest(t); },
  newTask: () => openWizard('model'),
  toggleNewTask: () => openWizard('model'),
  exportLog(id) { const t=store.getTask(id); if(t)UI.download(`${t.name}-运行日志.txt`,store.logText(id)); },
};
