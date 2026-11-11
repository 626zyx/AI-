/* 资产中心：模型。只管「接入」：平台能连到哪些模型。角色在平台管理里配。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { MODEL_STATUS, API_TYPE } from '../domain/constants.js';

const FILTERS = { q: '', status: 'all' };
/* 弹窗表单：新增与编辑共用。tested 记录当前填写是否已测试通过 */
let form = null;

export function modelsPage() {
  let rows = store.models;
  if (FILTERS.status !== 'all') rows = rows.filter((m) => m.status === FILTERS.status);
  if (FILTERS.q.trim()) {
    const q = FILTERS.q.trim().toLowerCase();
    rows = rows.filter((m) => (m.name + m.vendor + m.apiModel).toLowerCase().includes(q));
  }
  const flt = UI.filters({
    search: { label: '搜索', id: 'as-q', value: FILTERS.q, placeholder: '搜索模型名称或厂商', oninput: 'App.asSearch(this.value)' },
    selects: [{
      label: '状态', id: 'as-status', value: FILTERS.status, onchange: 'App.asFilter("status",this.value)',
      options: [['all', '全部状态'], ...Object.entries(MODEL_STATUS)],
    }],
  });
  const table = UI.pagedTable(
    'models',
    [
      { title: '模型名称', render: (m) => UI.esc(m.name) },
      { title: '厂商', width: '120px', render: (m) => UI.esc(m.vendor) },
      { title: '请求模型标识', width: '160px', render: (m) => UI.esc(m.apiModel) },
      { title: '接入地址', render: (m) => UI.esc(m.baseUrl) },
      { title: '状态', width: '100px', render: (m) => statusBadge(m) },
      {
        title: '操作', width: '110px', cls: 'actions',
        render: (m) => `<div class="row-actions">${UI.linkBtn('编辑', { onclick: `App.modelForm('${m.id}')` })}${UI.linkBtn('删除', { danger: true, onclick: `App.delModel('${m.id}')` })}</div>`,
      },
    ],
    rows,
    '暂无模型',
  );
  return `${UI.pageHead('模型', { actions: UI.btn('配置模型用途', { onclick: "App.go('platform','roles')" }) + UI.btn('接入模型', { kind: 'primary', ico: 'plus', onclick: 'App.modelForm()' }) })}
  ${flt}
  ${UI.card('', table, '', true)}`;
}

function statusBadge(m) {
  const tone = m.status === 'connected' ? 'green' : m.status === 'error' ? 'red' : 'gray';
  return UI.badge(MODEL_STATUS[m.status] || m.status, tone);
}

const req = '<span class="req">*</span>';
function renderForm() {
  const f = form;
  const opt = (v, l, cur, dis) => `<option value="${v}" ${v === cur ? 'selected' : ''} ${dis ? 'disabled' : ''}>${UI.esc(l)}</option>`;
  const testLine = f.test === 'ok' ? '<span style="color:var(--vd-safe)">连接成功</span>'
    : f.test === 'fail' ? '<span class="text-danger">连接失败，请检查地址与 Key</span>'
    : f.test === 'run' ? '<span class="muted">测试中…</span>' : '';
  const body = `<div class="form-secs">
    <div class="form-row">
      <div class="field"><label for="mf-name">模型名称${req}</label>
        <input type="text" id="mf-name" value="${UI.esc(f.name)}" placeholder="平台内显示，如 DeepSeek-V3" oninput="App.mfField('name',this.value)" />
        <span class="faint text-support">只用于平台内展示和筛选。</span></div>
      <div class="field"><label for="mf-model">请求模型标识（model）${req}</label>
        <input type="text" id="mf-model" value="${UI.esc(f.apiModel)}" placeholder="如 deepseek-chat、qwen-flash" oninput="App.mfField('apiModel',this.value)" />
        <span class="faint text-support">请求体里的 model 字段，以服务方文档为准。</span></div>
    </div>
    <div class="field"><label for="mf-url">API 地址（Base URL）${req}</label>
      <input type="text" id="mf-url" value="${UI.esc(f.baseUrl)}" placeholder="https://api.example.com/v1" oninput="App.mfField('baseUrl',this.value)" />
      <span class="faint text-support">云端模型填服务方地址；自部署模型填推理服务（如 vLLM、Ollama）暴露的 OpenAI 兼容地址。</span></div>
    <div class="form-row">
      <div class="field"><label for="mf-type">接口类型</label>
        <select id="mf-type" onchange="App.mfField('apiType',this.value)">${API_TYPE.map((t) => opt(t.id, t.label, f.apiType, !t.ok)).join('')}</select></div>
      <div class="field"><label for="mf-auth">鉴权方式</label>
        <select id="mf-auth" onchange="App.mfField('auth',this.value,true)">${opt('key', 'API Key', f.auth)}${opt('none', '无鉴权（内网部署）', f.auth)}</select></div>
    </div>
    ${f.auth === 'key' ? `<div class="field"><label for="mf-key">API Key${f.id ? '' : req}</label>
      <input id="mf-key" type="password" value="${UI.esc(f.apiKey)}" placeholder="${f.id ? '已保存，留空则不修改' : '填写 API Key'}" oninput="App.mfField('apiKey',this.value)" /></div>` : ''}
    <span class="faint text-support">测试会向该地址发送一次最小请求。首次接入须测试通过。</span>
    <div id="mf-test">${testLine}</div>
  </div>`;
  const foot = `<div style="margin-right:auto">${UI.btn('测试连接', { onclick: 'App.mfTest()' })}</div>
    ${UI.btn('取消', { onclick: 'UI.closeModal()' })}
    ${UI.btn(f.id ? '保存' : '接入模型', { kind: 'primary', onclick: 'App.mfSave()', disabled: !f.id && f.test !== 'ok' })}`;
  UI.modal(f.id ? '编辑模型' : '接入模型', body, foot);
}

export const actions = {
  asSearch(v) { FILTERS.q = v; UI.resetPage('models'); router.nav('assets', 'models'); },
  asFilter(k, v) { FILTERS[k] = v; UI.resetPage('models'); router.nav('assets', 'models'); },
  modelForm(id = null) {
    const m = id && store.models.find((x) => x.id === id);
    form = m
      ? { id: m.id, name: m.name, apiModel: m.apiModel, baseUrl: m.baseUrl, apiType: m.apiType, auth: m.auth || 'key', apiKey: '', status: m.status, test: '' }
      : { id: null, name: '', apiModel: '', baseUrl: '', apiType: 'openai', auth: 'key', apiKey: '', status: 'planned', test: '' };
    renderForm();
  },
  /* 改动填写后，之前的测试结果失效；只在需要时重绘，避免输入框失焦 */
  mfField(k, v, rerender = false) {
    form[k] = v;
    const stale = form.test && k !== 'auth';
    if (stale) form.test = '';
    if (rerender || stale) {
      const id = document.activeElement?.id;
      renderForm();
      const el = id && document.getElementById(id);
      if (el && el.tagName === 'INPUT') { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  },
  mfTest() {
    const f = form;
    if (!f.name.trim() || !f.apiModel.trim() || !/^https?:\/\/\S+$/.test(f.baseUrl.trim())) return UI.toast('请填写模型名称、请求模型标识和正确的 API 地址');
    if (f.auth === 'key' && !f.id && !f.apiKey.trim()) return UI.toast('请填写 API Key');
    f.test = 'run'; renderForm();
    /* demo：不发真实请求，地址形如 http(s)://host 即视为连通 */
    setTimeout(() => { if (form !== f) return; f.test = 'ok'; f.status = 'connected'; renderForm(); }, 600);
  },
  mfSave() {
    const f = form;
    if (!f.name.trim() || !f.apiModel.trim() || !f.baseUrl.trim()) return UI.toast('请填写必填项');
    if (!f.id && f.test !== 'ok') return UI.toast('首次接入须测试连接通过');
    const old = f.id && store.models.find((x) => x.id === f.id);
    store.saveModel({ ...old, id: f.id, name: f.name.trim(), apiModel: f.apiModel.trim(), baseUrl: f.baseUrl.trim(), apiType: f.apiType, auth: f.auth, status: f.test === 'ok' ? 'connected' : f.status });
    UI.closeModal();
    UI.toast(f.id ? '已保存' : '已接入，可在模型管理中配置平台用途');
    router.nav('assets', 'models');
  },
  delModel(id) {
    const m = store.models.find((x) => x.id === id);
    if (!m) return;
    const roleTip = m.roles.length ? `该模型在模型管理中配置了「${m.roles.join('、')}」用途，删除后需重新配置。` : '';
    UI.modal('删除模型', `<p>确定删除「${UI.esc(m.name)}」？${roleTip}已完成任务的结果不受影响。</p>`,
      `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('删除', { kind: 'danger', onclick: `App.delModelOk('${id}')` })}`);
  },
  delModelOk(id) { store.deleteModel(id); UI.closeModal(); UI.toast('已删除'); router.nav('assets', 'models'); },
};
