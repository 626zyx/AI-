import * as UI from './ui.js';
import { getAgentQuestions } from '../domain/agent-environments.js';
import { listResourceGroups } from '../domain/resource-groups.js';
import * as Tags from '../domain/resource-tags.js';
import { RISK_LABEL } from '../domain/constants.js';
import { renderTagFilter, matchesTagSelection, normalizeTagSelection, actions as tagActions } from './tag-filter.js';
import { renderSelectionSummary } from './selection-summary.js';

const e = UI.esc, PAGE_SIZE = UI.PAGE_SIZE, FILTER_KEY = 'task-environment-picker';
let activePicker = null;

function installStyle() {
  if (document.getElementById('environment-picker-style')) return;
  const link = document.createElement('link');
  link.id = 'environment-picker-style'; link.rel = 'stylesheet';
  link.href = new URL('../styles/environment-picker.css', import.meta.url).href;
  document.head.append(link);
}

function publishedRows() {
  const rows = getAgentQuestions({ status: 'published' });
  Tags.registerResourceSeeds('environment', rows.map(row => ({ id: row.id, title: row.title,
    seeds: { business: row.business ? [row.business] : [], risk: row.riskLabels.map(id => RISK_LABEL[id]?.label || id) } })));
  const classifications = new Map(Tags.getResourcesTags('environment', rows.map(row => row.id)).map(row => [row.id, row]));
  return rows.map(row => ({ ...row, classification: classifications.get(row.id) || { names: {} } }));
}

function environmentGroups(rows) {
  const system = new Map();
  for (const row of rows) if (row.source === 'system') {
    const id = 'system-environment-' + row.bankId;
    if (!system.has(id)) system.set(id, { id, name: row.business, memberIds: [] });
    system.get(id).memberIds.push(row.id);
  }
  return [...system.values(), ...listResourceGroups('environment')];
}

const cell = text => '<span class="ep-cell" title="' + e(text || '—') + '">' + e(text || '—') + '</span>';

/** A staged picker: the caller's configuration changes only after confirmation. */
export function openEnvironmentPicker({ value = [], onConfirm } = {}) {
  if (typeof onConfirm !== 'function') throw Error('请选择环境后的处理函数 onConfirm');
  activePicker?.close(); installStyle();
  const doc = document, win = doc.defaultView, beforeFocus = doc.activeElement;
  const layer = doc.createElement('div');
  layer.className = 'environment-picker-layer'; doc.body.append(layer);
  const selected = new Set((Array.isArray(value) ? value : []).map(String));
  const staged = new Set();
  let query = '', source = '', group = '', tags = {}, onlySelected = false, page = 1, notice = '', closed = false;

  function close() {
    if (closed) return;
    closed = true; tagActions.tfDone(FILTER_KEY); layer.remove();
    doc.removeEventListener('keydown', keyboard, true); win?.removeEventListener('hashchange', close);
    if (activePicker?.element === layer) activePicker = null;
    if (beforeFocus?.isConnected) beforeFocus.focus?.();
  }

  function snapshot() {
    const all = publishedRows(), groups = environmentGroups(all), dimensions = Tags.listTagDimensions();
    tags = normalizeTagSelection(tags);
    const groupIds = group ? new Set(groups.find(row => row.id === group)?.memberIds || []) : null;
    const needle = query.trim().toLowerCase();
    const filtered = all.filter(row => {
      const names = row.classification.names || {};
      const search = [row.title, row.taskId, row.id, ...dimensions.flatMap(d => names[d.id]?.length ? names[d.id] : ['未打标签'])].join(' ').toLowerCase();
      return (!needle || search.includes(needle)) && (!source || row.source === source) && (!groupIds || groupIds.has(row.id)) && matchesTagSelection(row.classification, tags);
    });
    const visible = onlySelected ? filtered.filter(row => selected.has(row.id)) : filtered;
    const available = new Set(all.map(row => row.id));
    return { all, groups, dimensions, filtered, visible, available, unavailable: [...selected].filter(id => !available.has(id)) };
  }

  function render({ focusSearch = false } = {}) {
    if (closed) return;
    const data = snapshot(), pages = Math.max(1, Math.ceil(data.visible.length / PAGE_SIZE));
    page = Math.max(1, Math.min(page, pages));
    const rows = data.visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), checked = onlySelected ? selected : staged;
    const summary = renderSelectionSummary({ count: selected.size, visibleCount: data.filtered.filter(row => selected.has(row.id)).length,
      unit: '个环境', onlySelected, onOnlySelected: 'ep-only', onClear: 'ep-clear', clearLabel: '清空已选',
      onSelectFiltered: 'ep-select-filtered', filteredCount: data.filtered.length, notice,
      stagedCount: staged.size, onAdd: 'ep-add', onClearStaged: 'ep-clear-staged' })
      .replace(/on(?:click|change)="ep-([a-z-]+)"/g, 'data-ep-action="$1"');
    layer.innerHTML = `<section class="environment-picker" role="dialog" aria-modal="true" aria-labelledby="environment-picker-title">
      <header class="ep-head"><div><h2 id="environment-picker-title">选择环境</h2><p>筛选并勾选已发布环境，加入已选后可继续跨页、跨分组选择。</p></div><button type="button" class="icon-btn" data-ep-action="close" aria-label="关闭环境选择">×</button></header>
      <div class="ep-body">${summary}
      <div class="filters ep-filters"><label class="filter search"><span>搜索</span><input type="search" data-ep-query aria-label="搜索环境" placeholder="搜索环境名称、编号或标签" value="${e(query)}"></label>
      <label class="filter"><span>来源</span><select data-ep-source aria-label="环境来源"><option value="">全部来源</option><option value="system"${source === 'system' ? ' selected' : ''}>系统</option><option value="custom"${source === 'custom' ? ' selected' : ''}>自建</option></select></label>
      <label class="filter"><span>分组</span><select data-ep-group aria-label="环境分组"><option value="">全部分组</option>${data.groups.map(row => `<option value="${e(row.id)}"${group === row.id ? ' selected' : ''}>${e(row.name)}</option>`).join('')}</select></label>
      ${renderTagFilter(FILTER_KEY, { getSelection: () => tags, onChange: next => { tags = next; page = 1; render(); } })}</div>
      ${data.unavailable.length ? `<div class="ep-unavailable" role="alert">${data.unavailable.length} 个已选环境已删除或不再发布，请移除后确认。<button type="button" class="link-btn" data-ep-action="remove-unavailable">移除不可用环境</button></div>` : ''}
      <div class="ep-table-wrap"><table class="grid ep-table"><colgroup><col style="width:42px"><col style="width:245px"><col style="width:170px"><col style="width:65px"><col style="width:145px"><col style="width:165px"><col style="width:185px"></colgroup><thead><tr>
      <th><input type="checkbox" data-ep-page aria-label="${onlySelected ? '取消本页已选环境' : '选择本页环境'}" ${rows.length && rows.every(row => checked.has(row.id)) ? 'checked' : ''} ${rows.length ? '' : 'disabled'}></th><th>环境名称</th><th>环境编号</th><th>来源</th><th>业务类型</th><th>风险场景</th><th>其他标签</th></tr></thead>
      <tbody>${rows.map(row => {
        const names = row.classification.names || {}, other = data.dimensions.filter(d => !['business', 'risk'].includes(d.id)).filter(d => names[d.id]?.length).map(d => d.name + '：' + names[d.id].join('、')).join('；');
        return `<tr data-ep-row="${e(row.id)}"><td><input type="checkbox" data-ep-select="${e(row.id)}" aria-label="选择 ${e(row.title)}" ${checked.has(row.id) ? 'checked' : ''}></td><td>${cell(row.title)}${!onlySelected && selected.has(row.id) ? '<span class="ep-added">已加入</span>' : ''}</td><td>${cell(row.taskId || row.id)}</td><td>${row.source === 'system' ? '系统' : '自建'}</td><td>${cell((names.business || []).join('；'))}</td><td>${cell((names.risk || []).join('；'))}</td><td>${cell(other || '—')}</td></tr>`;
      }).join('') || '<tr><td colspan="7" class="ep-empty">没有匹配的已发布环境，请调整筛选条件。</td></tr>'}</tbody></table></div>
      <div class="ep-pager"><span>共 ${data.visible.length} 个环境</span><div><button type="button" class="btn" data-ep-action="previous" ${page <= 1 ? 'disabled' : ''}>上一页</button><span aria-label="环境分页">${page} / ${pages}</span><button type="button" class="btn" data-ep-action="next" ${page >= pages ? 'disabled' : ''}>下一页</button></div></div></div>
      <footer class="ep-foot"><span role="status">${staged.size ? `还有 ${staged.size} 个待加入环境，请先加入已选或清空待加入。` : `已选 ${selected.size} 个环境，确认后应用到任务。`}</span><div><button type="button" class="btn" data-ep-action="close">取消</button><button type="button" class="btn primary" data-ep-action="confirm" ${staged.size || data.unavailable.length ? 'disabled' : ''}>确认选择</button></div></footer>
    </section>`;
    const pageBox = layer.querySelector('[data-ep-page]');
    pageBox.indeterminate = rows.some(row => checked.has(row.id)) && !rows.every(row => checked.has(row.id));
    if (focusSearch) { const input = layer.querySelector('[data-ep-query]'); input.focus(); input.setSelectionRange?.(query.length, query.length); }
  }

  function action(name) {
    if (closed) return;
    if (name === 'close') return close();
    if (name === 'confirm') {
      const data = snapshot();
      if (staged.size || data.unavailable.length) { notice = '请先处理待加入或不可用的环境，再确认选择。'; render(); return; }
      const ids = [...selected]; close(); onConfirm(ids); return;
    }
    if (name === 'previous') page--;
    if (name === 'next') page++;
    if (name === 'clear') { selected.clear(); notice = '已清空累计选择。'; }
    if (name === 'clear-staged') { staged.clear(); notice = '已清空本次待加入环境。'; }
    if (name === 'select-filtered') { const data = snapshot(); data.filtered.forEach(row => staged.add(row.id)); notice = `已勾选当前筛选下 ${data.filtered.length} 个环境，点击「加入已选」确认本次选择。`; }
    if (name === 'add') {
      const available = snapshot().available; let added = 0, duplicate = 0, unavailable = 0;
      for (const id of staged) { if (!available.has(id)) unavailable++; else if (selected.has(id)) duplicate++; else { selected.add(id); added++; } }
      staged.clear(); notice = `本次新增 ${added} 个环境${duplicate ? `，已去重 ${duplicate} 项` : ''}${unavailable ? `，跳过 ${unavailable} 个不可用环境` : ''}。`;
    }
    if (name === 'remove-unavailable') { snapshot().unavailable.forEach(id => selected.delete(id)); notice = '已移除不可用环境。'; }
    render();
  }

  layer.addEventListener('click', event => {
    if (event.target === layer) return close();
    const target = event.target.closest('[data-ep-action]');
    if (target && target.tagName !== 'INPUT' && !target.disabled) action(target.dataset.epAction);
  });
  layer.addEventListener('input', event => { if (event.target.matches('[data-ep-query]')) { query = event.target.value; page = 1; render({ focusSearch: true }); } });
  layer.addEventListener('change', event => {
    const target = event.target;
    if (target.matches('[data-ep-source]')) { source = target.value; page = 1; }
    else if (target.matches('[data-ep-group]')) { group = target.value; page = 1; }
    else if (target.dataset.epAction === 'only') { onlySelected = target.checked; page = 1; }
    else if (target.matches('[data-ep-select]')) { const set = onlySelected ? selected : staged; target.checked ? set.add(target.dataset.epSelect) : set.delete(target.dataset.epSelect); notice = ''; }
    else if (target.matches('[data-ep-page]')) { const set = onlySelected ? selected : staged; snapshot().visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).forEach(row => target.checked ? set.add(row.id) : set.delete(row.id)); notice = ''; }
    else return;
    render();
  });
  function keyboard(event) {
    if (closed || event.defaultPrevented) return;
    if (event.key === 'Escape') {
      // The shared tag chooser consumes Escape first while its two-column menu is open.
      if (layer.querySelector('.tf-popover')) { event.preventDefault(); event.stopImmediatePropagation(); tagActions.tfDone(FILTER_KEY); return; }
      event.preventDefault(); event.stopImmediatePropagation(); close(); return;
    }
    if (event.key !== 'Tab') return;
    const nodes = [...layer.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')], first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  render({ focusSearch: true });
  doc.addEventListener('keydown', keyboard, true); win?.addEventListener('hashchange', close);
  activePicker = { close, element: layer };
  return activePicker;
}
