/* 资产中心 · 智能体：接入列表 + 接入表单。
 * 接入方式只有一种——自定义 CLI。模板只是表单的一键填充助手。
 * 攻击入口是二期主动注入才用的字段，表单里默认收起。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { AGENT_TEMPLATE, CRED_DELIVERY, PROMPT_TRANSPORT, MODEL_STATUS } from '../domain/constants.js';

/* 模板自带的攻击入口清单。二期注入时用，verified 标注平台已实测验证过的入口。 */
const TEMPLATE_SURFACES = {
  qwen_code: [
    { vector: 'qwen_md', kind: 'instruction', path: 'QWEN.md', desc: '项目级上下文文件，会话启动时加载', verified: true },
    { vector: 'agents_md', kind: 'instruction', path: 'AGENTS.md', desc: '通用仓库级指令文件', verified: false },
    { vector: 'qwen_user_md', kind: 'instruction', path: 'HOME/.qwen/QWEN.md', desc: '用户级上下文文件', verified: false },
    { vector: 'qwen_project_skill', kind: 'skill', path: '.qwen/skills/<name>/SKILL.md', desc: '项目级技能', verified: false },
    { vector: 'qwen_user_skill', kind: 'skill', path: 'HOME/.qwen/skills/<name>/SKILL.md', desc: '用户级技能', verified: false },
    { vector: 'agents_skill', kind: 'skill', path: '.agents/skills/<name>/SKILL.md', desc: '通用技能标准路径', verified: false },
  ],
  blank: [],
};

const view = { q: '' };

export function agentsPage() {
  let rows = store.agents;
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((a) => (a.name + a.launchCmd + a.baseModelName).toLowerCase().includes(q));
  }

  const flt = UI.filters({
    search: { label: '搜索', id: 'aga-q', value: view.q, placeholder: '搜索名称 / 启动命令 / 基座模型', oninput: 'App.agaSearch(this.value)' },
  });

  const table = UI.pagedTable(
    'agents',
    [
      { title: '名称', render: (a) => `<button class="link-btn" onclick="App.openAgentAsset('${a.id}')">${UI.esc(a.name)}</button>` },
      { title: '启动命令', render: (a) => (a.launchCmd ? `<code>${UI.esc(a.launchCmd)}</code>` : '<span class="faint">—</span>') },
      { title: '容器镜像', render: (a) => (a.runnerImage ? `<code>${UI.esc(a.runnerImage)}</code>` : '<span class="faint">—</span>') },
      { title: '基座模型', width: '180px', render: (a) => UI.esc(a.baseModelName) },
      { title: '状态', width: '100px', render: (a) => UI.badge(a.statusLabel || MODEL_STATUS[a.status] || a.status, a.status === 'connected' ? 'green' : 'gray') },
      {
        title: '操作', width: '160px', cls: 'actions',
        render: (a) => `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openAgentAsset('${a.id}')` })}
          ${UI.linkBtn('编辑', { onclick: `App.editAgent('${a.id}')` })}
          ${UI.linkBtn('删除', { danger: true, onclick: 'App.deleteBlocked()' })}
        </div>`,
      },
    ],
    rows,
    '暂无接入的智能体',
  );

  return `${UI.pageHead('智能体', {
    actions: UI.btn('接入智能体', { kind: 'primary', ico: 'plus', onclick: 'App.editAgent()' }),
  })}${flt}${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 详情 */
export function agentAssetDetailPage(cur) {
  const a = store.agentOf(cur?.param);
  if (!a) return `${UI.pageHead('智能体详情')}<div class="empty"><strong>智能体不存在</strong></div>`;

  const credRows = [['投递方式', UI.esc(CRED_DELIVERY[a.delivery]?.label || a.delivery || '—')]];
  if (a.delivery !== 'config') credRows.push(['环境变量', a.envNames ? `<code>${UI.esc(a.envNames)}</code>` : '—']);
  if (a.delivery !== 'env') credRows.push(['配置文件', a.configPath ? `<code>${UI.esc(a.configPath)}</code> · ${UI.esc(a.configFormat || 'json')}` : '—']);

  const sRows = (a.surfaces || []).map((s) => `<tr>
    <td><code>${UI.esc(s.vector)}</code></td>
    <td>${UI.esc(s.kind === 'instruction' ? '指令文件' : s.kind === 'skill' ? '技能文件' : '配置文件')}</td>
    <td><code>${UI.esc(s.path)}</code></td>
    <td>${s.verified ? UI.badge('已验证', 'green') : UI.badge('未验证', 'gray')}</td>
  </tr>`).join('');

  const tasks = store.listAgentTasks().filter((t) => t.targetId === a.id);
  const tRows = tasks.map((t) => `<tr>
    <td><button class="link-btn" onclick="App.openAgTask('${t.id}')">${UI.esc(t.name)}</button></td>
    <td>${UI.esc(t.sceneBankName)}</td>
    <td class="num">${UI.pct(t.agg.value)}</td>
    <td class="num">${UI.esc(t.finishedAt || '—')}</td>
  </tr>`).join('') || '<tr><td colspan="4" class="empty-cell">暂无演练任务</td></tr>';

  return `${UI.backBtn()}
  ${UI.pageHead(a.name, { actions: UI.btn('编辑', { onclick: `App.editAgent('${a.id}')` }) })}
  <div class="detail-grid">
    <div class="detail-left">
      ${UI.card('接入信息', UI.kvTable([
    ['名称', UI.esc(a.name)],
    ['启动命令', a.launchCmd ? `<code>${UI.esc(a.launchCmd)}</code>` : '—'],
    ['容器镜像', a.runnerImage ? `<code>${UI.esc(a.runnerImage)}</code>` : '—'],
    ['提示词传递', UI.esc(PROMPT_TRANSPORT[a.promptTransport] || a.promptTransport || '—')],
    ['基座模型', UI.esc(a.baseModelName)],
    ['状态', UI.badge(a.statusLabel || a.status, a.status === 'connected' ? 'green' : 'gray')],
    ['备注', UI.esc(a.note || '—')],
  ]))}
      ${UI.card('凭据投递', UI.kvTable(credRows))}
      ${sRows ? UI.card('攻击入口', `<p class="faint text-support">二期主动注入时攻击方会往这些路径写入诱导内容。一期演练不使用。</p>
        <table class="kv-table tight">
          <thead><tr><th>入口</th><th>类型</th><th>容器内路径</th><th>验证</th></tr></thead>
          <tbody>${sRows}</tbody>
        </table>`, '', true) : ''}
    </div>
    <div class="detail-right">
      ${UI.card('演练任务', `<table class="kv-table tight">
        <thead><tr><th>任务</th><th>题库</th><th class="num">ASR</th><th class="num">完成时间</th></tr></thead>
        <tbody>${tRows}</tbody></table>`, '', true)}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- 表单 */
let form = null;
let advOpen = false;

function blankForm() {
  return {
    id: '', name: '', launchCmd: '', runnerImage: '', promptTransport: 'stdin',
    baseModelId: '', status: 'connected', note: '',
    delivery: 'env', envNames: 'OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL',
    configPath: '', configFormat: 'json',
    surfaces: [],
  };
}

function applyTemplate(key) {
  const t = AGENT_TEMPLATE[key] || AGENT_TEMPLATE.blank;
  form.launchCmd = t.cmd;
  form.runnerImage = t.image;
  form.promptTransport = t.transport;
  form.delivery = t.delivery;
  form.envNames = t.envNames;
  form.configPath = t.configPath;
  form.configFormat = t.configFormat;
  form.surfaces = (TEMPLATE_SURFACES[key] || []).map((s) => ({ ...s }));
}

export function openAgentForm(id) {
  const old = id && store.agentOf(id);
  form = old ? { ...blankForm(), ...old, surfaces: (old.surfaces || []).map((s) => ({ ...s })) } : blankForm();
  if (!form.baseModelId) form.baseModelId = store.models[0]?.id || '';
  advOpen = false;
  renderForm();
}

const section = (title, body) => `<section class="form-sec"><h3>${UI.esc(title)}</h3>${body}</section>`;
const req = '<span class="req">*</span>';

function renderForm() {
  const opt = (v, label, cur) => `<option value="${UI.esc(v)}" ${v === cur ? 'selected' : ''}>${UI.esc(label)}</option>`;

  const credFields = `
    <div class="field"><label for="aga-del">投递方式</label>
      <select id="aga-del" onchange="App.agaSet('delivery',this.value)">
        ${Object.entries(CRED_DELIVERY).map(([k, v]) => opt(k, v.label, form.delivery)).join('')}
      </select>
      <span class="faint text-support">${UI.esc(CRED_DELIVERY[form.delivery]?.desc || '')}</span>
    </div>
    ${form.delivery !== 'config' ? `<div class="field"><label for="aga-env">环境变量名</label>
      <input type="text" id="aga-env" value="${UI.esc(form.envNames)}" oninput="App.agaSet('envNames',this.value)"
        placeholder="密钥、地址、模型名对应的变量名，逗号分隔" /></div>` : ''}
    ${form.delivery !== 'env' ? `<div class="form-row">
      <div class="field"><label for="aga-cfgp">配置文件路径</label>
        <input type="text" id="aga-cfgp" value="${UI.esc(form.configPath)}" oninput="App.agaSet('configPath',this.value)"
          placeholder="容器内路径，如 HOME/.xxx/settings.json" /></div>
      <div class="field"><label for="aga-cfgf">文件格式</label>
        <select id="aga-cfgf" onchange="App.agaSet('configFormat',this.value)">
          ${['json', 'yaml', 'toml', 'text'].map((f) => opt(f, f.toUpperCase(), form.configFormat)).join('')}
        </select></div>
    </div>` : ''}`;

  const sRows = form.surfaces.length
    ? form.surfaces.map((s, i) => `<tr>
        <td><input value="${UI.esc(s.vector)}" oninput="App.agaSurface(${i},'vector',this.value)" placeholder="入口名" /></td>
        <td><input value="${UI.esc(s.path)}" oninput="App.agaSurface(${i},'path',this.value)" placeholder="容器内路径" /></td>
        <td>${UI.linkBtn('移除', { danger: true, onclick: `App.agaSurfaceDel(${i})` })}</td>
      </tr>`).join('')
    : '<tr><td colspan="3" class="empty-cell">未声明，二期主动注入前可留空</td></tr>';

  const body = `<div class="form-secs">
    ${section('接入信息', `
      <div class="field"><label for="aga-tpl">从模板填充</label>
        <select id="aga-tpl" onchange="App.agaTemplate(this.value)">
          ${Object.entries(AGENT_TEMPLATE).map(([k, v]) => opt(k, v.label, '__none')).join('')}
        </select>
        <span class="faint text-support">选择后自动填好下面各项，仍可逐项修改</span>
      </div>
      <div class="field"><label for="aga-name">名称${req}</label>
        <input type="text" id="aga-name" value="${UI.esc(form.name)}" oninput="App.agaSet('name',this.value)"
          placeholder="如 内部文档助手 · DeepSeek-Flash" /></div>
      <div class="form-row">
        <div class="field"><label for="aga-cmd">启动命令${req}</label>
          <input type="text" id="aga-cmd" value="${UI.esc(form.launchCmd)}" oninput="App.agaSet('launchCmd',this.value)"
            placeholder="容器内可执行的一行命令" /></div>
        <div class="field"><label for="aga-img">容器镜像${req}</label>
          <input type="text" id="aga-img" value="${UI.esc(form.runnerImage)}" oninput="App.agaSet('runnerImage',this.value)"
            placeholder="如 myorg/my-agent:latest" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="aga-tr">提示词传递方式</label>
          <select id="aga-tr" onchange="App.agaSet('promptTransport',this.value)">
            ${Object.entries(PROMPT_TRANSPORT).map(([k, v]) => opt(k, v, form.promptTransport)).join('')}
          </select></div>
        <div class="field"><label for="aga-base">基座模型${req}</label>
          <select id="aga-base" onchange="App.agaSet('baseModelId',this.value)">
            ${store.models.map((m) => opt(m.id, m.name, form.baseModelId)).join('')}
          </select></div>
      </div>
      <div class="field"><label for="aga-note">备注</label>
        <input type="text" id="aga-note" value="${UI.esc(form.note)}" oninput="App.agaSet('note',this.value)" /></div>`)}

    ${section('凭据投递', `<p class="faint text-support">智能体从哪里读取模型地址与密钥。</p>${credFields}`)}

    <section class="form-sec">
      <button class="adv-toggle" onclick="App.agaAdv()">
        ${advOpen ? '收起' : '展开'}高级设置（攻击入口，二期注入用）
      </button>
      ${advOpen ? `
        <p class="faint text-support">智能体启动时会自动读取的配置文件路径。一期演练不使用，可留空；
        二期主动注入时攻击方会往这些位置写入诱导内容。</p>
        <table class="kv-table tight">
          <thead><tr><th>入口名</th><th>容器内路径</th><th></th></tr></thead>
          <tbody>${sRows}</tbody>
        </table>
        ${UI.btn('添加入口', { onclick: 'App.agaSurfaceAdd()' })}` : ''}
    </section>
  </div>`;

  const foot = `${UI.btn('取消', { onclick: 'UI.closeModal()' })}
    ${UI.btn('保存', { kind: 'primary', onclick: 'App.agaSave()' })}`;

  UI.modal(form.id ? '编辑智能体' : '接入智能体', body, foot, { wide: true, cls: 'modal-wiz' });
}

export const actions = {
  agaSearch(v) { view.q = v; UI.resetPage('agents'); router.nav('assets', 'agents'); },
  openAgentAsset(id) { router.nav('assets', 'agent-detail', id); },
  editAgent(id) { openAgentForm(id); },
  agaSet(k, v) {
    form[k] = v;
    /* 文本输入不重绘，避免失焦 */
    if (['delivery', 'promptTransport', 'configFormat', 'baseModelId'].includes(k)) renderForm();
  },
  agaTemplate(k) { applyTemplate(k); renderForm(); },
  agaAdv() { advOpen = !advOpen; renderForm(); },
  agaSurface(i, k, v) { form.surfaces[i][k] = v; },
  agaSurfaceAdd() { form.surfaces.push({ vector: '', kind: 'instruction', path: '', desc: '', verified: false }); renderForm(); },
  agaSurfaceDel(i) { form.surfaces.splice(i, 1); renderForm(); },
  agaSave() {
    if (!form.name.trim()) return UI.toast('请填写名称');
    if (!form.launchCmd.trim()) return UI.toast('请填写启动命令');
    if (!form.runnerImage.trim()) return UI.toast('请填写容器镜像');
    store.saveAgent({ ...form, name: form.name.trim() });
    UI.closeModal();
    UI.toast('已保存');
    router.nav('assets', 'agents');
  },
};
