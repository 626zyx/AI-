/* 创建页只管理表单和步进。配置通过 store 保存，执行数据由任务服务在启动时选择。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { methodConfigurationTable } from '../core/config-detail.js';
import { SURFACE_KIND, RISK_LABEL } from '../domain/constants.js';
import { MODEL_EXECUTION_DEFAULTS, modelExecutionConfiguration } from '../domain/task-configuration.js';
import { CONFIGURE_MODEL_VALUE, configureModelsOption, configureMoreModels } from '../core/model-config-navigation.js';
import { promptUnsavedChanges } from '../core/unsaved-changes.js';
import { openResourcePicker, listPickerResources } from '../core/resource-picker.js';
import { getAgentQuestions } from '../domain/agent-environments.js';
import { listAgentAttackTemplates, getAgentAttackTemplate } from '../domain/agent-attack-library.js';
import { usableTaskModel } from '../domain/agent-configuration.js';
import { publishedModelEvaluators, getModelEvaluator, SYSTEM_MODEL_EVALUATOR_ID } from '../domain/model-evaluators.js';
import { runSandboxValidation, sandboxValidationIsCurrent } from '../domain/sandbox-validation.js';
import { sandboxValidationPanel } from '../core/sandbox-validation.js';

const stepsOf = type => type === 'agent' ? ['任务与演练方式', '靶标与沙箱验证', '环境与评估'] : ['任务与对象', '攻击与防护策略', '评估与执行', '确认配置'];
const forms = new Map();
let pendingLeave = null;
let leavePromptOpen = false;
const routeType = route => route.page === 'agent' || route.sub?.startsWith('ag-') ? 'agent' : 'model';
const typeOfRoute = () => routeType(router.state());
const routes = (type) => type === 'agent'
  ? { page: 'agent', create: 'ag-task-create', list: 'ag-tasks', detail: 'ag-task-detail' }
  : { page: 'exercise', create: 'task-create', list: 'tasks', detail: 'task-detail' };
const tasksOf = (type) => type === 'agent' ? store.listAgentTasks() : store.listTasks();
const taskOf = (id, type) => type === 'agent' ? store.getAgentTask(id) : store.getTask(id);
const targetRows = rows => {
  const bridged = rows.filter(row => row.assetId);
  return (bridged.length ? bridged : rows).filter(row => (!row.status || row.status === 'connected') && row.testable !== false);
};
const targets = () => listPickerResources('model').filter(usableTaskModel);
const agentTargets = () => listPickerResources('agent').filter(row => row.status !== 'disabled' && row.assetSnapshot?.sourceStatus !== '已停用' && row.testable !== false);
const targetsOf = type => type === 'agent' ? agentTargets() : targets();
const assetKey = row => row.assetId || row.id;
const assetVersion = row => row?.assetVersion || row?.version || (row?.id.includes('@') ? row.id.slice(row.id.lastIndexOf('@') + 1) : '当前版本');
const selectedTarget = form => targetsOf(form.type).find(row => row.id === form.targetId);
const displayVersion = row => row?.versionLabel || row?.enterpriseVersion || assetVersion(row);
const versionNumber = row => Number(String(assetVersion(row)).replace(/^[vV]/, '')) || 0;
const resolveTarget = (type, id, name) => {
  const rows = targetsOf(type);
  const key = String(id || '').replace(/^tgt-/, 'mdl-');
  const exact = rows.find(row => row.id === key);
  if (exact || key.includes('@')) return exact;
  return rows.filter(row => row.assetId === key || row.name === name).sort((a, b) => versionNumber(b) - versionNumber(a))[0];
};
const judges = () => listPickerResources('model').filter(usableTaskModel);
// Legacy tasks contain an unversioned auxiliary-model ID. Resolve it once in the
// editable form; an explicit historical version must never silently move forward.
const resolveJudge = (id, name) => {
  const rows = judges(), key = String(id || '');
  const exact = rows.find(row => row.id === key);
  if (key.includes('@')) return exact;
  const versions = rows.filter(row => row.assetId === key).sort((a, b) => versionNumber(b) - versionNumber(a));
  return versions[0] || exact || (!key && name ? rows.find(row => row.name === name) : undefined);
};
const publishedStrategies = () => store.strategies.filter(s => s.status === 'published');
const strategyOf = form => publishedStrategies().find(s => s.id === form.strategyId);
const publishedAgentStrategies = () => store.agentStrategies.filter(strategy => strategy.status === 'published');
const button = (label, options = {}) => UI.btn(label, options).replace('<button ', '<button type="button" ');
const option = (id, label, selected) => `<option value="${UI.esc(id)}"${id === selected ? ' selected' : ''}>${UI.esc(label)}</option>`;
const plain = (value) => UI.esc(value ?? '未选择');
const field = (label, value, note = '') => `<div class="tw-read-field"><span>${UI.esc(label)}</span><strong>${value}</strong>${note ? `<small>${UI.esc(note)}</small>` : ''}</div>`;
const section = (title, body) => `<section class="tw-section"><h2>${UI.esc(title)}</h2>${body}</section>`;
const select = (id, label, key, rows, selected, placeholder, modelAsset = false) => `<div class="field"><label for="${id}">${label} <span class="req">*</span></label><select id="${id}" required aria-required="true" onchange="App.twSelect('${key}',this.value)">${option('', placeholder, selected)}${rows.map(row => option(row.id, row.name, selected)).join('')}${modelAsset ? configureModelsOption : ''}</select></div>`;
const formFingerprint = form => JSON.stringify([
  form.name, form.description, form.targetId, form.strategyId, form.judgeId, form.evaluatorId, form.guardId,
  form.guardEnabled, form.guardStages, form.injectionSurfaceIds, form.concurrency, form.maxTokens,
  form.targetModelId, form.exerciseMode, form.attackTemplateId, form.attackerId, form.questionIds, form.evaluationMode,
  form.sandboxValidation?.fingerprint, form.sandboxValidation?.state, form.sandboxValidation?.checkedAt,
]);
const hasUnsavedChanges = form => formFingerprint(form) !== form.savedFingerprint;

export function warnOnUnsavedTask(event) {
  const type = typeOfRoute();
  if (router.state().sub !== routes(type).create) return;
  const form = forms.get(type);
  if (!form || !hasUnsavedChanges(form)) return;
  event.preventDefault();
  event.returnValue = '';
}

function configurationOf(form) {
  if (form.type === 'agent') {
    try { return store.agentConfigurationOf(agentFormInput(form), { draft: true }); }
    catch { return { targetName: selectedTarget(form)?.name, targetModelName: judges().find(row => row.id === form.targetModelId)?.name,
      attackerName: judges().find(row => row.id === form.attackerId)?.name, judgeName: judges().find(row => row.id === form.judgeId)?.name,
      technique: form.exerciseMode === 'baseline' ? 'baseline' : form.attackTemplateId,
      techniqueName: form.exerciseMode === 'baseline' ? '基础安全演练' : getAgentAttackTemplate(form.attackTemplateId)?.name,
      requestedSurfaces: [], total: form.questionIds.length, evaluationMode: form.evaluationMode }; }
  }
  const strategy = strategyOf(form), guard = store.guards.find(row => row.id === form.guardId);
  const snapshot = form.configurationSnapshot;
  const savedStrategy = snapshot?.strategyId === form.strategyId ? snapshot : null;
  const sameTarget = snapshot && String(snapshot.targetId).replace(/^tgt-/, 'mdl-') === form.targetId;
  const bankCount = (strategy?.banks || []).reduce((sum, ref) => {
    const bank = store.getBank(ref.bankId);
    return sum + (ref.count ?? bank?.items.length ?? 0);
  }, 0);
  return {
    targetName: sameTarget ? snapshot.targetName : targets().find(t => t.id === form.targetId)?.name,
    strategyName: savedStrategy?.strategyName ?? strategy?.name,
    methods: savedStrategy?.methods ?? strategy?.methods ?? [],
    banks: savedStrategy?.banks, bankName: savedStrategy?.bankName,
    bankCount: savedStrategy?.bankCount ?? bankCount,
    total: savedStrategy?.total ?? bankCount * (strategy?.methods.length || 0),
    guardId: form.guardEnabled ? guard?.id || form.guardId : null,
    guardName: form.guardEnabled ? snapshot?.guardId === form.guardId ? snapshot.guardName : guard?.name : null,
    guardStages: form.guardEnabled ? form.guardStages : [],
    judgeName: snapshot?.judgeId === form.judgeId ? snapshot.judgeName : judges().find(m => m.id === form.judgeId)?.name,
    evaluatorName: snapshot?.evaluatorId === form.evaluatorId ? snapshot.evaluatorName : getModelEvaluator(form.evaluatorId)?.name,
    concurrency: form.concurrency, maxTokens: form.maxTokens,
  };
}
function newName(type, base) {
  const used = new Set(tasksOf(type).map(t => t.name));
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base} ${i}`)) i += 1;
  return `${base} ${i}`;
}
function createForm(type, preset = {}, id = null) {
  const inherited = preset.sourceTaskId ? taskOf(preset.sourceTaskId, type) : null;
  const config = { ...inherited, ...preset, ...preset.configSnapshot };
  const step = id && preset.status === 'draft' && Number.isInteger(preset.wizardStep) ? Math.max(0, Math.min(stepsOf(type).length - 1, preset.wizardStep)) : 0;
  const visited = id && preset.status === 'draft' && Number.isInteger(preset.wizardVisited) ? Math.max(step, Math.min(stepsOf(type).length - 1, preset.wizardVisited)) : step;
  const form = {
    type, id, name: preset.name || '', description: preset.description || preset.desc || '',
    step, visited, busy: false, error: '', nameError: '',
  };
  if (type === 'agent') {
    form.targetId = resolveTarget(type, config.targetId, config.targetName)?.id || config.targetId || '';
    form.injectionSurfaceIds = [...(config.injectionSurfaceIds || [])];
    form.strategyId = '';
    const target = agentTargets().find(row => row.id === form.targetId);
    form.targetModelId = resolveJudge(config.targetModelId || target?.baseModelId, config.targetModelName || target?.baseModelName)?.id || '';
    form.exerciseMode = config.exerciseMode || (config.technique && config.technique !== 'baseline' ? 'attack' : 'baseline');
    form.attackTemplateId = 'universal';
    form.attackerId = resolveJudge(config.attackerId, config.attackerName)?.id || '';
    form.questionIds = [...(config.questionIds || config.taskIdSnapshot || [])];
    form.evaluationMode = 'llm';
    form.judgeId = resolveJudge(config.judgeId, config.judgeName)?.id || '';
    form.questionSearch = ''; form.questionBusiness = ''; form.questionRisk = ''; form.questionSource = '';
    form.sandboxValidation = config.sandboxValidation ? structuredClone(config.sandboxValidation) : null;
    if (form.sandboxValidation?.state === 'running') form.sandboxValidation = null;
    form.configurationSnapshot = preset.configSnapshot ? structuredClone(preset.configSnapshot) : null;
  } else {
    form.configurationSnapshot = preset.configSnapshot ? structuredClone(preset.configSnapshot) : null;
    form.targetId = resolveTarget(type, config.targetId, config.targetName)?.id || '';
    form.strategyId = config.strategyId || '';
    form.guardEnabled = config.guardEnabled ?? !!config.guardId;
    form.guardId = form.guardEnabled ? config.guardId || '' : '';
    form.guardStages = [...(config.guardStages || [])];
    form.judgeId = resolveJudge(config.judgeId, config.judgeName)?.id || config.judgeId || '';
    form.evaluatorId = config.evaluatorId ?? SYSTEM_MODEL_EVALUATOR_ID;
    form.concurrency = config.concurrency ?? MODEL_EXECUTION_DEFAULTS.concurrency;
    form.maxTokens = config.maxTokens ?? MODEL_EXECUTION_DEFAULTS.maxTokens;
  }
  form.savedFingerprint = formFingerprint(form);
  return form;
}
function activeForm() {
  const type = typeOfRoute();
  if (!forms.has(type)) forms.set(type, createForm(type));
  return forms.get(type);
}
function refresh() {
  const form = activeForm(), route = routes(form.type);
  router.nav(route.page, route.create, form.id, { replace: true });
}

export function openTaskWizard(type = 'model', preset = {}) {
  const route = routes(type);
  router.nav(route.page, route.create, null, { onCommit: () => forms.set(type, createForm(type, preset)) });
}
export function editTaskConfig(id, type = 'model') {
  const task = taskOf(id, type);
  if (!task) return UI.toast('任务不存在');
  if (!['draft', 'ready'].includes(task.status)) return UI.toast('任务已经启动，请复制配置创建新任务');
  const route = routes(type);
  router.nav(route.page, route.create, id, { onCommit: () => forms.set(type, createForm(type, task, id)) });
}
export function copyTaskConfig(id, type = 'model') {
  try {
    const copiedId = store.copyTask(id, type), route = routes(type);
    UI.closeMenus();
    router.nav(route.page, route.create, copiedId, { onCommit: () => forms.set(type, createForm(type, taskOf(copiedId, type), copiedId)) });
    return copiedId;
  } catch (error) { UI.toast(error.message); }
}

function scopeText(config, type) {
  if (type === 'agent') return config.total ? `${config.total} 个环境` : '未选择';
  if (!config.methods.length) return '未选择';
  return `${config.bankCount} 题 × ${config.methods.length} 种方法 · ${config.total} 个攻防单元`;
}
function agentFormInput(form) {
  return { targetId: form.targetId, targetModelId: form.targetModelId, exerciseMode: form.exerciseMode,
    attackTemplateId: form.attackTemplateId, attackerId: form.attackerId, questionIds: form.questionIds,
    evaluationMode: 'llm', judgeId: form.judgeId, sandboxValidationRequired: true, sandboxValidation: form.sandboxValidation,
    injectionSurfaceIds: form.exerciseMode === 'attack' ? form.injectionSurfaceIds : [] };
}
function targetSandboxInput(form) {
  return { target: store.agentOf(form.targetId), model: store.models.find(model => model.id === form.targetModelId) || null };
}
function targetSandboxPassed(form) {
  return form.sandboxValidation?.state === 'passed' && sandboxValidationIsCurrent(form.sandboxValidation, targetSandboxInput(form));
}
function agentResourceSelect(id, label, key, rows, selected, placeholder) {
  return select(id, label, key, rows.map(row => ({ id: row.id, name: row.kind === 'agent' ? `${row.displayName || row.name} · ${displayVersion(row)}` : row.displayName || row.name })), selected, placeholder);
}
function pickerField(id, label, key, rows, value, placeholder, note = '') {
  const chosen = rows.find(row => row.id === value);
  return `<div class="field"><label for="${id}">${UI.esc(label)} <span class="req">*</span></label>
    <button type="button" id="${id}" value="${UI.esc(value || '')}" class="tw-resource-field${chosen ? ' has-value' : ''}" onclick="App.twPick('${key}')"><span>${UI.esc(chosen?.displayName || chosen?.name || placeholder)}</span><span class="tw-resource-action">${chosen ? '更换' : '选择'}</span></button>
    ${chosen ? `<small class="tw-note">${UI.esc(chosen.apiModel || chosen.image || chosen.desc || '')}${chosen.kind==='agent'&&chosen.assetVersion ? ` · ${UI.esc(displayVersion(chosen))}` : ''}</small>` : ''}${note ? `<p class="tw-note">${UI.esc(note)}</p>` : ''}</div>`;
}
function taskNameFields(form) {
  return `<div class="field"><label for="tw-name">任务名称 <span class="req">*</span></label><input id="tw-name" maxlength="100" value="${UI.esc(form.name)}" placeholder="例如：业务交付与保密验证" oninput="App.twField('name',this.value)" aria-describedby="tw-name-error"><span id="tw-name-error" class="tw-error" ${form.nameError ? '' : 'hidden'}>${UI.esc(form.nameError)}</span></div>
    <div class="field"><label for="tw-description">任务描述</label><textarea id="tw-description" rows="2" maxlength="1000" placeholder="选填，说明本次演练的目的" oninput="App.twField('description',this.value)">${UI.esc(form.description)}</textarea></div>`;
}
function agentBasicStep(form) {
  return section('任务信息', `<div class="tw-fields">${taskNameFields(form)}</div>`)
    + section('演练方式', `<fieldset class="tw-choice-group"><legend class="sr-only">演练方式</legend><div class="tw-mode-cards">
      <label class="${form.exerciseMode === 'baseline' ? 'selected' : ''}"><input type="radio" name="tw-exercise-mode" value="baseline" ${form.exerciseMode === 'baseline' ? 'checked' : ''} onchange="App.twAgentMode(this.value)"><span><strong>基础安全演练</strong><small>直接执行业务任务，观察完成情况与安全边界</small></span></label>
      <label class="${form.exerciseMode === 'attack' ? 'selected' : ''}"><input type="radio" name="tw-exercise-mode" value="attack" ${form.exerciseMode === 'attack' ? 'checked' : ''} onchange="App.twAgentMode(this.value)"><span><strong>加入攻击</strong><small>使用通用攻击者，在授权入口中注入内容</small></span></label>
      </div></fieldset>${form.exerciseMode === 'attack' ? `<div class="tw-fields">${field('攻击者', '通用攻击者')}${pickerField('tw-attacker', '攻击模型', 'attackerId', judges(), form.attackerId, '请选择攻击模型')}</div>` : ''}`);
}
function agentTargetStep(form) {
  const stale = !!form.sandboxValidation && !sandboxValidationIsCurrent(form.sandboxValidation, targetSandboxInput(form));
  return section('选择靶标', `<div class="tw-fields">${agentResourceSelect('tw-target', '靶标 Agent', 'targetId', agentTargets(), form.targetId, '请选择已接入的 Agent')}${pickerField('tw-target-model', '靶标基模', 'targetModelId', judges(), form.targetModelId, '请选择本次使用的模型')}</div>`)
    + `<div id="tw-sandbox-panel">${sandboxValidationPanel(form.sandboxValidation, { title: '靶标最小验证', onRun: 'App.twValidateSandbox()', stale })}</div>`
    + (form.exerciseMode === 'attack' && targetSandboxPassed(form) ? section('选择攻击面', injectionRange(form)) : '');
}
function filteredAgentQuestions(form) {
  const query = form.questionSearch.trim().toLowerCase();
  return getAgentQuestions().filter(question => !!form.questionBusiness && (!query || `${question.title} ${question.taskId} ${question.goal}`.toLowerCase().includes(query))
    && question.business === form.questionBusiness && (!form.questionRisk || question.riskLabels.includes(form.questionRisk))
    && (!form.questionSource || question.source === form.questionSource));
}
function agentQuestionTable(form) {
  const rows = filteredAgentQuestions(form), allSelected = rows.length && rows.every(question => form.questionIds.includes(question.id));
  return `<div class="tw-question-list"><table class="table"><thead><tr><th><input type="checkbox" aria-label="选择当前筛选的全部环境" ${allSelected ? 'checked' : ''} onchange="App.twQuestionsAll(this.checked)"></th><th>环境名称</th><th>来源</th><th>风险场景</th><th>评估定义</th></tr></thead><tbody>${rows.map(question => `<tr class="${form.questionIds.includes(question.id) ? 'selected' : ''}"><td><input type="checkbox" aria-label="选择 ${UI.esc(question.title)}" ${form.questionIds.includes(question.id) ? 'checked' : ''} onchange="App.twQuestion('${UI.esc(question.id)}',this.checked)"></td><td><strong title="${UI.esc(question.title)}">${UI.esc(question.title)}</strong><small>${UI.esc(question.taskId)}</small></td><td>${question.source === 'system' ? '系统' : '自建'}</td><td><div class="tw-risk-tags">${question.riskLabels.slice(0, 3).map(key => `<span title="${UI.esc(RISK_LABEL[key]?.label || key)}">${UI.esc(RISK_LABEL[key]?.label || key)}</span>`).join('')}${question.riskLabels.length > 3 ? `<span title="${UI.esc(question.riskLabels.map(key => RISK_LABEL[key]?.label || key).join('、'))}" aria-label="查看全部风险场景">...</span>` : ''}</div></td><td><span class="tw-definition">${question.hasLlm ? 'LLM ✓' : 'LLM 缺失'}</span></td></tr>`).join('') || '<tr><td colspan="5" class="empty-cell">没有符合条件的已发布环境</td></tr>'}</tbody></table></div>`;
}
function agentQuestionStep(form) {
  const questions = getAgentQuestions(), businesses = [...new Set(questions.map(question => question.business))];
  return section('选择环境', `<div class="tw-business-entries" aria-label="业务类别">${businesses.map(name => { const rows = questions.filter(question => question.business === name), count = rows.filter(question => form.questionIds.includes(question.id)).length; return `<button type="button" class="${form.questionBusiness === name ? 'active' : ''}" aria-pressed="${form.questionBusiness === name}" onclick="App.twQuestionBusiness('${encodeURIComponent(name)}')"><strong>${UI.esc(name)}</strong><span>${rows.length} 个环境${count ? ` · 已选 ${count}` : ''}</span></button>`; }).join('')}</div>
    ${form.questionBusiness ? `<div class="tw-question-tools"><input id="tw-question-search" type="search" value="${UI.esc(form.questionSearch)}" placeholder="搜索环境名称或 ID" aria-label="搜索环境" oninput="App.twQuestionFilter('questionSearch',this.value)"><select aria-label="风险场景筛选" onchange="App.twQuestionFilter('questionRisk',this.value)">${option('', '全部风险场景', form.questionRisk)}${Object.entries(RISK_LABEL).filter(([key]) => key !== 'unclassified').map(([key, value]) => option(key, value.label, form.questionRisk)).join('')}</select><select aria-label="来源筛选" onchange="App.twQuestionFilter('questionSource',this.value)">${option('', '全部来源', form.questionSource)}${option('system', '系统', form.questionSource)}${option('custom', '自建', form.questionSource)}</select></div><div id="tw-question-table">${agentQuestionTable(form)}</div>` : '<p class="tw-note">先选择业务类别，再勾选本次演练的环境。</p>'}
    <div class="tw-selection-count">已选 <strong id="tw-selected-count">${form.questionIds.length}</strong> 个环境 <span>筛选不会清空已选环境</span>${form.questionIds.length ? button('清空选择', { onclick: 'App.twQuestionsClear()' }) : ''}</div>`)
    + section('LLM 评估', pickerField('tw-judge', '裁判模型', 'judgeId', judges(), form.judgeId, '请选择裁判模型'));
}
function objectStep(form, config) {
  const rows = targetsOf(form.type), chosen = selectedTarget(form);
  const unique = [...new Set(rows.map(assetKey))].map(key => {
    const versions = rows.filter(row => assetKey(row) === key).sort((a, b) => versionNumber(b) - versionNumber(a));
    return versions.find(row => row.id === form.targetId) || versions[0];
  });
  const versions = chosen ? rows.filter(row => assetKey(row) === assetKey(chosen)).sort((a, b) => versionNumber(b) - versionNumber(a)) : [];
  const object = `<div class="tw-field-grid">${pickerField('tw-target', '被测资产', 'targetId', rows, form.targetId, '请选择靶标模型')}${field('请求标识', chosen ? plain(chosen.apiModel) : '选择模型后显示')}</div>`;
  return section('任务与对象', `<div class="tw-fields">
    <div class="field"><label for="tw-name">任务名称 <span class="req">*</span></label>
      <input id="tw-name" type="text" maxlength="100" value="${UI.esc(form.name)}" placeholder="为本次演练起一个名称" autocomplete="off" aria-describedby="tw-name-error" ${form.nameError ? 'aria-invalid="true"' : ''} oninput="App.twField('name',this.value)" />
      <span id="tw-name-error" class="tw-error" ${form.nameError ? '' : 'hidden'}>${UI.esc(form.nameError)}</span></div>
    <div class="field"><label for="tw-description">任务描述</label><textarea id="tw-description" rows="3" maxlength="1000" placeholder="选填，说明本次演练的目的" oninput="App.twField('description',this.value)">${UI.esc(form.description)}</textarea></div>
    ${object}${form.type === 'agent' ? injectionRange(form) : ''}</div>`);
}
function injectionRange(form) {
  if (!form.targetId || !targetSandboxPassed(form)) return '';
  const template = getAgentAttackTemplate(form.attackTemplateId);
  const files = form.sandboxValidation.discoveredSurfaces.filter(file => !template || template.surfaceKinds.includes(file.kind));
  if (!files.length) return '<div class="tw-rule">未发现可用的注入文件。请完善资产中的文件配置后重新验证，或选择基础安全演练。</div>';
  const groups = [...new Set(files.map(file => file.kind))];
  return `<fieldset class="tw-choice-group tw-surfaces"><legend>有效注入面 <span class="req">*</span></legend><p class="tw-note">以下为本次演示验证从配置模拟读取的文件；尚未核验真实容器内的加载行为。</p>${groups.map(kind => `<div class="tw-surface-group"><h3>${UI.esc(SURFACE_KIND[kind] || kind)}</h3>${files.filter(file => file.kind === kind).map(file => `<label><input type="checkbox" value="${UI.esc(file.id)}" ${form.injectionSurfaceIds.includes(file.id) ? 'checked' : ''} onchange="App.twSurface(this.value,this.checked)"><span>${UI.esc(file.path)}</span></label>`).join('')}</div>`).join('')}</fieldset>`;
}
function strategyDetails(strategy, config) {
  // Older imported tasks lack parameter snapshots; only those missing values use catalog defaults.
  const methods = config.methods.map(method => ({ ...method,
    params: method.params ?? strategy.methods.find(m => m.name === method.name)?.params ?? [],
  }));
  const bankScope = config.banks?.length
    ? config.banks.map(bank => `${bank.name} · ${bank.count} 题`)
    : config.bankName ? [`${config.bankName} · ${config.bankCount} 题`] : store.strategyBankLines(strategy);
  return `<div class="tw-strategy" data-tw-strategy-details>
    <header><h3>${UI.esc(config.strategyName)}</h3>${UI.badge('已发布', 'blue')}</header>
    ${field('题库范围', bankScope.map(UI.esc).join('<br>'))}
    <div class="tw-methods"><h4>攻击方法</h4>${methodConfigurationTable(methods.sort((a,b) => a.order - b.order))}</div></div>`;
}
const unavailableStrategyNotice = form => form.strategyId ? '<p class="tw-error" role="alert">原攻击策略已删除或不可用，请重新选择已发布策略。</p>' : '';
function strategyDropdown(form) {
  const chosen = strategyOf(form);
  return `<div class="field"><label for="tw-strategy">攻击策略 <span class="req">*</span></label><div class="tw-strategy-dropdown" onkeydown="App.twStrategyKey(event)">
    <button type="button" id="tw-strategy" value="${UI.esc(form.strategyId)}" class="tw-resource-field${chosen ? ' has-value' : ''}" aria-haspopup="listbox" aria-expanded="false" aria-controls="tw-strategy-options" onclick="App.twStrategyToggle()"><span>${UI.esc(chosen?.name || '请选择攻击策略')}</span><span class="tw-dropdown-arrow" aria-hidden="true">⌄</span></button>
    <div class="tw-strategy-menu" hidden><div id="tw-strategy-options" role="listbox" aria-label="已发布攻击策略">${publishedStrategies().map(row => `<button type="button" role="option" aria-selected="${row.id === form.strategyId}" class="tw-strategy-option" data-strategy-id="${UI.esc(row.id)}" onclick="App.twSelect('strategyId',this.dataset.strategyId)">${UI.esc(row.name)}</button>`).join('') || '<p class="tw-dropdown-empty">暂无已发布的攻击策略</p>'}</div><button type="button" class="tw-strategy-configure" onclick="App.twConfigureStrategy()">+ 去配置攻击策略</button></div>
  </div></div>`;
}
function attackStep(form, config) {
  if (form.type === 'model') {
    const strategy = strategyOf(form);
    return section('选择攻击策略', `<div class="tw-fields">${strategyDropdown(form)}${strategy ? '' : unavailableStrategyNotice(form)}</div>${strategy ? strategyDetails(strategy, config) : ''}`);
  }
  const chosen = publishedAgentStrategies().find(strategy => strategy.id === form.strategyId);
  const bankScope = config.banks?.length
    ? config.banks.map(bank => `${bank.name} · 前 ${bank.count} 题`)
    : [`${config.sceneBankName || '场景题库'} · ${config.total || 0} 题`];
  return section('选择攻击策略', `<div class="tw-fields">${select('tw-strategy', '演练策略', 'strategyId', publishedAgentStrategies(), form.strategyId, '请选择演练策略')}${chosen ? '' : unavailableStrategyNotice(form)}</div>${chosen ? `<div class="tw-strategy" data-tw-strategy-details><header><h3>${plain(config.strategyName)}</h3>${UI.badge('已发布', 'blue')}</header>${field('场景题库范围', bankScope.map(UI.esc).join('<br>'))}${field('攻击方法', plain(config.techniqueName))}${config.technique === 'universal' ? field('攻击 Agent 基模', plain(config.attackerName)) : ''}</div>` : ''}`);
}
function guardStep(form, config) {
  return section('选择防护策略', `<div class="tw-fields"><div class="field"><label for="tw-guard">防护策略</label><select id="tw-guard" onchange="App.twSelect('guardId',this.value)">${option('', '不启用', form.guardEnabled ? form.guardId : '')}${store.guards.map(row => option(row.id, row.model ? `${row.model} · ${row.name}` : row.name, form.guardEnabled ? form.guardId : '')).join('')}</select></div></div>${form.guardEnabled ? `<fieldset class="tw-choice-group"><legend>防护位置 <span class="req">*</span></legend><div class="tw-choices">
      ${store.GUARD_STAGES.map(stage => `<label><input type="checkbox" value="${stage}" ${form.guardStages.includes(stage) ? 'checked' : ''} onchange="App.twGuardStage('${stage}',this.checked)">${stage}</label>`).join('')}
      </div><p class="tw-note">可同时选择输入和输出。</p></fieldset>` : ''}`);
}
function evaluationStep(form, config) {
  return section('评估配置', `<div class="tw-fields">${select('tw-evaluator', '评估器', 'evaluatorId', publishedModelEvaluators(), form.evaluatorId, '请选择已发布评估器')}${pickerField('tw-judge', '裁判模型', 'judgeId', judges(), form.judgeId, '请选择裁判模型')}</div>
    ${form.type === 'model' ? '' : '<p class="tw-note">裁判根据场景环境、执行记录与交付产物形成判定。</p>'}`);
}
function executionStep(form) {
  return section('执行配置', `<div class="tw-fields tw-execution-fields">
    <div class="field"><label for="tw-concurrency">并发数 <span class="req">*</span></label><input id="tw-concurrency" type="number" min="1" step="1" required value="${UI.esc(form.concurrency)}" oninput="App.twExecution('concurrency',this.value)" aria-describedby="tw-concurrency-help"><p id="tw-concurrency-help" class="tw-note">同时执行的攻防单元数量。</p></div>
    <div class="field"><label for="tw-max-tokens">Token 限制 <span class="req">*</span></label><div class="input-unit"><input id="tw-max-tokens" type="number" min="1" step="1" required value="${UI.esc(form.maxTokens)}" oninput="App.twExecution('maxTokens',this.value)" aria-describedby="tw-token-help"><span>tokens</span></div><p id="tw-token-help" class="tw-note">单次模型调用的最大输出长度，不是整场演练的总额度。</p></div>
  </div>`);
}
function guardText(config) {
  return config.guardId ? `${config.guardName} · ${config.guardStages.length ? config.guardStages.join(' + ') : '请选择防护位置'}` : '未启用';
}
function confirmStep(form, config) {
  return section('确认配置', `<div class="tw-confirm-name"><strong>${UI.esc(form.name)}</strong>${UI.badge(form.type === 'agent' ? 'Agent 演练' : '模型演练', 'blue')}</div>
    ${UI.kvTable([
      ['演练对象', plain(config.targetName)], ['请求标识', plain(selectedTarget(form)?.apiModel)], ['攻击策略', plain(config.strategyName)],
      ['测试范围', UI.esc(scopeText(config, form.type))],
      ...(form.type === 'agent' ? [['注入面范围', config.technique === 'baseline' ? '不注入' : (config.requestedSurfaces || []).map(file => UI.esc(file.path)).join('<br>') || '未选择']] : [['防护策略', UI.esc(guardText(config))]]),
      ['裁判模型', plain(config.judgeName)], ...(form.type === 'model' ? [['评估器', plain(config.evaluatorName)], ['评估指标', '攻击成功率（ASR）']] : []),
      ...(form.type === 'model' ? [['执行配置', `并发数 ${plain(config.concurrency)} · 单次输出上限 ${plain(config.maxTokens)} tokens`]] : []),
      ['任务描述', form.description ? UI.esc(form.description) : '—'],
    ])}`);
}
function summary(form, config) {
  if (form.type === 'agent') return UI.card('本次演练', `<dl class="tw-summary"><div><dt>靶标 Agent</dt><dd>${plain(config.targetName)}</dd></div><div><dt>靶标基模</dt><dd>${plain(config.targetModelName)}</dd></div><div><dt>演练方式</dt><dd>${plain(config.techniqueName)}</dd></div>${form.exerciseMode === 'attack' ? `<div><dt>攻击模型</dt><dd>${plain(config.attackerName)}</dd></div><div><dt>有效注入面</dt><dd>${form.injectionSurfaceIds.length} 个范围</dd></div>` : ''}<div><dt>环境</dt><dd>${form.questionIds.length} 个已选</dd></div><div><dt>统一评估</dt><dd>LLM 评估 · ${plain(config.judgeName)}</dd></div></dl><p class="tw-aside-note">配置与历史证据分别保存。演示不会发起新的模型调用。</p>`);
  const strategyUnavailable = form.strategyId && !(form.type === 'agent' ? publishedAgentStrategies() : publishedStrategies()).some(strategy => strategy.id === form.strategyId);
  return UI.card('配置摘要', `<dl class="tw-summary">
    <div><dt>演练对象</dt><dd>${plain(config.targetName)}</dd></div>
    <div><dt>攻击策略</dt><dd>${plain(config.strategyName)}${strategyUnavailable ? '<span class="tw-error">（已删除或不可用，请重选）</span>' : ''}</dd></div>
    ${form.type === 'agent' ? `<div><dt>注入面范围</dt><dd>${config.technique === 'baseline' ? '不注入' : `${(config.requestedSurfaces || []).length} 个文件`}</dd></div>` : `<div><dt>防护策略</dt><dd>${UI.esc(guardText(config))}</dd></div>`}
    <div><dt>裁判模型</dt><dd>${plain(config.judgeName)}</dd></div>
    ${form.type === 'model' ? `<div><dt>评估器</dt><dd>${plain(config.evaluatorName)}</dd></div>` : ''}
    ${form.type === 'model' ? `<div><dt>测试范围</dt><dd>${UI.esc(scopeText(config, form.type))}</dd></div>` : ''}
    ${form.type === 'model' ? `<div><dt>执行配置</dt><dd>并发数 ${plain(config.concurrency)} · ${plain(config.maxTokens)} tokens / 次</dd></div>` : ''}</dl>`);
}

export function taskWizardPage(cur) {
  bindStrategyDropdownDismissal();
  const type = routeType(cur);
  let form = forms.get(type);
  if (cur.param) {
    const task = taskOf(cur.param, type);
    if (!task || !['draft', 'ready'].includes(task.status)) return `${UI.backBtn()}${UI.pageHead('配置不可编辑')}<div class="empty"><strong>此任务已启动或不存在，请从任务列表复测。</strong></div>`;
    if (form?.id !== cur.param) { form = createForm(type, task, task.id); forms.set(type, form); }
  }
  if (!form || (!cur.param && form.id)) { form = createForm(type); forms.set(type, form); }
  const config = configurationOf(form);
  if (!config) return `${UI.backBtn()}${UI.pageHead('新建演练任务')}<div class="empty"><strong>暂无可用的演练配置</strong></div>`;
  const title = form.id ? '编辑演练任务' : '新建演练任务';
  const steps = stepsOf(type);
  const bodies = type === 'agent' ? [agentBasicStep, agentTargetStep, agentQuestionStep] : [objectStep, (f, c) => attackStep(f, c) + guardStep(f, c), (f, c) => evaluationStep(f, c) + executionStep(f), confirmStep];
  return `${UI.backBtn()}${UI.pageHead(title)}<div class="tw-root" aria-label="任务创建向导">
    <ol class="tw-steps" style="--step-count:${steps.length}" aria-label="创建步骤">${steps.map((label, i) => `<li class="${i === form.step ? 'current' : i < form.step ? 'complete' : ''}"><button type="button" ${i > form.visited || form.busy ? 'disabled' : ''} ${i === form.step ? 'aria-current="step"' : ''} onclick="App.twStep(${i})"><span class="tw-step-number">${i + 1}</span><span>${label}</span></button></li>`).join('')}</ol>
    <div class="tw-layout"><form class="tw-form" onsubmit="event.preventDefault();App.twNext()" novalidate aria-busy="${form.busy}">
      <div class="tw-content" ${form.busy ? 'inert' : ''}>${bodies[form.step](form, config)}<p class="tw-error tw-save-error" id="tw-save-error" role="alert" ${form.error ? '' : 'hidden'}>${UI.esc(form.error)}</p></div>
      <div class="tw-footer"><div class="tw-footer-actions">
        ${button('取消', { onclick: 'App.twExit()', disabled: form.busy })}
        ${button('保存草稿', { onclick: 'App.twSaveDraft()', disabled: form.busy })}
        ${form.step > 0 ? button('上一步', { onclick: 'App.twPrevious()', disabled: form.busy }) : ''}
        ${button(form.busy ? '保存中…' : form.step === stepsOf(form.type).length - 1 ? '创建任务' : '下一步', { kind: 'primary', onclick: form.step === stepsOf(form.type).length - 1 ? 'App.twSave()' : 'App.twNext()', disabled: form.busy })}
      </div></div></form><aside class="tw-aside">${summary(form, config)}</aside></div>
  </div>`;
}
function validate(form, { draft = false, through = form.step } = {}) {
  const name = form.name.trim();
  form.nameError = !name && !draft ? '请输入任务名称'
    : name.length > 100 ? '任务名称不能超过 100 个字符'
    : name && tasksOf(form.type).some(t => t.id !== form.id && t.name.trim().toLowerCase() === name.toLowerCase()) ? '任务名称已存在，请使用新的名称' : '';
  let error = form.nameError, errorStep = 0;
  if (!error && !draft && form.type === 'model') {
    const checks = [
      [0, targets().some(m => m.id === form.targetId), '请选择靶标模型'],
      [1, !!strategyOf(form), '请选择已发布的攻击策略'],
      [1, !form.guardEnabled || store.guards.some(guard => guard.id === form.guardId), '请选择防护模型'],
      [1, !form.guardEnabled || form.guardStages.some(stage => store.GUARD_STAGES.includes(stage)), '请选择至少一个防护位置'],
      [2, judges().some(m => m.id === form.judgeId), '请选择裁判模型'],
      [2, publishedModelEvaluators().some(row => row.id === form.evaluatorId), '请选择已发布的评估器'],
    ];
    const invalid = checks.find(([step, valid]) => step <= through && !valid);
    if (invalid) [errorStep, , error] = invalid;
    if (!error && through >= 2) {
      try { modelExecutionConfiguration(form); }
      catch (executionError) { error = executionError.message; errorStep = 2; }
    }
  }
  if (!error && !draft && form.type === 'agent') {
    const checks = [
      [0, form.exerciseMode === 'baseline' || judges().some(model => model.id === form.attackerId), '请选择可用的攻击模型'],
      [1, agentTargets().some(agent => agent.id === form.targetId), '请选择已接入的靶标智能体'],
      [1, judges().some(model => model.id === form.targetModelId), '请选择可用的靶标基模'],
      [1, targetSandboxPassed(form), '请先完成当前靶标与基模配置的沙箱演示验证'],
      [1, form.exerciseMode === 'baseline' || form.injectionSurfaceIds.length > 0, '请至少选择一个有效注入面'],
      [2, form.questionIds.length > 0, '请至少选择一个环境'],
      [2, judges().some(model => model.id === form.judgeId), '请选择可用的裁判模型'],
    ];
    const invalid = checks.find(([step, valid]) => step <= through && !valid);
    if (invalid) [errorStep, , error] = invalid;
    if (!error && through >= 2) { try { store.agentConfigurationOf(agentFormInput(form), { draft: false }); } catch (problem) { error = problem.message; errorStep = 2; } }
  }
  form.error = error;
  if (error) { form.step = errorStep; refresh(); if (form.nameError) document.getElementById('tw-name')?.focus(); return false; }
  return true;
}
async function persistForm(form, draft) {
  if (form.busy || !validate(form, { draft, through: stepsOf(form.type).length - 1 })) return false;
  form.busy = true; refresh();
  try {
    const config = form.type === 'agent' ? agentFormInput(form) : {
      targetId: form.targetId, strategyId: form.strategyId, judgeId: form.judgeId, evaluatorId: form.evaluatorId,
      guardEnabled: form.guardEnabled, guardId: form.guardEnabled ? form.guardId : null, guardStages: form.guardEnabled ? form.guardStages : [],
      concurrency: form.concurrency, maxTokens: form.maxTokens,
    };
    const id = await store.saveTask({ ...config, id: form.id || undefined,
      name: form.name.trim() || newName(form.type, `未命名${form.type === 'agent' ? ' Agent ' : '模型'}演练`),
      description: form.description.trim(), objectType: form.type,
      ...(draft ? { wizardStep: form.step, wizardVisited: form.visited } : {}),
    }, { draft });
    form.id = id;
    const saved = taskOf(id, form.type);
    form.name = saved.name;
    form.description = saved.description || '';
    form.configurationSnapshot = structuredClone(saved.configSnapshot);
    form.savedFingerprint = formFingerprint(form);
    UI.toast(draft ? '草稿已保存到任务列表' : '任务已保存，等待开始');
    return true;
  } catch (error) {
    form.error = error instanceof Error ? error.message : '任务保存失败，请重试'; form.busy = false; refresh();
    return false;
  } finally { form.busy = false; }
}
async function save(draft) {
  const form = activeForm();
  if (!await persistForm(form, draft)) return;
  const route = routes(form.type);
  forms.delete(form.type);
  router.nav(route.page, draft ? route.list : route.detail, draft ? null : form.id, { replace: true });
}

/* The router owns destinations; the wizard owns unsaved form data and its prompt.
 * A deliberate trip to model configuration retains the local form for its return action. */
router.beforeNavigate(transition => {
  const type = routeType(transition.from);
  if (transition.from.sub !== routes(type).create) return true;
  if (transition.options.purpose === 'locate-task-draft') return true;
  const form = forms.get(type);
  if (!form) return true;
  if (form.busy) return false;
  const finish = () => {
    // Save the draft address in history before opening strategy configuration,
    // so Back resumes that draft instead of opening an empty creation page.
    if (transition.options.purpose === 'configure-strategies' && form.id && transition.from.param !== form.id) {
      const route = routes(type);
      router.nav(route.page, route.create, form.id, { replace: true, purpose: 'locate-task-draft' });
      router.nav(transition.to.page, transition.to.sub, transition.to.param, transition.options);
      return;
    }
    if (transition.options.purpose !== 'configure-models') forms.delete(type);
    transition.proceed();
  };
  if (!hasUnsavedChanges(form)) {
    if (transition.options.purpose !== 'configure-models') forms.delete(type);
    return true;
  }
  pendingLeave = { form, finish };
  if (!leavePromptOpen) {
    leavePromptOpen = true;
    promptUnsavedChanges().then(async choice => {
      leavePromptOpen = false;
      const pending = pendingLeave;
      pendingLeave = null;
      if (!pending || choice === 'stay') return;
      if (choice === 'save' && !await persistForm(pending.form, true)) return;
      pending.finish();
    });
  }
  return false;
});
function clearError(form) {
  form.error = ''; const err = document.getElementById('tw-save-error'); if (err) err.hidden = true;
}
let choicePicker = null;
function closeStrategyDropdown(restoreFocus = false) {
  const trigger = document.getElementById('tw-strategy');
  const menu = document.querySelector('.tw-strategy-menu');
  if (!menu) return;
  menu.hidden = true;
  trigger?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) trigger?.focus();
}
const boundDropdownDocuments = new WeakSet();
function bindStrategyDropdownDismissal() {
  if (typeof document === 'undefined' || boundDropdownDocuments.has(document)) return;
  const dismiss = event => {
    if (!event.target.closest?.('.tw-strategy-dropdown')) closeStrategyDropdown();
  };
  document.addEventListener('click', dismiss);
  document.addEventListener('focusin', dismiss);
  boundDropdownDocuments.add(document);
}
function renderChoicePicker() {
  const { key, query, chosen } = choicePicker;
  const rows = key === 'attackTemplateId' ? listAgentAttackTemplates().filter(row => row.status === 'published') : publishedStrategies();
  const shown = rows.filter(row => `${row.name} ${row.desc || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return `<table class="table"><thead><tr><th></th><th>名称</th><th>说明</th><th>状态</th></tr></thead><tbody>${shown.map(row => `<tr><td><input type="radio" name="tw-picker-value" value="${UI.esc(row.id)}" ${chosen === row.id ? 'checked' : ''} onchange="App.twPickChoice(this.value)"></td><td><strong>${UI.esc(row.name)}</strong></td><td>${UI.esc(row.desc || '已发布的组合配置')}</td><td>${UI.badge('已发布', 'blue')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-cell">没有符合条件的资源</td></tr>'}</tbody></table>`;
}
export const actions = {
  editTaskConfig, copyTaskConfig,
  twPick(key) {
    const form = activeForm(); if (form.busy) return;
    if (key === 'strategyId') return actions.twStrategyToggle();
    if (key === 'attackTemplateId') {
      choicePicker = { key, query: '', chosen: form[key] || '' };
      UI.modal(key === 'strategyId' ? '选择攻击策略' : '选择攻击模板', `<div class="tw-resource-search"><input type="search" id="tw-pick-search" placeholder="搜索名称或说明" aria-label="搜索资源" oninput="App.twPickSearch(this.value)"></div><div id="tw-choice-table">${renderChoicePicker()}</div>`, button('取消', { onclick: 'UI.closeModal()' }) + button('确认选择', { kind: 'primary', onclick: 'App.twPickConfirm()' }), { wide: true });
      return;
    }
    if (!['targetId', 'targetModelId', 'attackerId', 'judgeId'].includes(key)) return;
    const title = ({ targetId: form.type === 'agent' ? '选择靶标 Agent' : '选择靶标模型', targetModelId: '选择靶标基模', attackerId: '选择攻击模型', judgeId: '选择裁判模型' })[key];
    openResourcePicker({ kind: key === 'targetId' && form.type === 'agent' ? 'agent' : 'model', value: form[key], title,
      onSelect: resource => { if (key !== 'targetId' && !usableTaskModel(resource)) return UI.toast('该资源不支持本次模型调用'); actions.twSelect(key, resource.id); } });
  },
  twPickSearch(value) { if (!choicePicker) return; choicePicker.query = value; document.getElementById('tw-choice-table').innerHTML = renderChoicePicker(); },
  twPickChoice(value) { if (choicePicker) choicePicker.chosen = value; },
  twPickConfirm() { if (!choicePicker?.chosen) return UI.toast('请选择一项资源'); const { key, chosen } = choicePicker; choicePicker = null; UI.closeModal(); actions.twSelect(key, chosen); },
  async twValidateSandbox() {
    const form = activeForm();
    if (form.type !== 'agent' || form.busy || (form.sandboxValidation?.state === 'running' && sandboxValidationIsCurrent(form.sandboxValidation, targetSandboxInput(form)))) return;
    clearError(form);
    const input = targetSandboxInput(form), runToken = {};
    form.sandboxRun = runToken;
    const active = () => forms.get('agent') === form && typeOfRoute() === 'agent' && router.state().sub === routes('agent').create;
    const report = await runSandboxValidation('target', input, { onUpdate: progress => {
      if (form.sandboxRun !== runToken || !sandboxValidationIsCurrent(progress, targetSandboxInput(form))) return;
      form.sandboxValidation = progress;
      if (active()) {
        const node = document.getElementById('tw-sandbox-panel');
        if (node) node.innerHTML = sandboxValidationPanel(progress, { title: '靶标最小验证', onRun: 'App.twValidateSandbox()' });
      }
    } });
    if (form.sandboxRun !== runToken || !sandboxValidationIsCurrent(report, targetSandboxInput(form))) return;
    form.sandboxValidation = report;
    form.injectionSurfaceIds = report.state === 'passed' ? form.injectionSurfaceIds.filter(id => report.discoveredSurfaces.some(surface => surface.id === id)) : [];
    if (active()) refresh();
    return report;
  },
  twStrategyToggle() {
    const form = activeForm(), trigger = document.getElementById('tw-strategy'), menu = document.querySelector('.tw-strategy-menu');
    if (form.busy || form.type !== 'model' || !menu) return;
    menu.hidden = !menu.hidden;
    trigger?.setAttribute('aria-expanded', String(!menu.hidden));
  },
  twStrategyKey(event) {
    const menu = document.querySelector('.tw-strategy-menu');
    if (!menu) return;
    if (event.key === 'Escape') { event.preventDefault(); closeStrategyDropdown(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (menu.hidden) actions.twStrategyToggle();
    const options = [...menu.querySelectorAll('button')], index = options.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowDown' ? (index + 1) % options.length : index < 0 ? options.length - 1 : (index - 1 + options.length) % options.length;
    options[next]?.focus();
  },
  twConfigureStrategy() {
    if (activeForm().busy) return;
    closeStrategyDropdown();
    router.nav('strategy', 'strategy-create', null, { purpose: 'configure-strategies' });
  },
  twAgentMode(value) { const form = activeForm(); if (form.type !== 'agent' || !['baseline', 'attack'].includes(value)) return; form.exerciseMode = value; form.attackTemplateId = 'universal'; if (value === 'baseline') form.injectionSurfaceIds = []; clearError(form); refresh(); },
  twEvaluation(value) { if (value !== 'llm') return; const form = activeForm(); if (form.type !== 'agent') return; form.evaluationMode = 'llm'; clearError(form); refresh(); },
  twQuestionFilter(key, value) {
    const form = activeForm(); if (form.type !== 'agent' || !['questionSearch', 'questionBusiness', 'questionRisk', 'questionSource'].includes(key)) return;
    form[key] = value;
    if (key === 'questionSearch') { const node = document.getElementById('tw-question-table'); if (node) node.innerHTML = agentQuestionTable(form); }
    else refresh();
  },
  twQuestionBusiness(value) { actions.twQuestionFilter('questionBusiness', decodeURIComponent(value)); },
  twQuestion(id, enabled) {
    const form = activeForm(); if (form.type !== 'agent') return;
    const selected = new Set(form.questionIds); enabled ? selected.add(id) : selected.delete(id);
    form.questionIds = getAgentQuestions().filter(question => selected.has(question.id)).map(question => question.id); clearError(form); refresh();
  },
  twQuestionsAll(enabled) {
    const form = activeForm(), selected = new Set(form.questionIds);
    filteredAgentQuestions(form).forEach(question => enabled ? selected.add(question.id) : selected.delete(question.id));
    form.questionIds = getAgentQuestions().filter(question => selected.has(question.id)).map(question => question.id); clearError(form); refresh();
  },
  twQuestionsClear() { const form = activeForm(); form.questionIds = []; clearError(form); refresh(); },
  twField(key, value) {
    const form = activeForm();
    if (form.busy || !['name', 'description', 'desc'].includes(key)) return;
    form[key === 'desc' ? 'description' : key] = value;
    if (key === 'name') { form.nameError = ''; const err = document.getElementById('tw-name-error'); if (err) err.hidden = true; document.getElementById('tw-name')?.removeAttribute('aria-invalid'); }
    clearError(form);
  },
  twSelect(key, value) {
    const form = activeForm();
    if (form.busy || !['targetId', 'strategyId', 'judgeId', 'targetModelId', 'attackerId', 'attackTemplateId', 'evaluatorId', 'guardId'].includes(key)) return;
    if (value === CONFIGURE_MODEL_VALUE) {
      const selector = document.getElementById(key === 'judgeId' ? 'tw-judge' : 'tw-target');
      if (selector) selector.value = form[key];
      if (key === 'judgeId' || (form.type === 'model' && key === 'targetId')) {
        const route = routes(form.type);
        configureMoreModels(refresh, '返回任务配置', { returnRoute: () => ({ page: route.page, sub: route.create, param: form.id }) });
      }
      return;
    }
    if (form.type === 'agent' && ['targetId', 'targetModelId'].includes(key) && form[key] !== value) {
      form.injectionSurfaceIds = [];
      form.sandboxRun = null;
      if (form.sandboxValidation?.state === 'running') form.sandboxValidation = null;
    }
    if (['judgeId', 'targetModelId', 'attackerId'].includes(key) && value) value = resolveJudge(value)?.id || value;
    if (form.type === 'agent' && key === 'attackTemplateId') {
      const template = getAgentAttackTemplate(value);
      form.injectionSurfaceIds = store.agentInjectionFiles(store.agentOf(form.targetId)).filter(file => form.injectionSurfaceIds.includes(file.id) && template?.surfaceKinds.includes(file.kind)).map(file => file.id);
    }
    if (key === 'strategyId' && form.type === 'model' && value && !publishedStrategies().some(strategy => strategy.id === value)) return;
    if (key === 'guardId') {
      if (form.type !== 'model' || (value && !store.guards.some(guard => guard.id === value))) return;
      form.guardEnabled = !!value;
      if (!value) form.guardStages = [];
    }
    form[key] = value; clearError(form); refresh();
  },
  twExecution(key, value) {
    const form = activeForm();
    if (form.busy || form.type !== 'model' || !['concurrency', 'maxTokens'].includes(key)) return;
    form[key] = value === '' ? '' : Number(value); clearError(form);
  },
  twSurface(id, enabled) {
    const form = activeForm(); if (form.busy || form.type !== 'agent' || form.exerciseMode !== 'attack' || !targetSandboxPassed(form)) return;
    const files = form.sandboxValidation.discoveredSurfaces;
    form.injectionSurfaceIds = files.filter(file => file.id === id ? enabled : form.injectionSurfaceIds.includes(file.id)).map(file => file.id);
    clearError(form); refresh();
  },
  twGuardStage(stage, enabled) {
    const form = activeForm(); if (form.busy || form.type !== 'model' || !store.GUARD_STAGES.includes(stage)) return;
    form.guardStages = store.GUARD_STAGES.filter(s => s === stage ? enabled : form.guardStages.includes(s)); clearError(form); refresh();
  },
  twStep(step) { const form = activeForm(); if (form.busy || !Number.isInteger(step) || step < 0 || step > form.visited) return; if (step > form.step && !validate(form, { through: step - 1 })) return; form.step = step; clearError(form); refresh(); },
  twNext() { const form = activeForm(); if (form.busy || !validate(form)) return; if (form.step === stepsOf(form.type).length - 1) return save(false); form.step += 1; form.visited = Math.max(form.visited, form.step); refresh(); },
  twPrevious() { const form = activeForm(); if (form.busy) return; form.step = Math.max(0, form.step - 1); clearError(form); refresh(); },
  twSaveDraft: () => save(true), twSave: () => save(false),
  twExit() { const form = activeForm(); if (form.busy) return; const route = routes(form.type); router.nav(route.page, route.list); },
};
