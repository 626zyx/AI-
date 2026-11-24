/* Two independent columns share one presenter map; object type is derived from the route page. */
import { tasksPage, draftsPage, taskDetailPage } from './tasks.js';
import { agentTasksPage, agentDraftsPage, agentTaskDetailPage } from './agent-tasks.js';
import { reportsPage, reportDetailPage } from './reports.js';
import { agentReportsPage, agentReportDetailPage } from './agent-reports.js';
const presenters = { tasks: [tasksPage, agentTasksPage], reports: [reportsPage, agentReportsPage] };
const details = { drafts: [draftsPage, agentDraftsPage], 'task-detail': [taskDetailPage, agentTaskDetailPage], 'report-detail': [reportDetailPage, agentReportDetailPage] };
export function exerciseHubPage(cur) {
  const type = cur.page === 'agent' ? 'agent' : 'model';
  const i = type === 'agent' ? 1 : 0;
  const sub = cur.sub.replace(/^ag-/, '');
  const section = ({ drafts: 'tasks', 'task-detail': 'tasks', 'report-detail': 'reports' })[sub] || sub;
  const detail = details[sub];
  const presenter = detail ? detail[i] : presenters[section]?.[i];
  return (presenter ? presenter(cur) : presenters.tasks[i](cur));
}
export const actions = {};
