/* Shared report-list actions; task records and assessment history stay available. */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';

let pending = null;
export const actions = {
  rpDeleteReport(id, type = 'model') {
    if (!['model', 'agent'].includes(type)) return;
    const task = type === 'agent' ? store.getAgentTask(id) : store.getTask(id);
    if (task?.status !== 'done' || store.isReportDeleted(id, type)) return UI.toast('报告不存在');
    pending = { id, type };
    UI.modal('删除报告', `<p>从报告列表删除「${UI.esc(task.name)}」？</p><p class="muted">任务、演练记录及评估结果保留。</p>`,
      UI.btn('取消', { onclick: 'UI.closeModal()' }) + UI.btn('删除', { kind: 'danger', onclick: 'App.rpConfirmDeleteReport()' }));
  },
  rpConfirmDeleteReport() {
    if (!pending || !document.getElementById('modal')?.classList.contains('open') || !document.querySelector('#modal [onclick="App.rpConfirmDeleteReport()"]')) return;
    const { id, type } = pending;
    try {
      store.deleteReport(id, type);
      pending = null;
      UI.closeModal();
      UI.resetPage(type === 'agent' ? 'ag-reports' : 'reports');
      router.nav(type === 'agent' ? 'agent' : 'exercise', type === 'agent' ? 'ag-reports' : 'reports');
      UI.toast('报告已从列表删除');
    } catch (error) { UI.toast(error.message); }
  },
};
