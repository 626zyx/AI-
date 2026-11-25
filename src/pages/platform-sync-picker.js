import * as UI from '../core/ui.js';
import { getPlatformConnection, listPlatformConnections } from '../domain/asset-intake.js';
import { syncPlatformConnection } from '../domain/platform-connection.js';

import { openPlatformConnection } from './platform-connection.js';

const e = UI.esc;
let picker = null;
const connected = row => row?.state === 'connected';
const statusText = row => connected(row) ? '已连通' : ['error', 'partial'].includes(row.state) ? '连接异常' : '未连通';
const visibleRows = current => listPlatformConnections().filter(row => row.name.toLowerCase().includes(current.query.trim().toLowerCase())
  && (current.status === 'all' || (current.status === 'connected' ? connected(row) : !connected(row))));
const hostFor = current => picker === current ? document.querySelector('#modal.open .aps-picker') : null;

function pageRows(current) {
  const rows = visibleRows(current);
  current.page = Math.max(1, Math.min(current.page || 1, Math.ceil(rows.length / UI.PAGE_SIZE) || 1));
  return rows.slice((current.page - 1) * UI.PAGE_SIZE, current.page * UI.PAGE_SIZE);
}
function renderPager(current) {
  const total = visibleRows(current).length;
  return UI.pager({ page: current.page, count: Math.ceil(total / UI.PAGE_SIZE) || 1, total }, 'App.apsPage({p})');
}
function renderRows(current) {
  const rows = pageRows(current);
  return rows.map(row => `<tr data-platform-id="${e(row.id)}"><td><input type="checkbox" data-aps-select="${e(row.id)}" aria-label="选择 ${e(row.name)}" ${current.selected.has(row.id) ? 'checked' : ''} ${current.busy || !connected(row) ? 'disabled' : ''} onchange="App.apsSelect(this.dataset.apsSelect,this.checked)" ${!connected(row) ? 'title="请先连通该平台"' : ''}></td><td>${e(row.name)}</td><td>${UI.badge(statusText(row))}${!connected(row)?' <button type="button" class="link-btn" data-aps-connect="'+e(row.id)+'" '+(current.busy?'disabled':'')+' onclick="App.apsConnect(this.dataset.apsConnect)">去连接</button>':''}</td></tr>`).join('')
    || '<tr><td colspan="3" class="empty-cell">暂无匹配平台</td></tr>';
}

function renderResults(current) {
  if (!current.results.length) return '';
  const successes = current.results.filter(row => row.state === 'succeeded'), failures = current.results.filter(row => row.state === 'failed');
  const count = successes.reduce((sum, row) => sum + row.importedCount, 0);
  const summary = current.busy ? `正在同步，已处理 ${current.results.length} / ${current.requestedCount} 个平台`
    : `成功同步 ${successes.length} 个平台、${count} 个资产${failures.length ? `；${failures.length} 个平台同步失败` : ''}`;
  const pages = Math.ceil(current.results.length / UI.PAGE_SIZE) || 1;
  current.resultPage = Math.min(current.resultPage || 1, pages);
  const shown = current.results.slice((current.resultPage - 1) * UI.PAGE_SIZE, current.resultPage * UI.PAGE_SIZE);
  return `<p class="aps-result-summary" role="status">${e(summary)}</p><ul class="aps-result-list">${shown.map(row => `<li class="${row.state}"><strong>${e(row.name)}</strong><span>${row.state === 'succeeded' ? `已同步 ${row.importedCount} 个资产` : e(row.message)}</span></li>`).join('')}</ul>${UI.pager({ page: current.resultPage, count: pages, total: current.results.length }, 'App.apsResultsPage({p})')}${current.refreshError ? `<p class="aps-refresh-error" role="alert">${e(current.refreshError)}</p>` : ''}`;
}

function updatePicker(current, { rows = false } = {}) {
  const host = hostFor(current); if (!host) return;
  const previousScroll = host.querySelector('.aps-table').scrollTop;
  if (rows) { host.querySelector('tbody').innerHTML = renderRows(current); host.querySelector('#aps-pager').innerHTML = renderPager(current); }
  for (const checkbox of host.querySelectorAll('[data-aps-select]')) {
    checkbox.checked = current.selected.has(checkbox.dataset.apsSelect);
    checkbox.disabled = current.busy || !connected(getPlatformConnection(checkbox.dataset.apsSelect));
  }
  const eligible = pageRows(current).filter(connected), chosen = eligible.filter(row => current.selected.has(row.id));
  const all = host.querySelector('#aps-all');
  all.checked = eligible.length > 0 && chosen.length === eligible.length;
  all.indeterminate = chosen.length > 0 && chosen.length < eligible.length;
  all.disabled = current.busy || eligible.length === 0;
  for(const button of host.querySelectorAll('[data-aps-connect]'))button.disabled=current.busy;
  host.querySelector('#aps-query').disabled = current.busy;
  host.querySelector('#aps-status').disabled = current.busy;
  host.querySelector('#aps-results').innerHTML = renderResults(current);
  host.querySelector('.aps-table').scrollTop = previousScroll;
  host.querySelector('#aps-selected').textContent = `已选 ${current.selected.size} 个平台`;
  const confirm = host.querySelector('#aps-confirm');
  confirm.disabled = current.busy || current.selected.size === 0;
  confirm.textContent = current.busy ? '同步中…' : '确认同步';
  const cancel = host.querySelector('#aps-cancel');
  cancel.disabled = current.busy;
  cancel.textContent = current.results.length && !current.busy ? '关闭' : '取消';
  host.querySelector('.modal-head .icon-btn').disabled = current.busy;
  host.setAttribute('aria-busy', String(current.busy));
}

function renderPicker(current) {
  UI.modal('从平台同步', `<div class="aps-filters"><label class="aps-search"><span>搜索</span><input type="search" id="aps-query" placeholder="搜索平台名称" oninput="App.apsSearch(this.value)"></label><label><span>连接状态</span><select id="aps-status" onchange="App.apsStatus(this.value)"><option value="all">全部状态</option><option value="connected">已连通</option><option value="not-connected">未连通</option></select></label></div><div class="table-wrap aps-table"><table class="grid"><thead><tr><th><input type="checkbox" id="aps-all" aria-label="全选当前页的已连通平台" onchange="App.apsSelectAll(this.checked)"></th><th>平台名称</th><th>连接状态</th></tr></thead><tbody>${renderRows(current)}</tbody></table></div><div id="aps-pager">${renderPager(current)}</div><div id="aps-results" class="aps-results" aria-live="polite"></div>`,
    '<span id="aps-selected" class="aps-selected">已选 0 个平台</span><button type="button" id="aps-cancel" class="btn w-sm" onclick="App.apsCancel()">取消</button><button type="button" id="aps-confirm" class="btn w-md primary" disabled onclick="App.apsConfirm()">确认同步</button>', { cls: 'aps-picker' });
  const host = hostFor(current);
  host.querySelector('.modal-head .icon-btn').setAttribute('onclick', 'App.apsCancel()');
  host.querySelector('#aps-query').value = current.query;
  host.querySelector('#aps-status').value = current.status;
  host.querySelector('.aps-table').scrollTop = current.scrollTop;
  updatePicker(current);
  host.querySelector('#aps-query').focus();
}

export function openPlatformSyncPicker({ onSynced } = {}) {
  if (picker?.busy) return;
  const current = { page: 1, resultPage: 1, query: '', status: 'all', selected: new Set(), results: [], requestedCount: 0, busy: false, suspended: false, scrollTop: 0, onSynced, refreshError: '' };
  picker = current;
  renderPicker(current);
}

export const platformSyncPickerActions = {
  apsConnect(id) {
    const current = picker;
    if (!current || current.busy || current.suspended || !getPlatformConnection(id)) return;
    current.scrollTop = hostFor(current)?.querySelector('.aps-table').scrollTop || 0;
    current.suspended = true;
    const restore = () => {
      if (picker !== current) return;
      for (const selectedId of current.selected) if (!connected(getPlatformConnection(selectedId))) current.selected.delete(selectedId);
      current.suspended = false;
      renderPicker(current);
    };
    openPlatformConnection(id, { onSaved: restore, onCancel: restore });
  },
  apsPage(page) { const current = picker; if (!current || current.busy || current.suspended) return; current.page = Number(page); updatePicker(current, { rows: true }); },
  apsResultsPage(page) { const current = picker; if (!current || current.suspended) return; current.resultPage = Number(page); updatePicker(current); },
  apsSearch(query) { const current = picker; if (!current || current.busy || current.suspended) return; current.query = String(query); current.page = 1; updatePicker(current, { rows: true }); },
  apsStatus(status) { const current = picker; if (!current || current.busy || current.suspended || !['all', 'connected', 'not-connected'].includes(status)) return; current.status = status; current.page = 1; updatePicker(current, { rows: true }); },
  apsSelect(id, checked) { const current = picker; if (!current || current.busy || current.suspended) return; if (!checked) current.selected.delete(id); else if (connected(getPlatformConnection(id))) current.selected.add(id); updatePicker(current); },
  apsSelectAll(checked) { const current = picker; if (!current || current.busy || current.suspended) return; for (const row of pageRows(current).filter(connected)) checked ? current.selected.add(row.id) : current.selected.delete(row.id); updatePicker(current); },
  apsCancel() { if (picker?.busy) return; picker = null; UI.closeModal(); },
  async apsConfirm() {
    const current = picker;
    if (!current || current.busy || current.suspended || !current.selected.size) return;
    const ids = [...current.selected]; current.busy = true; current.results = []; current.requestedCount = ids.length; current.refreshError = '';
    updatePicker(current);
    try {
      for (const id of ids) {
        const connection = getPlatformConnection(id), name = connection?.name || '已移除的平台';
        if (!connected(connection)) {
          current.results.push({ platformId: id, name, state: 'failed', message: connection ? '平台当前未连通，请连通后重新选择。' : '平台连接已不存在，请重新选择。' });
          current.selected.delete(id); updatePicker(current, { rows: true }); continue;
        }
        try {
          const result = await syncPlatformConnection(id);
          current.results.push({ platformId: id, name, state: 'succeeded', importedCount: result.imported.length, changedCount: result.changed?.length || 0, mode: result.mode });
          current.selected.delete(id);
        } catch (error) { current.results.push({ platformId: id, name, state: 'failed', message: error.message || '同步失败，请重试。' }); }
        updatePicker(current);
      }
      const succeeded = current.results.filter(row => row.state === 'succeeded'), failed = current.results.filter(row => row.state === 'failed');
      const summary = { succeeded, failed, platformIds: succeeded.map(row => row.platformId), importedCount: succeeded.reduce((sum, row) => sum + row.importedCount, 0), changedCount: succeeded.reduce((sum, row) => sum + row.changedCount, 0) };
      if (succeeded.length) {
        try { await current.onSynced?.(summary); }
        catch { current.refreshError = '同步结果已保存，目录刷新失败，请关闭后刷新页面。'; }
      }
      return summary;
    } finally { current.busy = false; updatePicker(current, { rows: true }); }
  },
};
