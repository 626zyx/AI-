/* Separate product entries with shared lifecycle presentation; existing detail/workspace contracts remain stable. */
import * as router from '../core/router.js';
import { tasksPage, draftsPage, taskDetailPage } from './tasks.js';
import { agentTasksPage, agentDraftsPage, agentTaskDetailPage } from './agent-tasks.js';
import { reportsPage, reportDetailPage } from './reports.js';
import { agentReportsPage, agentReportDetailPage } from './agent-reports.js';
const presenters = { tasks: [tasksPage, agentTasksPage], reports: [reportsPage, agentReportsPage] };
const details = { drafts: [draftsPage, agentDraftsPage], 'task-detail': [taskDetailPage, agentTaskDetailPage], 'report-detail': [reportDetailPage, agentReportDetailPage] };
export function exerciseHubPage(cur) {
  const type = cur.page === 'agent' ? 'agent' : 'model';
  const sub = cur.sub.replace(/^ag-/, '');
  const section = ({ drafts:'tasks', 'task-detail':'tasks', 'report-detail':'reports' })[sub] || sub;
  const detail = details[sub];
  const presenter = detail ? detail[type === 'agent' ? 1 : 0] : presenters[section]?.[type === 'agent' ? 1 : 0];
  return presenter ? presenter(cur) : presenters.tasks[type === 'agent' ? 1 : 0](cur);
}
export const actions = {
  v3ExerciseType(type, section='tasks') {
    if (!presenters[section]) section='tasks';
    router.nav(type==='agent'?'agent':'exercise', type==='agent'?'ag-'+section:section);
  },
};
