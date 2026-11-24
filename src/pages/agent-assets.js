/* User-delivered Agent images. Runtime and declared surfaces are verified by the integration service. */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { CONFIGURE_MODEL_VALUE, configureMoreModels } from '../core/model-config-navigation.js';
import { openResourcePicker, listPickerResources } from '../core/resource-picker.js';
import { usableTaskModel } from '../domain/agent-configuration.js';
import { validateAgentSubmission } from '../domain/agent-onboarding.js';
import { SURFACE_GROUPS, SURFACE_TYPES, surfaceTypeId, surfaceTypeOf, surfaceTypeLabel, surfaceGroupOf, surfaceTypeValue } from '../domain/attack-surfaces.js';
import { detailContent, detailBlock, detailFields, detailTableField, openConfigDetail } from '../core/config-detail.js';

const view = { q: '' };
const statusLabel = status => ({ connected: '已接入', planned: '待验证', error: '验证失败' })[status] || status;
const statusBadge = agent => UI.badge(statusLabel(agent.status), agent.status === 'connected' ? 'green' : agent.status === 'error' ? 'red' : 'gray');
const baseModels = () => listPickerResources('model').filter(usableTaskModel);
const opt = (value, label, current) => `<option value="${UI.esc(value)}"${value === current ? ' selected' : ''}>${UI.esc(label)}</option>`;
const surfaceGroupLabel = surface => surfaceGroupOf(surface)?.label || '—';
let form = null;

export function agentsPage() {
  const rows = store.agents.filter(agent => `${agent.name} ${agent.baseModelName}`.toLowerCase().includes(view.q.trim().toLowerCase()));
  return `${UI.pageHead('智能体', { actions: UI.btn('接入智能体', { kind: 'primary', ico: 'plus', onclick: 'App.editAgent()' }) })}
    ${UI.filters({ search: { label: '搜索', id: 'aga-q', value: view.q, placeholder: '搜索智能体名称或基座模型', oninput: 'App.agaSearch(this.value)' } })}
    ${UI.card('', UI.pagedTable('agents', [
      { title: '智能体名称', render: agent => UI.linkBtn(agent.name, { onclick: `App.openAgentAsset('${agent.id}')` }) },
      { title: '镜像', render: agent => `<span class="ag-image-ref">${UI.esc(agent.image || '—')}</span>` },
      { title: '基座模型', render: agent => UI.esc(agent.baseModelName) },
      { title: '状态', width: '100px', render: statusBadge },
      { title: '操作', width: '150px', cls: 'actions', render: agent => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openAgentAsset('${agent.id}')` })}${UI.linkBtn('编辑', { onclick: `App.editAgent('${agent.id}')`, disabled: agent.status === 'connected' })}${UI.linkBtn('删除', { danger: true, onclick: `App.agaDelete('${agent.id}')` })}</div>` },
    ], rows, '暂无接入的智能体'), '', true)}`;
}

function agentDrawer(agent) {
  const declared = agent.surfaceDeclarations || [], verified = agent.surfaces || [];
  return detailContent(detailBlock('基础信息', detailFields([
    ['智能体名称', agent.name], ['基座模型', agent.baseModelName],
    ['状态', statusLabel(agent.status)], ['用途说明', agent.description || agent.desc],
  ])) + detailBlock('接入信息', detailFields([
    ['镜像地址', agent.image], ['启动程序', agent.command?.[0]], ['启动参数', agent.command?.slice(1).join(' · ') || '—'],
    ['任务输入', ({ stdin: '标准输入', argv: '命令行参数', file: '任务文件' })[agent.taskInput]],
    ...(agent.taskInput !== 'stdin' ? [['任务参数名', agent.promptFlag || '位置参数']] : []),
  ])) + detailBlock('注入面文件', detailTableField('申报与核验', UI.table([
    { title: '分类', width: '150px', render: surface => `<span class="ag-surface-group">${UI.esc(surfaceGroupLabel(surface))}</span><span>${UI.esc(surfaceTypeLabel(surface))}</span>` },
    { title: '文件路径', render: surface => `<span class="ag-image-ref">${UI.esc(surface.path)}</span>` },
    { title: '状态', width: '80px', render: surface => verified.some(item => item.path === surface.path && item.verified) ? UI.badge('已核验', 'green') : UI.badge('待核验', 'gray') },
  ], declared.length ? declared : verified, '尚未申报注入面文件'))
    + `<p class="muted text-support">${UI.esc(agent.verificationNote || '文件由用户申报，平台核验后作为任务可选范围；不会仅凭镜像名称自动认定加载能力。')}</p>`));
}
export function agentAssetDetailPage(cur) {
  if (cur?.param) setTimeout(() => actions.openAgentAsset(cur.param), 0);
  return agentsPage();
}

function surfaceOptions(row) {
  const current = surfaceTypeId(row);
  return SURFACE_GROUPS.map(group => {
    const types = SURFACE_TYPES.filter(type => type.group === group.id);
    const legacy = row.kind === 'memory' && !row.subtype && types.some(type => type.kind === 'memory') ? opt(current, surfaceTypeLabel(row), current) : '';
    return `<optgroup label="${UI.esc(group.label)}">${legacy}${types.map(type => opt(type.id, type.label, current)).join('')}</optgroup>`;
  }).join('');
}
function loadingHelp(row) {
  const loading = surfaceTypeOf(row)?.loading;
  return `<p class="ag-surface-help" id="ag-surface-help-${row.index}">类别说明：${UI.esc(loading || '加载方式取决于所用 Agent，接入后按具体文件核验。')}（非当前镜像的核验结论）</p>`;
}
function declarationsHTML() {
  return `<div class="ag-surface-editor">${UI.table([
    { title: '分类', width: '216px', render: (row) => `<select aria-label="注入面 ${row.index + 1} 分类" aria-describedby="ag-surface-help-${row.index}" onchange="App.agaSurface(${row.index},'kind',this.value)">${surfaceOptions(row)}</select>` },
    { title: '具体文件路径', render: (row) => `<input aria-label="注入面 ${row.index + 1} 文件路径" value="${UI.esc(row.path || '')}" placeholder="如 AGENTS.md 或 HOME/.qwen/QWEN.md" oninput="App.agaSurface(${row.index},'path',this.value)" />${loadingHelp(row)}` },
    { title: '', width: '72px', render: (row) => UI.linkBtn('删除', { danger: true, onclick: `App.agaRemoveSurface(${row.index})` }) },
  ], form.surfaceDeclarations.map((row, index) => ({ ...row, index })), '未申报注入面文件')}${UI.linkBtn('添加文件', { onclick: 'App.agaAddSurface()' })}</div>`;
}

function renderForm({ preserveScroll = false } = {}) {
  const scrollTop = preserveScroll ? document.querySelector('.agent-onboarding-modal .modal-body')?.scrollTop || 0 : 0;
  const f = form;
  const text = (key, label, placeholder = '', multiline = false, required = false, help = '') => `<div class="field"><label for="agf-${key}">${label}${required ? ' <span class="req">*</span>' : ''}</label>${multiline
    ? `<textarea id="agf-${key}" rows="2" placeholder="${UI.esc(placeholder)}" oninput="App.agaSet('${key}',this.value)">${UI.esc(f[key] || '')}</textarea>`
    : `<input id="agf-${key}" type="text" value="${UI.esc(f[key] || '')}" placeholder="${UI.esc(placeholder)}" oninput="App.agaSet('${key}',this.value)" />`}${help ? `<p class="muted text-support">${UI.esc(help)}</p>` : ''}</div>`;
  const body = `<div class="form-secs">
    <section><h3>基本信息</h3>
      ${text('name', '智能体名称', '平台内显示的名称', false, true)}
      ${text('description', '用途说明', '例如：读取业务文档并整理客服回复', true, false, '选填，自然语言说明已有能力，用于资产识别与后续选型，不会作为任务指令。')}
      <div class="field"><label for="agf-base">基座模型 <span class="req">*</span></label><button type="button" id="agf-base" class="tw-resource-field" value="${UI.esc(f.baseModelId || '')}" onclick="App.agaPickBaseModel()"><span>${UI.esc(baseModels().find(model => model.id === f.baseModelId || model.assetId === f.baseModelId)?.displayName || baseModels().find(model => model.id === f.baseModelId || model.assetId === f.baseModelId)?.name || '请选择基座模型')}</span><span class="tw-resource-action">${f.baseModelId ? '更换' : '选择'}</span></button><p class="muted text-support">从已接入的模型资产获取地址、模型标识和凭据，无需重复填写。</p></div>
    </section>
    <section><h3>镜像与任务入口</h3>
      ${text('image', '镜像地址', 'registry.example.com/team/agent:1.0.0', false, true, '完整地址须包含版本标签或 sha256 摘要，无需另填版本；不填网页地址或压缩包路径。')}
      ${text('executable', '启动程序', '如 agent-cli 或 /app/run-agent', false, true, '填写镜像内已有的非交互程序名或路径，不在此处拼接参数。')}
      ${text('argumentsText', '启动参数', '--non-interactive\n--output-format\njson', true, false, '选填，每行一个参数或参数值，保留行内空格；无需引号，不填写任务正文或任务参数名。')}
      <div class="field"><label for="agf-input">任务文本传入方式 <span class="req">*</span></label><select id="agf-input" onchange="App.agaSet('taskInput',this.value,true)">${opt('stdin','标准输入（stdin）',f.taskInput)}${opt('argv','命令行参数（argv）',f.taskInput)}${opt('file','文本文件路径',f.taskInput)}</select><p class="muted text-support">平台读取 task.md 并补充运行说明，形成完整任务文本后传入。文件方式由平台生成 UTF-8 文件并传递路径。</p></div>
      ${f.taskInput !== 'stdin' ? text('promptFlag', f.taskInput === 'argv' ? '任务参数名' : '任务文件参数名', f.taskInput === 'argv' ? '如 -p、-n 或 --prompt' : '如 --prompt-file', false, false, '填写单个参数名；留空表示作为最后一个位置参数。平台自动追加任务文本或文件路径。') : ''}
      <p class="ag-contract-note">镜像必须读取并使用 OPENAI_BASE_URL、OPENAI_MODEL、OPENAI_API_KEY，具体值由平台从所选模型资产获取并在运行时注入。镜像开发者须在交付前完成适配，详见“使用指南 → 接入智能体 → 基座模型连接”。</p>
    </section>
    <section><h3>注入面文件</h3><p class="muted text-support">仅申报 Agent 的指令、技能、命令、规则、配置或记忆文件，不包含普通业务文件。项目内用相对路径，用户目录用 HOME/ 前缀；技能路径具体到 SKILL.md。</p>
      ${declarationsHTML()}
      <p class="muted text-support">没有文件注入能力可留空，仅用于基础安全演练。路径不是通过镜像名称推断，声明后仍需验证加载条件。</p>
    </section>
    <p class="muted text-support">镜像应包含程序及依赖，并已有接收完整任务、非交互执行后退出的入口。保存后为“待验证”。</p>
    <p id="agf-check" class="muted text-support" role="status"></p>
  </div>`;
  UI.modal(f.id ? '编辑接入信息' : '接入智能体', body, `${UI.btn('校验信息', { onclick: 'App.agaTest()' })}${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('保存接入信息', { kind: 'primary', onclick: 'App.agaSave()' })}`, { wide: true, cls: 'agent-onboarding-modal' });
  if (preserveScroll) document.querySelector('.agent-onboarding-modal .modal-body').scrollTop = scrollTop;
}
function refreshDeclarations() {
  const editor = document.querySelector('.ag-surface-editor');
  if (!editor) return;
  // Update only the rows: keep the surrounding modal, scroll position and other fields.
  const body = editor.closest('.modal-body'), scrollTop = body.scrollTop;
  editor.outerHTML = declarationsHTML();
  body.scrollTop = scrollTop;
  clearCheck();
}
const validatedForm = () => validateAgentSubmission(form, { models: store.models, existing: store.agents });
const clearCheck = () => { const check = document.getElementById('agf-check'); if (check) check.textContent = ''; };
export const actions = {
  agaSearch(value) { view.q = value; UI.resetPage('agents'); router.nav('assets', 'agents'); },
  openAgentAsset(id) { const agent = store.agentOf(id); if (agent) openConfigDetail('智能体详情', agentDrawer(agent)); },
  editAgent(id) {
    const old = id && store.agentOf(id);
    if (old?.status === 'connected') return UI.toast('已接入版本不可修改，请创建新的接入记录');
    form = { id: null, name: '', baseModelId: '', taskInput: 'stdin', ...structuredClone(old || {}), executable: old?.command?.[0] || '', argumentsText: old?.command?.slice(1).join('\n') || '', surfaceDeclarations: structuredClone(old?.surfaceDeclarations || []) };
    renderForm();
  },
  agaSet(key, value, rerender = false) {
    if (!form || !['name','baseModelId','image','executable','argumentsText','taskInput','promptFlag','description'].includes(key)) return;
    if (key === 'baseModelId' && value === CONFIGURE_MODEL_VALUE) return configureMoreModels(renderForm, '返回智能体接入');
    form[key] = value; clearCheck(); if (rerender) renderForm({ preserveScroll: true });
  },
  agaPickBaseModel() {
    if (!form) return;
    openResourcePicker({ kind: 'model', value: form.baseModelId, title: '选择基座模型', onSelect: resource => {
      if (!usableTaskModel(resource)) return UI.toast('该资源不支持本次模型调用');
      actions.agaSet('baseModelId', resource.id);
      const control = document.getElementById('agf-base');
      if (control) { control.value = resource.id; control.firstElementChild.textContent = resource.displayName || resource.name; control.lastElementChild.textContent = '更换'; }
    } });
  },
  agaSurface(index, key, value) {
    if (!form?.surfaceDeclarations[index] || !['kind','path'].includes(key)) return;
    const row = form.surfaceDeclarations[index];
    if (key === 'kind') {
      try {
        const type = surfaceTypeValue(value);
        delete row.subtype;
        Object.assign(row, type);
        refreshDeclarations();
      } catch (error) { UI.toast(error.message); }
    } else { row.path = value; clearCheck(); }
  },
  agaAddSurface() { form.surfaceDeclarations.push({ kind: 'instruction', path: '' }); refreshDeclarations(); },
  agaRemoveSurface(index) { form.surfaceDeclarations.splice(index, 1); refreshDeclarations(); },
  agaTest() {
    try { validatedForm(); document.getElementById('agf-check').textContent = '填写信息校验通过；运行能力和注入面加载条件尚待验证。'; }
    catch (error) { UI.toast(error.message); }
  },
  agaSave() {
    try { store.saveAgent({ ...validatedForm(), id: form.id }); UI.closeModal(); UI.toast('接入信息已保存，待验证'); router.nav('assets', 'agents'); }
    catch (error) { UI.toast(error.message); }
  },
  agaDelete(id) {
    const agent = store.agentOf(id); if (!agent) return;
    if (store.listAgentTasks().some(task => task.targetId === id)) return UI.toast('该智能体已有演练任务引用，不能删除');
    UI.modal('删除智能体', `<p>删除「${UI.esc(agent.name)}」的接入记录？</p>`, UI.btn('取消', { onclick: 'UI.closeModal()' }) + UI.btn('删除', { kind: 'danger', onclick: `App.agaDeleteConfirm('${id}')` }));
  },
  agaDeleteConfirm(id) {
    if (store.listAgentTasks().some(task => task.targetId === id)) return UI.toast('该智能体已有演练任务引用，不能删除');
    store.deleteAgent(id); UI.closeModal(); router.nav('assets', 'agents');
  },
};
