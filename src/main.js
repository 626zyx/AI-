/* 入口：装配外壳、注册路由、暴露全局 App / UI / Shell。
 * 依赖方向固定：main → pages → core → domain → data，不允许反向。 */
import * as shell from './core/shell.js';
import * as router from './core/router.js';
import * as ui from './core/ui.js';

import { posturePage, actions as postureActions } from './pages/posture.js';
import { tasksPage, taskDetailPage, draftsPage, actions as taskActions } from './pages/tasks.js';
import { resultsPage, comparePage, actions as resultActions } from './pages/results.js';
import { reportsPage, reportDetailPage, actions as reportActions } from './pages/reports.js';
import { attackStrategyPage, guardStrategyPage, actions as strategyActions } from './pages/strategy.js';
import { methodsPage, banksPage, actions as libraryActions } from './pages/library.js';
import { modelsPage, actions as assetActions } from './pages/assets.js';
import { riskPage, actions as riskActions } from './pages/risk.js';
import { rolesPage, riskRulePage, actions as platformActions } from './pages/platform.js';
import { actions as editorActions } from './pages/strategy-editor.js';
import { actions as wizardActions, bindApp as bindWizardApp } from './pages/wizard.js';
/* Agent 演练 */
import { agentTasksPage, agentTaskDetailPage, agentDraftsPage, actions as agTaskActions } from './pages/agent-tasks.js';
import { agentResultsPage, agentObjectPage, agentComparePage, actions as agResultActions } from './pages/agent-results.js';
import { agentReportsPage, agentReportDetailPage, actions as agReportActions } from './pages/agent-reports.js';
import { agentStrategyPage, agentStrategyDetailPage, agentStrategyDraftsPage, actions as agStrategyActions } from './pages/agent-strategy.js';
import { sceneBanksPage, actions as sceneBankActions } from './pages/scene-banks.js';
import { agentsPage, agentAssetDetailPage, actions as agAssetActions } from './pages/agent-assets.js';
import { actions as agWizardActions } from './pages/agent-wizard.js';

router.register('posture', 'home', posturePage);
router.register('exercise', 'tasks', tasksPage);
router.register('exercise', 'task-detail', taskDetailPage);
router.register('exercise', 'drafts', draftsPage);
router.register('exercise', 'results', resultsPage);
router.register('exercise', 'compare', comparePage);
router.register('exercise', 'reports', reportsPage);
router.register('exercise', 'report-detail', reportDetailPage);
/* Agent 演练：独立栏目，三个子页与模型演练同构但实现分离 */
router.register('agent', 'ag-tasks', agentTasksPage);
router.register('agent', 'ag-task-detail', agentTaskDetailPage);
router.register('agent', 'ag-drafts', agentDraftsPage);
router.register('agent', 'ag-results', agentResultsPage);
router.register('agent', 'ag-object', agentObjectPage);
router.register('agent', 'ag-compare', agentComparePage);
router.register('agent', 'ag-reports', agentReportsPage);
router.register('agent', 'ag-report-detail', agentReportDetailPage);
router.register('strategy', 'attack', attackStrategyPage);
router.register('strategy', 'methods', methodsPage);
router.register('strategy', 'banks', banksPage);
router.register('strategy', 'guard', guardStrategyPage);
router.register('strategy', 'ag-strategy', agentStrategyPage);
router.register('strategy', 'ag-strategy-detail', agentStrategyDetailPage);
router.register('strategy', 'ag-strategy-drafts', agentStrategyDraftsPage);
router.register('strategy', 'scenebanks', sceneBanksPage);
router.register('assets', 'models', modelsPage);
router.register('assets', 'agents', agentsPage);
router.register('assets', 'agent-detail', agentAssetDetailPage);
router.register('risk', 'events', riskPage);
router.register('platform', 'roles', rolesPage);
router.register('platform', 'riskrule', riskRulePage);

/* 全局命名空间：页面内 onclick 只调 App / UI / Shell 三个 */
window.App = Object.assign(
  {
    go: (p, s, param) => router.nav(p, s, param),
    back: () => router.back(),
    /* 删除全站只有一个实现：demo 不真正删除 */
    deleteBlocked() {
      ui.toast('demo 不支持真实删除功能');
    },
  },
  postureActions,
  taskActions,
  resultActions,
  reportActions,
  strategyActions,
  libraryActions,
  assetActions,
  riskActions,
  platformActions,
  wizardActions,
  editorActions,
  /* Agent 演练 */
  agTaskActions,
  agResultActions,
  agReportActions,
  agStrategyActions,
  sceneBankActions,
  agAssetActions,
  agWizardActions,
);
bindWizardApp(window.App);
window.UI = ui;
window.Shell = shell.api;

shell.mount();
router.setRenderer(() => shell.render(router.state()));
/* 翻页 = 当前路由原地重绘 */
ui.bindPageRerender(() => { const c = router.state(); router.nav(c.page, c.sub, c.param); });

const initial = router.parseHash();
router.nav(initial.page, initial.sub || undefined, initial.param, { replace: true });

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
