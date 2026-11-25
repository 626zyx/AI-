import * as UI from './ui.js';
import * as store from '../domain/store.js';
import { listAssets, listAssetVersions, getAsset, validateAsset, assetVersionLabel } from '../domain/asset-intake.js';

const TYPES = { model: '模型', agent: 'Agent' };
const FIELDS = ['id','name','vendor','apiModel','apiType','baseUrl','status','image','command','framework','integrationMode','taskInput','promptFlag','baseModelId','baseModelVersion','baseModelName','surfaces','surfaceDeclarations','capabilities','modelConnection','description','verificationNote','assetId','assetVersion','versionLabel','enterpriseVersion','assetSnapshot','source','sourceKind','sourceRecordId','sourceDataset'];
const copyResource = value => Object.fromEntries(FIELDS.filter(key => value[key] !== undefined).map(key => [key, structuredClone(value[key])]));
const statusFor = asset => asset.sourceStatus === '已停用' ? 'disabled' : asset.busy ? 'checking' : asset.status === 'ready' ? 'connected' : asset.status === 'failed' ? 'error' : 'planned';
const STATE = { connected: ['已连通', 'green'], planned: ['待测试', 'gray'], error: ['连通失败', 'red'], checking: ['检查中', 'blue'], disabled: ['源已停用', 'gray'] };
let activePicker = null;

/** Model purpose is chosen by the caller, never granted through a permanent role. */
export function listPickerResources(kind = 'model') {
  if (!TYPES[kind]) throw new Error('资源类型仅支持 model 或 agent');
  const catalog = kind === 'model' ? store.models : store.agents;
  const assets = listAssets({ kind });
  const known = new Set(assets.map(asset => asset.id));
  const rows = assets.flatMap(current => listAssetVersions(current.id).filter(asset=>kind!=='model'||asset.version===current.latestVersion).map(asset => {
    const versionId = `${asset.id}@${asset.version}`;
    const entry = catalog.find(row => row.id === versionId) || catalog.find(row => row.id === asset.id) || {};
    const resource = { ...copyResource(entry), assetId: asset.id, assetVersion: asset.version, assetSnapshot: structuredClone(asset),
      id: entry.id || versionId, name: kind==='model'?asset.name:entry.name || asset.name, displayName: asset.name, kind, version: asset.version, versionLabel:assetVersionLabel(asset),
      status: statusFor(asset), source: !asset.platformConnectionId && asset.source === '人工上传' ? '手动上传' : asset.source || '手动上传', sourceKind: asset.sourceKind || 'manual',
      sourceRecordId: asset.sourceRecordId || asset.id, sourceDataset: asset.sourceDataset || '',
      apiModel: asset.apiModel || entry.apiModel, image: asset.image || entry.image,
      capabilities: asset.capabilities || [], intakeMode:asset.intakeMode, verificationMode: asset.intakeMode==='configuration'?'configuration':'demo', actualConnectionVerified: false };
    return resource;
  }));
  // Preserve resources added through legacy store APIs until the intake bridge registers them.
  for (const entry of catalog) {
    if (known.has(entry.assetId || entry.id) || rows.some(row => row.id === entry.id)) continue;
    rows.push({ ...copyResource(entry), displayName: entry.name, kind, version: entry.assetVersion || 'V1',
      source: entry.source || '平台模型配置', sourceKind: entry.sourceKind || 'platform',
      status: entry.status || 'planned', verificationMode: 'demo', actualConnectionVerified: false });
  }
  return rows;
}

function installStyle() {
  if (document.getElementById('resource-picker-style')) return;
  const link = document.createElement('link');
  link.id = 'resource-picker-style'; link.rel = 'stylesheet';
  link.href = new URL('../styles/resource-picker.css', import.meta.url).href;
  document.head.append(link);
}

/** Opens above an existing wizard/dialog; onSelect receives a secret-free catalog object. */
export function openResourcePicker({ kind = 'model', value = '', onSelect, title, allowUnverified = false } = {}) {
  if (!TYPES[kind]) throw new Error('资源类型仅支持 model 或 agent');
  if (typeof onSelect !== 'function') throw new Error('请选择资源后的处理函数 onSelect');
  activePicker?.close(); installStyle();
  const beforeFocus = document.activeElement;
  const layer = document.createElement('div');
  layer.className = 'resource-picker-layer';
  layer.dataset.resourcePicker = kind;
  document.body.append(layer);
  const currentValue = typeof value === 'object' ? value?.id : String(value || '');
  const initial = listPickerResources(kind).find(row => row.id === currentValue || `${row.assetId}@${row.assetVersion}` === currentValue || row.assetId === currentValue);
  let selectedId = initial?.id || '', query = '', source = '', state = '', message = '', closed = false, page = 1;
  const checking = new Set();
  const localChecks = new Map();
  const resources = () => listPickerResources(kind).map(row => localChecks.has(row.id) ? { ...row, ...localChecks.get(row.id) } : row);
  const selectable = row => row && !checking.has(row.id) && (row.status === 'connected' || kind === 'agent' && allowUnverified && !['disabled','checking'].includes(row.status));
  function close() {
    if (closed) return;
    closed = true; layer.remove();
    if (activePicker?.element === layer) activePicker = null;
    beforeFocus?.focus?.();
  }
  function render({ focusSearch = false } = {}) {
    if (closed) return;
    const all = resources();
    const chosen = all.find(row => row.id === selectedId);
    const q = query.trim().toLowerCase();
    const visible = all.filter(row => (!q || [row.displayName,row.name,row.id,row.apiModel,row.image,row.source].join(' ').toLowerCase().includes(q)) && (!source || row.source === source) && (!state || row.status === state));
    const count = Math.max(1, Math.ceil(visible.length / UI.PAGE_SIZE));
    page = Math.min(page, count);
    const pageRows = visible.slice((page - 1) * UI.PAGE_SIZE, page * UI.PAGE_SIZE);
    const sources = [...new Set(all.map(row => row.source))];
    layer.innerHTML = `<section class="resource-picker" role="dialog" aria-modal="true" aria-labelledby="resource-picker-title">
      <header class="rp-head"><div><h2 id="resource-picker-title">${UI.esc(title || `选择${TYPES[kind]}资源`)}</h2><p>从已接入资源中选择，所选配置会随任务保留。</p></div><button type="button" class="icon-btn" data-rp-action="close" aria-label="关闭资源选择">×</button></header>
      <div class="rp-filters"><label class="rp-search"><span>搜索</span><input type="search" data-rp-query value="${UI.esc(query)}" placeholder="搜索名称或模型标识" aria-label="搜索资源"></label>${kind==='model'?'':`<label><span>来源</span><select data-rp-source aria-label="资源来源"><option value="">全部来源</option>${sources.map(s => `<option${s === source ? ' selected' : ''} value="${UI.esc(s)}">${UI.esc(s)}</option>`).join('')}</select></label>`}<label><span>接入状态</span><select data-rp-state aria-label="接入状态"><option value="">全部状态</option>${Object.entries(STATE).filter(([key]) => key !== 'checking').map(([key,[label]]) => `<option value="${key}"${state === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div>
      <div class="rp-table-wrap"><table class="rp-table"><thead><tr><th class="rp-select-col"></th><th>资源名称</th><th>${kind === 'model' ? '模型标识' : '运行镜像'}</th><th>${kind==='model'?'API 地址':'来源'}</th><th>接入状态</th><th>操作</th></tr></thead><tbody>${pageRows.map(row => {
        const busy = checking.has(row.id); const [label,tone] = row.intakeMode==='configuration'&&row.status==='connected'?['已登记','green']:STATE[busy ? 'checking' : row.status] || ['待检查','gray'];
        return `<tr data-rp-row="${UI.esc(row.id)}" class="${selectedId === row.id ? 'selected' : ''}"><td><input type="radio" name="rp-resource" data-rp-select="${UI.esc(row.id)}" ${selectedId === row.id ? 'checked' : ''} ${selectable(row) ? '' : 'disabled'} aria-label="选择 ${UI.esc(row.displayName)}${kind==='model'?'':' '+UI.esc(row.versionLabel||row.version)}"></td><td><strong>${UI.esc(row.displayName)}</strong>${kind==='model'?'':`<small>${UI.esc(row.versionLabel||row.version)} · ${UI.esc(row.assetId || row.id)}</small>`}</td><td class="rp-identity">${UI.esc(kind === 'model' ? row.apiModel || '—' : row.image || '—')}</td><td class="rp-identity">${kind==='model'?UI.esc(row.baseUrl||row.assetSnapshot?.baseUrl||'—'):UI.esc(row.source)+(row.sourceRecordId&&row.sourceRecordId!==row.assetId?`<small>源记录 ${UI.esc(row.sourceRecordId)}</small>`:'')}</td><td>${UI.badge(label,tone)}</td><td>${row.intakeMode==='configuration'?'—':`<button type="button" class="link-btn" data-rp-test="${UI.esc(row.id)}" ${busy || row.status === 'disabled' ? 'disabled' : ''}>${busy ? '检查中…' : '测试连通'}</button>`}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="rp-empty">没有匹配资源，请调整筛选或先在资产接入中添加。</td></tr>'}</tbody></table></div>
      ${UI.pager({ page, count, total: visible.length })}
      <div class="rp-status" role="status">${UI.esc(message || (kind==='agent'&&allowUnverified?'选择靶标后需在任务中完成运行验证，通过后才能开始演练。':'连通测试为本地演示检查，不发送真实模型请求，也不读取或验证实际密钥。'))}</div>
      <footer class="rp-foot"><span>${chosen ? '已选：' + UI.esc(chosen.displayName) + (kind==='model'?'':' · ' + UI.esc(chosen.versionLabel||chosen.version)) : '尚未选择资源'}<small>共 ${visible.length} 项</small></span><div><button type="button" class="btn" data-rp-action="close">取消</button><button type="button" class="btn primary" data-rp-action="confirm" ${selectable(chosen) ? '' : 'disabled'}>确认选择</button></div></footer>
    </section>`;
    if (focusSearch) { const search = layer.querySelector('[data-rp-query]'); search.focus(); search.setSelectionRange?.(query.length, query.length); }
  }
  layer.addEventListener('input', event => {
    if (!event.target.matches('[data-rp-query]')) return;
    query = event.target.value; page = 1; render({ focusSearch: true });
  });
  layer.addEventListener('change', event => {
    if (event.target.matches('[data-rp-source]')) { source = event.target.value; page = 1; }
    if (event.target.matches('[data-rp-state]')) { state = event.target.value; page = 1; }
    if (event.target.matches('[data-rp-select]')) selectedId = event.target.dataset.rpSelect;
    render();
  });
  layer.addEventListener('click', async event => {
    const pageButton = event.target.closest('[data-page]');
    if (pageButton) { page = Number(pageButton.dataset.page); render(); return; }
    const action = event.target.closest('[data-rp-action]')?.dataset.rpAction;
    if (action === 'close') return close();
    if (action === 'confirm') {
      const chosen = resources().find(row => row.id === selectedId);
      if (!selectable(chosen)) return;
      close(); onSelect(structuredClone(chosen)); return;
    }
    const testId = event.target.closest('[data-rp-test]')?.dataset.rpTest;
    if (testId) {
      const row = resources().find(item => item.id === testId);
      if (!row || checking.has(testId) || row.status === 'disabled') return;
      checking.add(testId); message = '正在进行演示连通检查…'; render();
      try {
        if (row.assetId && getAsset(row.assetId, row.assetVersion)) {
          const checked = await validateAsset(row.assetId, { version: row.assetVersion, delay: 100 });
          message = checked.status === 'ready' ? `${row.displayName}：演示检查通过，未发起真实请求。` : `${row.displayName}：${checked.validation.steps.find(step => step.state === 'failed')?.detail || '演示检查失败'}`;
        } else {
          const configured = kind === 'model' ? Boolean(row.apiModel && row.baseUrl) : Boolean(row.image && row.command?.length);
          localChecks.set(row.id, { status: configured ? 'connected' : 'error' });
          const stored = (kind === 'model' ? store.models : store.agents).find(item => item.id === row.id);
          if (stored) { stored.status = configured ? 'connected' : 'error'; stored.connectionVerification = { mode: 'demo', actualVerified: false }; }
          message = configured ? '配置格式演示检查通过，未验证真实服务可用性。' : '配置不完整，请在资产接入中补充。';
        }
      } catch (error) { message = error.message; }
      finally { checking.delete(testId); render(); }
      return;
    }
    if (event.target.closest('button,input,select')) return;
    const rowId = event.target.closest('[data-rp-row]')?.dataset.rpRow;
    if (selectable(resources().find(row => row.id === rowId))) { selectedId = rowId; render(); }
  });
  layer.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const nodes = [...layer.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')];
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  activePicker = { close, element: layer }; render({ focusSearch: true });
  return activePicker;
}
