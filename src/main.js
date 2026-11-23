/* 入口：装配外壳、注册路由、暴露全局 App / UI / Shell。
 * 依赖方向固定：main → pages → core → domain → data，不允许反向。 */
import * as shell from './core/shell.js';
import * as router from './core/router.js';
import * as ui from './core/ui.js';
import * as store from './domain/store.js';
import { mountTaskConfig } from './core/task-config.js';
import { taskWizardPage, warnOnUnsavedTask, openTaskWizard } from './pages/task-wizard.js';
import { actions as lifecycleActions } from './pages/task-list.js';
import { mountTaskWorkspace } from './pages/task-workspace.js';
import { actions as reportFormatActions, mountReportDocument } from './pages/report-format.js';

import { welcomePage, mountWelcome, actions as workbenchActions } from './pages/welcome.js';
import { tasksPage, taskDetailPage, draftsPage, actions as taskActions } from './pages/tasks.js';
import { reportsPage, reportDetailPage, actions as reportActions } from './pages/reports.js';
import { attackStrategyPage, guardStrategyPage, actions as strategyActions } from './pages/strategy.js';
import { methodsPage, banksPage, actions as libraryActions } from './pages/library.js';
import { rolesPage, riskRulePage, actions as platformActions } from './pages/platform.js';
import { actions as editorActions } from './pages/strategy-editor.js';
import { actions as wizardActions } from './pages/wizard.js';
/* Agent 演练 */
import { agentTasksPage, agentTaskDetailPage, agentDraftsPage, actions as agTaskActions } from './pages/agent-tasks.js';
import { agentReportsPage, agentReportDetailPage, actions as agReportActions } from './pages/agent-reports.js';
import { agentStrategyPage, agentStrategyDetailPage, agentStrategyDraftsPage, actions as agStrategyActions } from './pages/agent-strategy.js';
import { sceneBanksPage, actions as sceneBankActions } from './pages/scene-banks.js';
import { agentMethodsPage, actions as agMethodActions } from './pages/agent-methods.js';
import { actions as noticeActions } from './pages/notices.js';
import { actions as guideActions } from './pages/user-guide.js';
import { exerciseHubPage, actions as exerciseHubActions } from './pages/exercise-hub.js';
import { assetIntakePage, actions as intakeActions } from './pages/asset-intake.js';
import { initializeAssetBridge } from './domain/asset-bridge.js';
import { resourceAuthoringPage, actions as authoringActions } from './pages/resource-authoring.js';
import { actions as guardEditorActions } from './pages/guard-editor.js';
import { captureCompletedTaskAssessment } from './domain/metrics.js';

initializeAssetBridge();
const captureCompletedAssessments = () => [...store.listTasks(), ...store.listAgentTasks()].forEach(captureCompletedTaskAssessment);
captureCompletedAssessments();

router.register('home', 'home', welcomePage);
router.register('exercise', 'tasks', exerciseHubPage);
router.register('exercise', 'task-detail', exerciseHubPage);
router.register('exercise', 'drafts', exerciseHubPage);
router.register('exercise', 'task-create', taskWizardPage);
router.register('exercise', 'reports', exerciseHubPage);
router.register('exercise', 'report-detail', exerciseHubPage);
/* Agent 演练：独立栏目，三个子页与模型演练同构但实现分离 */
router.register('agent', 'ag-tasks', exerciseHubPage);
router.register('agent', 'ag-task-detail', exerciseHubPage);
router.register('agent', 'ag-drafts', exerciseHubPage);
router.register('agent', 'ag-task-create', taskWizardPage);
router.register('agent', 'ag-reports', exerciseHubPage);
router.register('agent', 'ag-report-detail', exerciseHubPage);
router.register('strategy', 'authoring', resourceAuthoringPage);
router.register('strategy', 'attack', attackStrategyPage);
router.register('strategy', 'methods', methodsPage);
router.register('strategy', 'banks', banksPage);
router.register('strategy', 'guard', guardStrategyPage);
router.register('strategy', 'ag-strategy', agentStrategyPage);
router.register('strategy', 'ag-strategy-detail', agentStrategyDetailPage);
router.register('strategy', 'ag-strategy-drafts', agentStrategyDraftsPage);
router.register('strategy', 'ag-methods', agentMethodsPage);
router.register('strategy', 'scenebanks', sceneBanksPage);
router.register('assets', 'intake', assetIntakePage);
router.register('assets', 'models', assetIntakePage);
router.register('assets', 'agents', assetIntakePage);
router.register('platform', 'roles', rolesPage);
router.register('platform', 'riskrule', riskRulePage);
router.register('platform', 'grading', riskRulePage);

/* 全局命名空间：页面内 onclick 只调 App / UI / Shell 三个 */
window.App = Object.assign(
  {
    go: (p, s, param) => router.nav(p, s, param),
    back: () => router.back(),
    v3Create: (kind='model', id, version) => openTaskWizard(kind, id ? { targetId: version ? id+'@'+version : id } : {}),
    /* Compatibility for archived read-only resources. */
    deleteBlocked() {
      ui.toast('当前记录正在被引用，无法删除');
    },
  },
  workbenchActions,
  taskActions,
  reportActions,
  reportFormatActions,
  strategyActions,
  libraryActions,
  platformActions,
  wizardActions,
  editorActions,
  /* Agent 演练 */
  agTaskActions,
  agReportActions,
  agStrategyActions,
  sceneBankActions,
  agMethodActions,
  noticeActions,
  guideActions,
  lifecycleActions,
  intakeActions,
  exerciseHubActions,
  authoringActions,
  guardEditorActions,
);
window.UI = ui;
window.Shell = shell.api;

shell.mount();
let disposePage = () => {};
router.setRenderer(() => {
  // A reload drops page-session tasks; their old detail links return to the list.
  const current=router.state();
  if(['task-detail','report-detail'].includes(current.sub)&&!store.getTask(current.param))return router.nav('exercise',current.sub==='report-detail'?'reports':'tasks',null,{replace:true});
  if(['ag-task-detail','ag-report-detail'].includes(current.sub)&&!store.getAgentTask(current.param))return router.nav('agent',current.sub==='ag-report-detail'?'ag-reports':'ag-tasks',null,{replace:true});
  // Drafts have no workspace or report; direct links also resume their saved configuration step.
  if(['task-detail','report-detail'].includes(current.sub)&&store.getTask(current.param)?.status==='draft')return router.nav('exercise','task-create',current.param,{replace:true});
  if(['ag-task-detail','ag-report-detail'].includes(current.sub)&&store.getAgentTask(current.param)?.status==='draft')return router.nav('agent','ag-task-create',current.param,{replace:true});
  if(current.sub==='report-detail'&&store.getTask(current.param)?.status!=='done')return router.nav('exercise','task-detail',current.param,{replace:true});
  if(current.sub==='ag-report-detail'&&store.getAgentTask(current.param)?.status!=='done')return router.nav('agent','ag-task-detail',current.param,{replace:true});
  disposePage();
  shell.render(router.state());
  const host=document.getElementById('app-main');
  const configCleanup=mountTaskConfig(host),workspaceCleanup=mountTaskWorkspace(host),welcomeCleanup=mountWelcome(host),reportCleanup=mountReportDocument(host);
  disposePage=()=>{reportCleanup();welcomeCleanup();workspaceCleanup();configCleanup();};
});
// The runtime outlives routes. Page subscriptions are explicitly disposed.
const stopRuntime=store.initializeTaskRuntime();
let pendingTaskListRefresh = false;
const taskListActive=()=>['tasks','ag-tasks','drafts','ag-drafts'].includes(router.state().sub);
const listInteractionActive=()=>document.querySelector('.overlay.open, .dd-menu:not([hidden])');
const refreshTaskList=()=>{
  const cur=router.state();
  pendingTaskListRefresh=false;
  if(taskListActive())router.nav(cur.page,cur.sub,cur.param,{replace:true});
};
store.subscribeTasks(() => {
  captureCompletedAssessments();
  if(!taskListActive())return;
  if(listInteractionActive()){pendingTaskListRefresh=true;return;}
  refreshTaskList();
});
// Progress must not dismiss a delete confirmation or a row's open action menu.
document.addEventListener('click',()=>queueMicrotask(()=>{
  if(pendingTaskListRefresh&&!listInteractionActive())refreshTaskList();
}));
window.addEventListener('pagehide',()=>{disposePage();stopRuntime();});
window.addEventListener('beforeunload', warnOnUnsavedTask);
window.addEventListener('pageshow',e=>{if(e.persisted){store.initializeTaskRuntime();const cur=router.state();router.nav(cur.page,cur.sub,cur.param,{replace:true});}});
/* 翻页 = 当前路由原地重绘 */
ui.bindPageRerender(() => { const c = router.state(); router.nav(c.page, c.sub, c.param); });

const initial = router.parseHash();
router.nav(initial.page, initial.sub || undefined, initial.param, { replace: true });
if(store.taskStorageError())ui.toast(store.taskStorageError());

window.addEventListener('hashchange', () => {
  const s = router.parseHash();
  const cur = router.state();
  if (s.page !== cur.page || s.sub !== cur.sub || s.param !== cur.param) {
    router.nav(s.page, s.sub || undefined, s.param);
  }
});

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') ui.closeModal();
});
document.addEventListener('click', () => ui.closeMenus());

/* 截断单元格的全文浮窗：只有真正被截断时才显示 */
const tip = document.createElement('div');
tip.className = 'clip-tip';
tip.hidden = true;
document.body.appendChild(tip);
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest?.('.clip-1');
  if (!el || el.scrollWidth <= el.clientWidth) { tip.hidden = true; return; }
  tip.textContent = el.dataset.full;
  tip.hidden = false;
  const r = el.getBoundingClientRect();
  const w = Math.min(480, window.innerWidth - 16);
  tip.style.maxWidth = `${w}px`;
  tip.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
  const h = tip.offsetHeight;
  tip.style.top = `${r.bottom + h + 12 > window.innerHeight ? r.top - h - 6 : r.bottom + 6}px`;
});
window.addEventListener('scroll', () => (tip.hidden = true), true);
document.getElementById('drawer').addEventListener('click', (e) => {
  if (e.target.id === 'drawer') ui.closeDrawer();
});
