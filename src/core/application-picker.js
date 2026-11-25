import * as UI from './ui.js';
import { listApplicationAssets, getApplicationAsset, APPLICATION_ADDRESS_TYPES, APPLICATION_STATUSES, applicationAddressTypeLabel } from '../domain/application-assets.js';

let activePicker = null;
const e = UI.esc;
const snapshotOf = asset => { if (!asset) return null; const { versions, ...snapshot } = asset; return structuredClone(snapshot); };
const revisionOf = asset => JSON.stringify(['id','assetId','name','enterpriseVersion','sourceStatus','addressType','address','platformConnectionId','sourceUpdatedAt','updatedAt'].map(key => asset?.[key] || ''));
const cell = (text, cls = '') => `<span class="ap-cell ${cls}" title="${e(text || '—')}">${e(text || '—')}</span>`;

function installStyle() {
  if (document.getElementById('application-picker-style')) return;
  const link = document.createElement('link'); link.id = 'application-picker-style'; link.rel = 'stylesheet';
  link.href = new URL('../styles/application-picker.css', import.meta.url).href; document.head.append(link);
}

/** Selects enterprise metadata. Runtime matching and validation belong to the task. */
export function openApplicationPicker({ value = null, onSelect } = {}) {
  if (typeof onSelect !== 'function') throw Error('请选择应用后的处理函数 onSelect');
  activePicker?.close(); installStyle();
  const doc = document, win = doc.defaultView, beforeFocus = doc.activeElement;
  const layer = doc.createElement('div'); layer.className = 'application-picker-layer'; doc.body.append(layer);
  let selected = typeof value === 'string' ? snapshotOf(getApplicationAsset(value)) : snapshotOf(value);
  let query = '', source = '', addressType = '', status = '', message = '', closed = false, page = 1;
  function close() {
    if (closed) return; closed = true; layer.remove();
    doc.removeEventListener('keydown', keyboard, true); win?.removeEventListener('hashchange', close);
    if (activePicker?.element === layer) activePicker = null;
    if (beforeFocus?.isConnected) beforeFocus.focus?.();
  }
  function render({ focusSearch = false } = {}) {
    if (closed) return;
    const all = listApplicationAssets(), q = query.trim().toLowerCase();
    const sources = [...new Map(all.map(row => [row.platformConnectionId || 'manual', row.sourceName || '手动上传'])).entries()];
    const rows = all.filter(row => (!q || [row.name,row.assetId,row.enterpriseVersion,row.address,row.sourceName].join(' ').toLowerCase().includes(q))
      && (!source || (row.platformConnectionId || 'manual') === source) && (!addressType || row.addressType === addressType) && (!status || row.sourceStatus === status));
    const count = Math.max(1, Math.ceil(rows.length / UI.PAGE_SIZE));
    page = Math.min(page, count);
    const pageRows = rows.slice((page - 1) * UI.PAGE_SIZE, page * UI.PAGE_SIZE);
    const selectedCurrent = selected && all.find(row => row.id === selected.id);
    const currentSelection = selectedCurrent && revisionOf(selectedCurrent) === revisionOf(selected);
    const statuses = [...new Set([...APPLICATION_STATUSES,...all.map(row=>row.sourceStatus).filter(Boolean)])];
    layer.innerHTML = `<section class="application-picker" role="dialog" aria-modal="true" aria-labelledby="application-picker-title">
      <header class="ap-head"><div><h2 id="application-picker-title">选择靶标 Agent</h2><p>从应用目录选择资产，选择后在任务中验证运行配置。</p></div><button type="button" class="icon-btn" data-ap-action="close" aria-label="关闭应用选择">×</button></header>
      <div class="ap-filters"><label class="ap-search"><span>搜索</span><input type="search" data-ap-query aria-label="搜索应用" placeholder="搜索名称、资产 ID、版本或地址" value="${e(query)}"></label>
      <label><span>来源</span><select data-ap-source aria-label="应用来源"><option value="">全部来源</option>${sources.map(([id,name])=>`<option value="${e(id)}"${source===id?' selected':''}>${e(name)}</option>`).join('')}</select></label>
      <label><span>地址类型</span><select data-ap-type aria-label="应用地址类型"><option value="">全部类型</option>${APPLICATION_ADDRESS_TYPES.map(type=>`<option value="${type.value}"${addressType===type.value?' selected':''}>${e(type.label)}</option>`).join('')}</select></label>
      <label><span>发布状态</span><select data-ap-status aria-label="应用发布状态"><option value="">全部状态</option>${statuses.map(value=>`<option value="${e(value)}"${status===value?' selected':''}>${e(value)}</option>`).join('')}</select></label></div>
      <div class="ap-table-wrap"><table class="ap-table"><thead><tr><th></th><th>资产名称</th><th>资产 ID</th><th>版本</th><th>来源</th><th>地址类型</th><th>资产地址</th><th>发布状态</th></tr></thead><tbody>${pageRows.map(row=>`<tr data-ap-row="${e(row.id)}" class="${selected?.id===row.id&&revisionOf(selected)===revisionOf(row)?'selected':''}"><td><input type="radio" name="ap-asset" data-ap-select="${e(row.id)}" aria-label="选择 ${e(row.name)} ${e(row.enterpriseVersion)}" ${selected?.id===row.id&&revisionOf(selected)===revisionOf(row)?'checked':''}></td><td>${cell(row.name,'ap-name')}</td><td>${cell(row.assetId)}</td><td>${cell(row.enterpriseVersion)}</td><td>${cell(row.sourceName||'手动上传')}</td><td>${cell(applicationAddressTypeLabel(row.addressType))}</td><td>${cell(row.address,'ap-address')}</td><td>${UI.badge(row.sourceStatus||'—')}</td></tr>`).join('')||'<tr><td colspan="8" class="ap-empty">没有符合条件的应用，请调整筛选或先在资产接入中登记。</td></tr>'}</tbody></table></div>
      ${UI.pager({ page, count, total: rows.length })}
      <p class="ap-status" role="status">${e(message || (selected && !currentSelection ? '已选资产已更新或不在当前目录中，请重新选择需要的版本。' : '资产地址不代表可运行配置；缺少镜像、启动命令或任务输入配置时，运行验证会明确提示。'))}</p>
      <footer class="ap-foot"><span>${selected?'已选：'+e(selected.name)+' · '+e(selected.enterpriseVersion):'尚未选择应用'}<small>共 ${rows.length} 项</small></span><div><button type="button" class="btn" data-ap-action="close">取消</button><button type="button" class="btn primary" data-ap-action="confirm" ${!currentSelection?'disabled':''}>确认选择</button></div></footer></section>`;
    if (focusSearch) { const input=layer.querySelector('[data-ap-query]'); input.focus(); input.setSelectionRange?.(query.length,query.length); }
  }
  function choose(id) { const current=getApplicationAsset(id); if (!current) return; selected=snapshotOf(current); message=''; render(); }
  layer.addEventListener('input',event=>{ if (event.target.matches('[data-ap-query]')) { query=event.target.value; page=1; render({focusSearch:true}); } });
  layer.addEventListener('change',event=>{
    if (event.target.matches('[data-ap-select]')) return choose(event.target.dataset.apSelect);
    if (event.target.matches('[data-ap-source]')) source=event.target.value;
    if (event.target.matches('[data-ap-type]')) addressType=event.target.value;
    if (event.target.matches('[data-ap-status]')) status=event.target.value;
    page=1; render();
  });
  layer.addEventListener('click',event=>{
    if (event.target===layer) return close();
    const pageButton=event.target.closest('[data-page]');
    if (pageButton) { page=Number(pageButton.dataset.page); render(); return; }
    const action=event.target.closest('[data-ap-action]');
    if (action?.disabled) return;
    if (action?.dataset.apAction==='close') return close();
    if (action?.dataset.apAction==='confirm') {
      if (closed || !selected) return;
      const current=getApplicationAsset(selected.id);
      if (!current || revisionOf(current)!==revisionOf(selected)) { message='资产信息已更新或已删除，请重新选择后确认。'; render(); return; }
      const value=snapshotOf(current); close(); onSelect(value); return;
    }
    if (event.target.closest('button,input,select')) return;
    const row=event.target.closest('[data-ap-row]'); if (row) choose(row.dataset.apRow);
  });
  function keyboard(event) {
    if (closed) return;
    if (event.key==='Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key!=='Tab') return;
    const nodes=[...layer.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')],first=nodes[0],last=nodes.at(-1);
    if (event.shiftKey && doc.activeElement===first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && doc.activeElement===last) { event.preventDefault(); first?.focus(); }
  }
  doc.addEventListener('keydown',keyboard,true); win?.addEventListener('hashchange',close);
  activePicker={close,element:layer}; render({focusSearch:true}); return activePicker;
}
