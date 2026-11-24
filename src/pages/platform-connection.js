import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import { getPlatformConnection, savePlatformConnection } from '../domain/asset-intake.js';
import * as Connection from '../domain/platform-connection.js';

const e = UI.esc;
const STEPS = ['连接平台', '映射字段', '选择范围', '同步规则', '预览并同步'];
const ROUTES = ['connection-create', 'connection-edit'];
const kindLabel = kind => kind === 'agent' ? '智能体' : '模型';
const field = (title, body, hint = '') => `<label class="field"><span>${e(title)}</span>${body}${hint ? `<small>${e(hint)}</small>` : ''}</label>`;
const options = (rows, current) => rows.map(([value, text]) => `<option value="${e(value)}" ${String(value) === String(current) ? 'selected' : ''}>${e(text)}</option>`).join('');
const input = (key, value, extra = '') => `<input id="pc-${key}" value="${e(value ?? '')}" oninput="App.pcField('${key}',this.value)" ${extra}>`;
const select = (key, rows, value, extra = '') => `<select id="pc-${key}" onchange="App.pcField('${key}',this.value)" ${extra}>${options(rows, value)}</select>`;
const quote = value => e(JSON.stringify(String(value)));
const back = () => UI.backBtn().replace('App.back()', 'App.pcCancel()');
let editor = null, pendingNavigation = null;

function refresh() {
  const cur = router.state();
  router.nav(cur.page, cur.sub, cur.param, {replace:true});
}
function refreshStep() {
  refresh();
  if (typeof document !== 'undefined') {
    const main = document.getElementById('app-main');
    if (main) main.scrollTop = 0;
  }
}
function changed() { editor.dirty = true; editor.error = ''; }
function showError(error) { editor.error = error.message || String(error); refresh(); }
function begin(cur) {
  const routeKey = `${cur.sub}/${cur.param || ''}`;
  if (editor?.routeKey === routeKey) return editor;
  const existing = cur.sub === 'connection-edit' ? getPlatformConnection(cur.param) : null;
  if (cur.sub === 'connection-edit' && !existing) { editor = null; return null; }
  editor = {routeKey, form:Connection.newConnectionDraft(existing || {}), step:0, testResult:null, testing:false, saving:false, dirty:false, error:''};
  return editor;
}
function connectionForm(c) {
  return `<h2 class="pc-section-title">连接与鉴权</h2><div class="ai-form-grid">
    ${field('连接名称 *', input('name', c.name, 'placeholder="企业资产平台"'))}
    ${field('连接器', select('connector', [['rest','通用 REST API'],['standard','企业 AI 资产标准接口']], c.connector))}
    ${field('API 地址 *', input('baseUrl', c.baseUrl, 'placeholder="https://assets.company.cn/api"'))}
    ${field('资源路径 *', input('resourcePath', c.resourcePath, 'placeholder="/ai-assets"'))}
    ${field('鉴权方式', select('authType', [['bearer','Bearer Token'],['apikey','API Key'],['none','无需认证']], c.authType))}
    ${field('负责人', input('owner', c.owner))}
    ${c.authType !== 'none' ? field(c.credentialConfigured ? '平台读取凭据（留空保留）' : '平台读取凭据', input('credential', c.credential, 'type="password" autocomplete="new-password" placeholder="仅用于读取企业资产目录"')) + field('或凭据引用', input('credentialRef', c.credentialRef, 'placeholder="vault://enterprise-assets/read-only"')) : ''}
    ${c.authType === 'apikey' ? field('API Key 请求头 *', input('apiKeyHeader', c.apiKeyHeader, 'placeholder="X-API-Key"')) : ''}
  </div><details class="ai-advanced"><summary>高级连接配置</summary><div class="ai-form-grid">
    ${field('超时（秒）', input('timeout', c.timeout, 'type="number" min="5" max="120"'))}
    ${field('分页方式', select('pageMode', [['cursor','游标分页'],['page','页码分页'],['none','不分页']], c.pageMode))}
  </div></details><div class="ai-connect-test">${UI.btn(editor.testing ? '检查中…' : '测试连通', {onclick:'App.pcTest()', disabled:editor.testing})}
  <div>${editor.testResult ? `<span class="ai-test-ok">✓ 配置检查通过 · 演示目录 ${editor.testResult.count} 项资产</span>` : '<span class="muted">配置检查后继续字段映射</span>'}</div></div>
  <p class="ai-help">当前使用演示目录，测试连通不会发送真实请求。平台读取凭据与资产调用凭据分别配置。</p>`;
}
function mappingForm(c) {
  const sample = Connection.connectionRecords(c)[0];
  return `<h2 class="pc-section-title">字段映射</h2>${field('响应列表路径 *', input('listPath', c.listPath), '从响应对象定位资产列表，例如 data.items')}
  <div class="ai-mapping-head"><span>平台字段</span><span>企业来源字段</span><span>样本值</span></div>
  ${Object.keys(Connection.DEFAULT_MAPPING).map(key => `<div class="ai-mapping-row"><strong>${e(Connection.MAPPING_LABELS[key])} *</strong><select id="pc-map-${key}" aria-label="${e(Connection.MAPPING_LABELS[key])}来源字段" onchange="App.pcMapField('${key}',this.value)">${options([['','请选择'],...Connection.SOURCE_FIELDS.map(value => [value,value])],c.mapping[key])}</select><code title="${e(sample?.[c.mapping[key]] ?? '')}">${e(sample?.[c.mapping[key]] ?? '—')}</code></div>`).join('')}`;
}
function scopeForm(c) {
  const rows = Connection.filteredSourceRows(c), selected = new Set(c.selectedIds ?? rows.map(row => row.id));
  const records = Connection.connectionRecords(c), environments = [...new Set(records.map(row => row.environment))], departments = [...new Set(records.map(row => row.department))];
  return `<h2 class="pc-section-title">选择同步范围</h2><div class="ai-scope-filters"><span>资产类型</span>${['model','agent'].map(kind => `<label><input type="checkbox" ${c.kinds.includes(kind)?'checked':''} onchange="App.pcScopeKind('${kind}',this.checked)"> ${kindLabel(kind)}</label>`).join('')}
    <select aria-label="环境" onchange="App.pcScopeFilter('environment',this.value)">${options([['全部','全部环境'],...environments.map(value=>[value,value])],c.environment)}</select>
    <select aria-label="部门" onchange="App.pcScopeFilter('department',this.value)">${options([['全部','全部部门'],...departments.map(value=>[value,value])],c.department)}</select></div>
    <div class="ai-scope-count">${UI.linkBtn('选择当前范围',{onclick:'App.pcScopeAll(true)'})}${UI.linkBtn('清空',{onclick:'App.pcScopeAll(false)'})}<span>已选 ${rows.filter(row=>selected.has(row.id)).length} / ${rows.length} 项</span></div>
    ${UI.table([
      {title:'选择',width:'44px',render:row=>`<input type="checkbox" aria-label="纳入 ${e(row.name)}" ${selected.has(row.id)?'checked':''} onchange="App.pcScopeSelect(${quote(row.id)},this.checked)">`},
      {title:'资产',render:row=>e(row.name)}, {title:'类型',render:row=>kindLabel(row.kind)},
      {title:'企业版本',render:row=>e(row.version)}, {title:'企业状态',render:row=>e(row[c.mapping.status])},
      {title:'环境 / 部门',render:row=>e(row.environment+' / '+row.department)},
    ],rows,'当前范围没有可同步的资产。')}`;
}
function rulesForm(c) {
  return `<h2 class="pc-section-title">设置同步规则</h2><div class="ai-form-grid">
    ${field('增量同步间隔',select('interval',[[5,'每 5 分钟'],[15,'每 15 分钟'],[30,'每 30 分钟'],[60,'每小时'],[360,'每 6 小时']],c.interval))}
    ${field('完整核对频率',select('reconcile',[['每日','每日'],['每周','每周']],c.reconcile))}
    </div><div class="ai-rule-options">${[['autoInclude','自动纳入当前范围内的新资产'],['notifyChanges','资产变化时发送消息提醒'],['webhook','接收资产变化 Webhook']].map(([key,title])=>`<label><input id="pc-${key}" type="checkbox" ${c[key]?'checked':''} onchange="App.pcField('${key}',this.checked)"><span>${title}</span></label>`).join('')}</div>`;
}
function previewForm(c) {
  const rows = Connection.previewConnection(c), bad = rows.filter(row => row.errors.length).length;
  return `<h2 class="pc-section-title">核对映射结果与同步变更</h2><div class="pc-connection-summary">${UI.kvTable([
    ['连接平台',e(c.name)], ['API 与资源路径',e(c.baseUrl.replace(/\/+$/,'')+c.resourcePath)],
    ['同步范围',e(c.kinds.map(kindLabel).join('、')+' · '+c.environment+' · '+c.department)],
    ['同步规则',e(`每 ${c.interval} 分钟增量 · ${c.reconcile}完整核对`)],
  ])}</div><div class="ai-preview-summary">${UI.badge(`${rows.length} 项资产`,'blue')}${bad?UI.badge(`${bad} 项需修正`,'red'):UI.badge('映射校验通过','green')}</div>
  ${UI.table([
    {title:'资产 / 企业 ID',render:row=>`<strong>${e(row.raw.name||row.sourceId)}</strong><div class="ai-subtext">${e(row.raw.sourceRecordId)}</div>`},
    {title:'类型 / 企业状态',render:row=>e(kindLabel(row.raw.kind)+' · '+row.raw.sourceStatus)},
    {title:'处理方式',render:row=>UI.badge(row.errors.length?'校验失败':row.operation,row.errors.length?'red':row.operation==='内容未变'?'gray':'blue')},
    {title:'变化 / 校验',render:row=>row.errors.length?`<span class="ai-error">${e(row.errors.join('；'))}</span>`:row.changes.length?row.changes.map(change=>`${e(change.field)}：${e(change.before)} → ${e(change.after)}`).join('<br>'):'配置通过'},
  ],rows,'尚未选择可同步资产。')}`;
}
export function platformConnectionPage(cur = router.state()) {
  const state = begin(cur);
  if (!state) return UI.pageHead('平台连接不存在',{back:back()})+'<div class="empty">连接已删除或链接无效。</div>';
  const body = [connectionForm,mappingForm,scopeForm,rulesForm,previewForm][state.step](state.form);
  const primary = state.step === 4 ? UI.btn(state.saving?'同步中…':'保存并同步',{kind:'primary',onclick:'App.pcSave(true)',disabled:state.testing||state.saving}) : UI.btn('下一步',{kind:'primary',onclick:'App.pcNext()',disabled:state.testing||state.saving});
  return `<div class="pc-page">${UI.pageHead(state.form.id?'编辑平台连接':'连接资产平台',{back:back()})}
    <section class="pc-workspace"><ol class="ai-wizard-steps">${STEPS.map((title,index)=>`<li class="${index===state.step?'active':index<state.step?'done':''}" ${index===state.step?'aria-current="step"':''}><span>${index<state.step?'✓':index+1}</span>${title}</li>`).join('')}</ol>
    <div class="ai-wizard-content ai-form">${body}<p id="pc-error" class="ai-error" role="alert">${e(state.error)}</p></div>
    <footer class="pc-footer"><div>${UI.btn('取消',{onclick:'App.pcCancel()',disabled:state.saving})}</div><div>${state.step?UI.btn('上一步',{onclick:'App.pcPrev()',disabled:state.testing||state.saving}):''}${state.step===4?UI.btn('仅保存连接',{onclick:'App.pcSave(false)',disabled:state.testing||state.saving}):''}${primary}</div></footer></section></div>`;
}

router.beforeNavigate(transition => {
  if (!ROUTES.includes(transition.from.sub) || !editor) return;
  if (!editor.dirty) { editor = null; return; }
  pendingNavigation = transition;
  UI.modal('连接配置尚未保存','<p>离开将放弃本次修改。</p>',UI.btn('继续编辑',{onclick:'App.pcStay()'})+UI.btn('放弃修改并离开',{onclick:'App.pcDiscard()'}));
  return false;
});

export const actions = {
  pcField(key,value) {
    if (!editor || !Object.hasOwn(editor.form,key) || ['id','mapping','selectedIds'].includes(key)) return;
    editor.form[key] = ['timeout','interval'].includes(key) ? Number(value) : value; changed();
    if (['name','connector','baseUrl','resourcePath','authType','credential','credentialRef','apiKeyHeader','timeout','pageMode'].includes(key)) editor.testResult = null;
    if (['authType','connector','reconcile'].includes(key)) refresh();
  },
  pcMapField(key,value) { if (!Object.hasOwn(Connection.DEFAULT_MAPPING,key)) return; editor.form.mapping[key] = value; changed(); refresh(); },
  pcScopeKind(kind,checked) { editor.form.kinds = checked ? [...new Set([...editor.form.kinds,kind])] : editor.form.kinds.filter(value=>value!==kind); changed(); refresh(); },
  pcScopeFilter(key,value) { if (!['environment','department'].includes(key)) return; editor.form[key] = value; changed(); refresh(); },
  pcScopeSelect(id,checked) { const ids = new Set(editor.form.selectedIds ?? Connection.connectionRecords(editor.form).map(row=>row.id)); checked?ids.add(id):ids.delete(id); editor.form.selectedIds = [...ids]; changed(); refresh(); },
  pcScopeAll(checked) { editor.form.selectedIds = checked ? Connection.filteredSourceRows(editor.form).map(row=>row.id) : []; changed(); refresh(); },
  async pcTest() {
    if (editor.testing) return;
    const current = editor; current.testing = true; current.error = ''; refresh();
    try { current.testResult = await Connection.testConnection(current.form); }
    catch (error) { current.error = error.message; current.testResult = null; }
    finally { current.testing = false; if (editor === current) refresh(); }
  },
  pcPrev() { editor.step = Math.max(0,editor.step-1); editor.error = ''; refreshStep(); },
  pcNext() {
    try {
      if (editor.step === 0 && !editor.testResult) throw Error('请先测试连通并确认配置检查通过');
      const errors = Connection.connectionErrors(editor.form,{mapping:editor.step>=1,scope:editor.step>=2,rules:editor.step>=3});
      if (errors.length) throw Error(errors.join('；'));
      editor.step = Math.min(4,editor.step+1); editor.error = ''; refreshStep();
    } catch (error) { showError(error); }
  },
  pcSave(sync = false) {
    if (editor.saving) return;
    try {
      const errors = Connection.connectionErrors(editor.form,{mapping:true,scope:true,rules:true});
      if (errors.length) throw Error(errors.join('；'));
      if (!editor.testResult) throw Error('连接配置已变化，请返回第一步重新测试连通');
      const preview = Connection.previewConnection(editor.form);
      if (preview.some(row=>row.errors.length)) throw Error('预览存在无效资产，请修正映射后保存');
      const saved = savePlatformConnection({...editor.form,endpoint:editor.form.baseUrl});
      editor.form = Connection.newConnectionDraft(saved); editor.dirty = false;
      let result = null;
      if (sync) result = Connection.syncPlatformConnection(saved.id);
      editor = null; router.nav('platform','intake');
      UI.toast(result?`连接已保存，已同步 ${result.imported.length} 项演示资产`:'平台连接已保存');
    } catch (error) { showError(error); }
  },
  pcCancel() { router.nav('platform','intake'); },
  pcStay() { pendingNavigation = null; UI.closeModal(); },
  pcDiscard() { const transition = pendingNavigation; pendingNavigation = null; editor = null; UI.closeModal(); transition?.proceed(); },
};
