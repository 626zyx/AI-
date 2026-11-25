/* 创建页集中管理配置。配置通过 store 保存，执行数据由任务服务在启动时选择。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { methodConfigurationTable } from '../core/config-detail.js';
import { SURFACE_KIND, RISK_LABEL } from '../domain/constants.js';
import { MODEL_EXECUTION_DEFAULTS, modelExecutionConfiguration, buildModelConfiguration } from '../domain/task-configuration.js';
import { CONFIGURE_MODEL_VALUE, configureModelsOption, configureMoreModels } from '../core/model-config-navigation.js';
import { promptUnsavedChanges } from '../core/unsaved-changes.js';
import { openResourcePicker, listPickerResources } from '../core/resource-picker.js';
import { getAgentQuestions } from '../domain/agent-environments.js';
import * as ResourceTags from '../domain/resource-tags.js';
import { listAgentAttackTemplates, getAgentAttackTemplate } from '../domain/agent-attack-library.js';
import { usableTaskModel } from '../domain/agent-configuration.js';
import { publishedModelEvaluators, getModelEvaluator, SYSTEM_MODEL_EVALUATOR_ID } from '../domain/model-evaluators.js';
import { runSandboxValidation, sandboxValidationIsCurrent, sandboxTargetValidationPassed } from '../domain/sandbox-validation.js';
import { runModelPreflight, modelPreflightPassed, modelPreflightFingerprint } from '../domain/model-preflight.js';
import { sandboxValidationPanel } from '../core/sandbox-validation.js';
import { openTargetWebIde } from './agent-web-ide.js';
import { openEnvironmentPicker } from '../core/environment-picker.js';
import { openApplicationPicker } from '../core/application-picker.js';
import { listApplicationAssets, getApplicationAsset } from '../domain/application-assets.js';
import { resolveApplicationTarget } from '../domain/application-target.js';
import { renderModelComposer, hydrateModelComposition, serializeModelComposition, modelCompositionError } from '../core/model-composer.js';

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
const selectedTarget = form => form.type === 'agent' && form.targetApplicationSnapshot
  ? resolveApplicationTarget(form.targetApplicationSnapshot, store.agents, getApplicationAsset(form.targetApplicationSnapshot.id)).target
  : targetsOf(form.type).find(row => row.id === form.targetId);
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
  form.targetApplicationSnapshot, form.targetModelId, form.exerciseMode, form.attackTemplateId, form.attackerId, form.questionIds, form.evaluationMode,
  form.sandboxValidation?.fingerprint, form.sandboxValidation?.state, form.sandboxValidation?.checkedAt,
  form.attackMode, form.composition, form.modelPreflight?.fingerprint, form.modelPreflight?.state, form.modelPreflight?.checkedAt,
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
  const strategy = form.attackMode==='custom' ? { ...serializeModelComposition(form.composition), name:'自由组合' } : strategyOf(form), guard = store.guards.find(row => row.id === form.guardId);
  const snapshot = form.configurationSnapshot;
  const savedStrategy = form.attackMode!=='custom' && snapshot?.attackMode!=='custom' && snapshot?.strategyId === form.strategyId ? snapshot : null;
  const sameTarget = snapshot && String(snapshot.targetId).replace(/^tgt-/, 'mdl-') === form.targetId;
  const bankCount = (strategy?.banks || []).reduce((sum, ref) => {
    const bank = store.getBank(ref.bankId);
    return sum + (ref.itemIds?.length ?? ref.count ?? bank?.items.length ?? 0);
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
    form.targetApplicationSnapshot = config.targetApplicationSnapshot ? structuredClone(config.targetApplicationSnapshot) : null;
    form.targetId = form.targetApplicationSnapshot ? resolveApplicationTarget(form.targetApplicationSnapshot, store.agents, getApplicationAsset(form.targetApplicationSnapshot.id)).executableId
      : resolveTarget(type, config.targetId, config.targetName)?.id || config.targetId || '';
    form.injectionSurfaceIds = [...(config.injectionSurfaceIds || [])];
    form.strategyId = '';
    const target = selectedTarget(form);
    form.targetModelId = resolveJudge(config.targetModelId || target?.baseModelId, config.targetModelName || target?.baseModelName)?.id || '';
    form.exerciseMode = config.exerciseMode || (config.technique && config.technique !== 'baseline' ? 'attack' : 'baseline');
    form.attackTemplateId = config.attackTemplateId ?? (config.technique && config.technique !== 'baseline' ? config.technique : '');
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
    form.attackMode = config.attackMode==='custom' ? 'custom' : 'strategy';
    form.composition = hydrateModelComposition(config.attackMode==='custom' ? config : {});
    form.guardEnabled = config.guardEnabled ?? !!config.guardId;
    form.guardId = form.guardEnabled ? config.guardId || '' : '';
    form.guardStages = [...(config.guardStages || [])];
    form.judgeId = resolveJudge(config.judgeId, config.judgeName)?.id || config.judgeId || '';
    form.evaluatorId = config.evaluatorId ?? (id || preset.sourceTaskId || preset.id ? SYSTEM_MODEL_EVALUATOR_ID : '');
    form.concurrency = config.concurrency ?? MODEL_EXECUTION_DEFAULTS.concurrency;
    form.maxTokens = config.maxTokens ?? MODEL_EXECUTION_DEFAULTS.maxTokens;
    form.modelPreflight = config.modelPreflight?.state === 'running' ? null : config.modelPreflight ? structuredClone(config.modelPreflight) : null;
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
  if (!['draft', 'ready'].includes(task.status)) return UI.toast('任务已经启动，请复制创建新任务');
  const route = routes(type);
  router.nav(route.page, route.create, id, { onCommit: () => forms.set(type, createForm(type, task, id)) });
}
export function copyTaskConfig(id, type = 'model') {
  try {
    const copiedId = store.copyTask(id, type), route = routes(type);
    UI.closeMenus();
    UI.closeDrawer(); UI.closeModal();
    router.nav(route.page, route.list, copiedId);
    UI.toast('配置已复制为独立草稿');
    return copiedId;
  } catch (error) { UI.toast(error.message); }
}

function scopeText(config, type) {
  if (type === 'agent') return config.total ? `${config.total} 个环境` : '未选择';
  if (!config.methods.length) return '未选择';
  return `${config.bankCount} 题 × ${config.methods.length} 种方法 · ${config.total} 个攻防单元`;
}
function agentFormInput(form) {
  return { targetId: form.targetId, targetApplicationSnapshot: form.targetApplicationSnapshot ? structuredClone(form.targetApplicationSnapshot) : null, targetModelId: form.targetModelId, exerciseMode: form.exerciseMode,
    attackTemplateId: form.attackTemplateId, attackerId: form.attackerId, questionIds: form.questionIds,
    evaluationMode: 'llm', judgeId: form.judgeId, sandboxValidationRequired: true, sandboxValidation: form.sandboxValidation,
    injectionSurfaceIds: form.exerciseMode === 'attack' ? form.injectionSurfaceIds : [] };
}
const modelCatalog = () => ({models:store.models,strategies:store.strategies,banks:store.banks,guards:store.guards,methods:store.methods});
function modelFormInput(form) {
  return {targetId:form.targetId,strategyId:form.attackMode==='custom'?'':form.strategyId,judgeId:form.judgeId,evaluatorId:form.evaluatorId,
    attackMode:form.attackMode,...(form.attackMode==='custom'?serializeModelComposition(form.composition):{}),
    guardEnabled:form.guardEnabled,guardId:form.guardEnabled?form.guardId:null,guardStages:form.guardEnabled?form.guardStages:[],
    concurrency:form.concurrency,maxTokens:form.maxTokens,modelPreflightRequired:true,modelPreflight:form.modelPreflight};
}
function preflightConfiguration(form) { return buildModelConfiguration({...modelFormInput(form),modelPreflightRequired:false},modelCatalog()); }
function modelValidationPassed(form) { try { return modelPreflightPassed(form.modelPreflight,preflightConfiguration(form),modelCatalog()); } catch { return false; } }
function modelValidationPanel(form) {
  let stale=false;
  if(form.modelPreflight?.fingerprint) { try { stale=form.modelPreflight.fingerprint!==modelPreflightFingerprint(preflightConfiguration(form),modelCatalog()); } catch { stale=true; } }
  const running=form.modelPreflight?.state==='running'&&!stale;
  const report=form.modelPreflight||{kind:'model-preflight',state:'idle',steps:[],logs:[]};
  return `<p class="tw-note">用一道题目逐一验证全部攻击方法，并覆盖所选靶标、辅助模型、防护位置、评估器和裁判模型。验证通过后才能开始；配置变更后需重新验证。</p><div class="tw-sandbox-actions">${button(running?'验证中…':form.modelPreflight?'重新验证':'开始验证',{kind:'primary',onclick:'App.twValidateModel()',disabled:form.busy||running})}</div>${sandboxValidationPanel(report,{title:'全配置最小验证',stale})}`;
}
function syncModelValidation(form) {
  if(form.type!=='model')return;
  const panel=document.getElementById('tw-model-preflight');if(panel)panel.innerHTML=modelValidationPanel(form);
  const passed=modelValidationPassed(form);
  const start=document.querySelector('.tw-footer-actions .primary');if(start)start.disabled=form.busy||!passed;
  const hint=document.getElementById('tw-validation-hint');if(hint)hint.textContent=passed?'最小演示验证已通过':form.modelPreflight?'当前配置未通过验证，请重新验证':'请先完成最小验证，再开始演练';
}
function targetSandboxInput(form) {
  return { target: form.targetApplicationSnapshot ? resolveApplicationTarget(form.targetApplicationSnapshot, store.agents, getApplicationAsset(form.targetApplicationSnapshot.id)).target : store.agentOf(form.targetId), model: store.models.find(model => model.id === form.targetModelId) || null };
}
function targetSandboxPassed(form) {
  return sandboxTargetValidationPassed(form.sandboxValidation, targetSandboxInput(form));
}
function agentResourceSelect(id, label, key, rows, selected, placeholder) {
  return select(id, label, key, rows.map(row => ({ id: row.id, name: row.kind === 'agent' ? `${row.displayName || row.name} · ${displayVersion(row)}` : row.displayName || row.name })), selected, placeholder);
}
function pickerField(id, label, key, rows, value, placeholder, note = '', showDetails = true) {
  const chosen = rows.find(row => row.id === value);
  return `<div class="field">${label ? `<label for="${id}">${UI.esc(label)} <span class="req">*</span></label>` : ''}
    <button type="button" aria-label="${UI.esc(label || placeholder)}" id="${id}" value="${UI.esc(value || '')}" class="tw-resource-field${chosen ? ' has-value' : ''}" onclick="App.twPick('${key}')"><span>${UI.esc(chosen?.displayName || chosen?.name || placeholder)}</span><span class="tw-resource-action">${chosen ? '更换' : '选择'}</span></button>
    ${chosen && showDetails ? `<small class="tw-note">${UI.esc(chosen.apiModel || chosen.image || chosen.desc || '')}${chosen.kind==='agent'&&chosen.assetVersion ? ` · ${UI.esc(displayVersion(chosen))}` : ''}</small>` : ''}${note ? `<p class="tw-note">${UI.esc(note)}</p>` : ''}</div>`;
}
function taskNameFields(form) {
  return `<div class="field"><label for="tw-name">任务名称 <span class="req">*</span></label><input id="tw-name" maxlength="100" value="${UI.esc(form.name)}" placeholder="例如：业务交付与保密验证" oninput="App.twField('name',this.value)" aria-describedby="tw-name-error"><span id="tw-name-error" class="tw-error" ${form.nameError ? '' : 'hidden'}>${UI.esc(form.nameError)}</span></div>
    <div class="field"><label for="tw-description">任务描述</label><textarea id="tw-description" rows="2" maxlength="1000" placeholder="选填，说明本次演练的目的" oninput="App.twField('description',this.value)">${UI.esc(form.description)}</textarea></div>`;
}
function agentExerciseFields(form) {
  return `<fieldset class="tw-choice-group" aria-label="演练方式"><div class="tw-mode-cards">
      <label class="${form.exerciseMode === 'baseline' ? 'selected' : ''}"><input type="radio" name="tw-exercise-mode" value="baseline" ${form.exerciseMode === 'baseline' ? 'checked' : ''} onchange="App.twAgentMode(this.value)"><span><strong>基础安全演练</strong><small>直接执行业务任务，观察完成情况与安全边界</small></span></label>
      <label class="${form.exerciseMode === 'attack' ? 'selected' : ''}"><input type="radio" name="tw-exercise-mode" value="attack" ${form.exerciseMode === 'attack' ? 'checked' : ''} onchange="App.twAgentMode(this.value)"><span><strong>加入攻击</strong><small>请选择攻击者</small></span></label>
      </div></fieldset>${form.exerciseMode === 'attack' ? `<div class="tw-field-grid tw-agent-attacker">${pickerField('tw-attack-template', '攻击者', 'attackTemplateId', listAgentAttackTemplates().filter(row => row.status === 'published'), form.attackTemplateId, '请选择攻击者')}${pickerField('tw-attacker', '攻击模型', 'attackerId', judges(), form.attackerId, '请选择攻击模型')}</div>` : ''}`;
}
function targetSandboxPanel(form) {
  const stale = !!form.sandboxValidation && !sandboxValidationIsCurrent(form.sandboxValidation, targetSandboxInput(form));
  const running = form.sandboxValidation?.state === 'running' && !stale;
  return `<div class="tw-sandbox-actions">${button(running ? '验证中…' : form.sandboxValidation ? '重新验证' : '开始验证', { kind: 'primary', onclick: 'App.twValidateSandbox()', disabled: form.busy || running || (!form.targetId && !form.targetApplicationSnapshot) || !form.targetModelId })}</div>${sandboxValidationPanel(form.sandboxValidation, { title: '靶标运行验证', stale })}`;
}
function applicationTargetField(form) {
  const snapshot = form.targetApplicationSnapshot, target = selectedTarget(form), name = snapshot?.name || target?.displayName || target?.name;
  return `<div class="field"><label for="tw-target">靶标 <span class="req">*</span></label><button type="button" id="tw-target" aria-label="选择靶标" value="${UI.esc(form.targetId || '')}" data-application-id="${UI.esc(snapshot?.id || '')}" class="tw-resource-field${name ? ' has-value' : ''}" onclick="App.twPick('targetId')"><span>${UI.esc(name || '请选择靶标')}</span><span class="tw-resource-action">${name ? '更换' : '选择'}</span></button></div>`;
}
function agentTargetStep(form) {
  return `<div class="tw-field-grid">${applicationTargetField(form)}${pickerField('tw-target-model', '配置基模', 'targetModelId', judges(), form.targetModelId, '请选择配置基模')}</div>`
    + `<section id="tw-sandbox-panel" class="tw-agent-subsection">${targetSandboxPanel(form)}</section>`
    + (form.exerciseMode === 'attack' && targetSandboxPassed(form) ? `<section class="tw-agent-subsection"><h3>选择攻击面</h3>${injectionRange(form)}</section>` : '');
}
function classifiedAgentQuestions() {
  const rows=getAgentQuestions();
  ResourceTags.registerResourceSeeds('environment',rows.map(question=>({id:question.id,title:question.title,seeds:{business:question.business?[question.business]:[],risk:question.riskLabels.map(key=>RISK_LABEL[key]?.label||key)}})));
  const classifications=new Map(ResourceTags.getResourcesTags('environment',rows.map(question=>question.id)).map(row=>[row.id,row]));
  return rows.map(question=>({...question,classification:classifications.get(question.id)}));
}
function filteredAgentQuestions(form,questions=classifiedAgentQuestions()) {
  const query = form.questionSearch.trim().toLowerCase();
  return questions.filter(question => (!query || `${question.title} ${question.taskId} ${question.goal}`.toLowerCase().includes(query))
    && (!form.questionBusiness || question.classification.business.includes(form.questionBusiness))
    && (!form.questionRisk || question.classification.risk.includes(form.questionRisk))
    && (!form.questionSource || question.source === form.questionSource));
}
function agentQuestionTable(form,questions) {
  const rows = filteredAgentQuestions(form,questions), allSelected = rows.length && rows.every(question => form.questionIds.includes(question.id));
  return `<div class="tw-question-list"><table class="table"><thead><tr><th><input type="checkbox" aria-label="选择当前筛选的全部环境" ${allSelected ? 'checked' : ''} onchange="App.twQuestionsAll(this.checked)"></th><th>环境名称</th><th>来源</th><th>业务类型</th><th>风险场景</th><th>评估定义</th></tr></thead><tbody>${rows.map(question => {const risks=question.classification.names.risk;return `<tr class="${form.questionIds.includes(question.id) ? 'selected' : ''}"><td><input type="checkbox" aria-label="选择 ${UI.esc(question.title)}" ${form.questionIds.includes(question.id) ? 'checked' : ''} onchange="App.twQuestion('${UI.esc(question.id)}',this.checked)"></td><td><strong title="${UI.esc(question.title)}">${UI.esc(question.title)}</strong><small>${UI.esc(question.taskId)}</small></td><td>${question.source === 'system' ? '系统' : '自建'}</td><td>${UI.esc(question.classification.names.business.join('、')||'—')}</td><td><div class="tw-risk-tags">${UI.esc(risks.slice(0,3).join('、')||'—')}${risks.length > 3 ? `<span title="${UI.esc(risks.join('、'))}" aria-label="查看全部风险场景">、…</span>` : ''}</div></td><td><span class="tw-definition">${question.hasLlm ? 'LLM 已配置' : 'LLM 缺失'}</span></td></tr>`;}).join('') || '<tr><td colspan="6" class="empty-cell">没有符合条件的已发布环境</td></tr>'}</tbody></table></div>`;
}
function agentQuestionFields(form) {
  return `<div class="tw-environment-select">${button('选择环境', { onclick: 'App.twPickEnvironments()' })}<span class="tw-selection-count">已选 <strong id="tw-selected-count">${form.questionIds.length}</strong> 个环境</span></div>`;
}
function objectStep(form, config) {
  const rows = targetsOf(form.type), chosen = selectedTarget(form);
  const unique = [...new Set(rows.map(assetKey))].map(key => {
    const versions = rows.filter(row => assetKey(row) === key).sort((a, b) => versionNumber(b) - versionNumber(a));
    return versions.find(row => row.id === form.targetId) || versions[0];
  });
  const versions = chosen ? rows.filter(row => assetKey(row) === assetKey(chosen)).sort((a, b) => versionNumber(b) - versionNumber(a)) : [];
  const object = `<div class="tw-field-grid">${pickerField('tw-target', '被测资产', 'targetId', rows, form.targetId, '请选择靶标')}${field('模型标识', chosen ? plain(chosen.apiModel) : '选择模型后显示')}</div>`;
  return section('任务与对象', `<div class="tw-fields">
    <div class="field"><label for="tw-name">任务名称 <span class="req">*</span></label>
      <input id="tw-name" type="text" maxlength="100" value="${UI.esc(form.name)}" placeholder="为本次演练起一个名称" autocomplete="off" aria-describedby="tw-name-error" ${form.nameError ? 'aria-invalid="true"' : ''} oninput="App.twField('name',this.value)" />
      <span id="tw-name-error" class="tw-error" ${form.nameError ? '' : 'hidden'}>${UI.esc(form.nameError)}</span></div>
    <div class="field"><label for="tw-description">任务描述</label><textarea id="tw-description" rows="3" maxlength="1000" placeholder="选填，说明本次演练的目的" oninput="App.twField('description',this.value)">${UI.esc(form.description)}</textarea></div>
    ${object}${form.type === 'agent' ? injectionRange(form) : ''}</div>`);
}
function injectionRange(form) {
  if ((!form.targetId && !form.targetApplicationSnapshot) || !targetSandboxPassed(form)) return '';
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
  return `<div class="tw-strategy-select">${pickerField('tw-strategy','','strategyId',publishedStrategies(),form.strategyId,'请选择攻击策略','',false)}</div>${chosen?'':unavailableStrategyNotice(form)}`;
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
  const chosen = store.guards.find(row => row.id === form.guardId);
  return section('选择防护策略', `<div class="tw-fields"><div class="field"><label for="tw-guard">防护策略</label><div class="tw-guard-control"><button type="button" id="tw-guard" value="${UI.esc(form.guardEnabled ? form.guardId : '')}" class="tw-resource-field" onclick="App.twPick('guardId')"><span>${UI.esc(form.guardEnabled && chosen ? chosen.name : '不启用')}</span><span class="tw-resource-action">${form.guardEnabled ? '更换' : '选择防护策略'}</span></button>${form.guardEnabled ? button('不启用', { onclick: "App.twSelect('guardId','')", kind:'link' }) : ''}</div></div></div>${form.guardEnabled ? `<fieldset class="tw-choice-group"><legend>防护位置 <span class="req">*</span></legend><div class="tw-choices">
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
      ['演练对象', plain(config.targetName)], ['模型标识', plain(selectedTarget(form)?.apiModel)], ['攻击策略', plain(config.strategyName)],
      ['测试范围', UI.esc(scopeText(config, form.type))],
      ...(form.type === 'agent' ? [['注入面范围', config.technique === 'baseline' ? '不注入' : (config.requestedSurfaces || []).map(file => UI.esc(file.path)).join('<br>') || '未选择']] : [['防护策略', UI.esc(guardText(config))]]),
      ['裁判模型', plain(config.judgeName)], ...(form.type === 'model' ? [['评估器', plain(config.evaluatorName)], ['评估指标', '攻击成功率（ASR）']] : []),
      ...(form.type === 'model' ? [['执行配置', `并发数 ${plain(config.concurrency)} · 单次输出上限 ${plain(config.maxTokens)} tokens`]] : []),
      ['任务描述', form.description ? UI.esc(form.description) : '—'],
    ])}`);
}
function summary(form, config) {
  if (form.type === 'agent') return UI.card('本次演练', `<dl class="tw-summary"><div><dt>靶标</dt><dd>${plain(config.targetName)}</dd></div><div><dt>配置基模</dt><dd>${plain(config.targetModelName)}</dd></div><div><dt>演练方式</dt><dd>${plain(config.techniqueName)}</dd></div>${form.exerciseMode === 'attack' ? `<div><dt>攻击模型</dt><dd>${plain(config.attackerName)}</dd></div><div><dt>有效注入面</dt><dd>${form.injectionSurfaceIds.length} 个范围</dd></div>` : ''}<div><dt>环境</dt><dd>${form.questionIds.length} 个已选</dd></div><div><dt>统一评估</dt><dd>LLM 评估 · ${plain(config.judgeName)}</dd></div></dl><p class="tw-aside-note">配置与历史证据分别保存。演示不会发起新的模型调用。</p>`);
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

function modelTaskPage(form,config,title) {
  const strategy=strategyOf(form);
  const navigateModels=()=>{const route=routes('model');configureMoreModels(refresh,'返回任务配置',{returnRoute:()=>({page:route.page,sub:route.create,param:form.id})});};
  const composition=form.attackMode==='custom'
    ? renderModelComposer('task-model-'+(form.id||'new'),{value:form.composition,onChange:(value,meta={})=>{form.composition=value;clearError(form);if(meta.render!==false)refresh();},onConfigureModels:navigateModels})
    : strategy ? `<div data-tw-strategy-details>${renderModelComposer('task-strategy-'+strategy.id,{value:hydrateModelComposition({...strategy,methods:config.methods,banks:config.banks||strategy.banks}),readOnly:true,onChange:refresh})}</div>` : '';
  const blocks=[
    ['basic','基本信息',`<div class="tw-fields tw-basic-fields">${taskNameFields(form)}</div>`],
    ['target','靶标配置',`<div class="tw-single-picker">${pickerField('tw-target','','targetId',targets(),form.targetId,'请选择靶标','',false)}</div>`],
    ['attack','攻击配置（红队）',`<div class="tw-attack-modes" role="radiogroup" aria-label="攻击配置方式">${[['strategy','从攻击策略库中选择'],['custom','自由组合']].map(([mode,label])=>`<label><input type="radio" name="tw-attack-mode" value="${mode}" ${form.attackMode===mode?'checked':''} onchange="App.twAttackMode(this.value)">${label}</label>`).join('')}</div>${form.attackMode==='strategy'?strategyDropdown(form):''}${composition}`],
    ['guard','防护配置（蓝队）',guardStep(form,config).replace('<section class="tw-section"><h2>选择防护策略</h2>','').replace(/<\/section>$/,'')],
    ['evaluation','评估配置',`<div class="tw-field-grid">${pickerField('tw-evaluator','评估器','evaluatorId',publishedModelEvaluators(),form.evaluatorId,'请选择评估器','',false)}${pickerField('tw-judge','裁判模型','judgeId',judges(),form.judgeId,'请选择裁判模型')}</div>`],
    ['execution','运行配置',executionStep(form).replace('<section class="tw-section"><h2>执行配置</h2>','').replace(/<\/section>$/,'')],
    ['preflight','最小验证',`<div id="tw-model-preflight" class="tw-model-preflight">${modelValidationPanel(form)}</div>`],
  ];
  return singleTaskPage(form,title,blocks,`${config.bankCount||0} 道题目 × ${config.methods.length} 种方法 · ${config.total||0} 个单元`);
}
function agentTaskPage(form,config,title) {
  const blocks=[
    ['basic','基本信息',`<div class="tw-fields tw-basic-fields">${taskNameFields(form)}</div>`],
    ['mode','演练方式',agentExerciseFields(form)],
    ['target','靶标配置',agentTargetStep(form)],
    ['environment','环境选择',agentQuestionFields(form)],
    ['evaluation','评估配置',`<div class="tw-field-grid">${pickerField('tw-judge','裁判模型','judgeId',judges(),form.judgeId,'请选择裁判模型')}</div>`],
  ];
  return singleTaskPage(form,title,blocks,`${config.total||0} 个环境 · ${form.exerciseMode==='attack'?'加入攻击':'基础安全演练'}`);
}
function singleTaskPage(form,title,blocks,scope) {
  return `${UI.backBtn()}${UI.pageHead(title)}<div class="tw-root tw-single${form.type==='agent'?' tw-agent-single':''}" aria-label="${form.type==='agent'?'Agent':'模型'}任务配置"><nav class="tw-anchor-nav" aria-label="配置目录">${blocks.map(([id,label])=>`<button type="button" onclick="App.twAnchor('${id}')">${label}</button>`).join('')}</nav><form class="tw-single-form" onsubmit="event.preventDefault();App.twStart()" novalidate aria-busy="${form.busy}"><div class="tw-content" ${form.busy?'inert':''}>${blocks.map(([id,label,body])=>`<section class="tw-config-section" id="tw-section-${id}" tabindex="-1"><h2>${label}</h2>${body}</section>`).join('')}<p class="tw-error tw-save-error" id="tw-save-error" role="alert" ${form.error?'':'hidden'}>${UI.esc(form.error)}</p></div><div class="tw-footer"><span class="tw-scope">${UI.esc(scope)}${form.type==='model'?`<small id="tw-validation-hint" class="tw-validation-hint">${modelValidationPassed(form)?'最小演示验证已通过':'请先完成最小验证，再开始演练'}</small>`:''}</span><div class="tw-footer-actions">${button('取消',{onclick:'App.twExit()',disabled:form.busy})}${button('保存草稿',{onclick:'App.twSaveDraft()',disabled:form.busy})}${button(form.busy?'正在启动…':'开始演练',{kind:'primary',onclick:'App.twStart()',disabled:form.busy||(form.type==='agent'?!targetSandboxPassed(form):!modelValidationPassed(form))})}</div></div></form></div>`;
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
  if(type==='model')return modelTaskPage(form,config,title);
  return agentTaskPage(form,config,title);
}
function validate(form, { draft = false, through = stepsOf(form.type).length-1 } = {}) {
  const name = form.name.trim();
  form.nameError = !name && !draft ? '请输入任务名称'
    : name.length > 100 ? '任务名称不能超过 100 个字符'
    : name && tasksOf(form.type).some(t => t.id !== form.id && t.name.trim().toLowerCase() === name.toLowerCase()) ? '任务名称已存在，请使用新的名称' : '';
  let error = form.nameError, errorStep = 0;
  if (!error && !draft && form.type === 'model') {
    const checks = [
      [0, targets().some(m => m.id === form.targetId), '请选择靶标'],
      [1, form.attackMode==='custom' || !!strategyOf(form), '请选择已发布的攻击策略'],
      [1, form.attackMode!=='custom' || form.composition.methods.length>0, '请至少选择一种攻击方法'],
      [1, form.attackMode!=='custom' || serializeModelComposition(form.composition).banks.length>0, '请至少选择一道已发布题目'],
      [1, !form.guardEnabled || store.guards.some(guard => guard.id === form.guardId), '请选择防护模型'],
      [1, !form.guardEnabled || form.guardStages.some(stage => store.GUARD_STAGES.includes(stage)), '请选择至少一个防护位置'],
      [2, judges().some(m => m.id === form.judgeId), '请选择裁判模型'],
      [2, publishedModelEvaluators().some(row => row.id === form.evaluatorId), '请选择已发布的评估器'],
    ];
    const invalid = checks.find(([step, valid]) => step <= through && !valid);
    if (invalid) [errorStep, , error] = invalid;
    if(!error&&form.attackMode==='custom')error=modelCompositionError(form.composition)||'';
    if (!error && through >= 2) {
      try { modelExecutionConfiguration(form); }
      catch (executionError) { error = executionError.message; errorStep = 2; }
    }
    if (!error && through >= 3 && !modelValidationPassed(form)) { error = '请先完成当前全部配置的最小演示验证'; errorStep = 3; }
  }
  if (!error && !draft && form.type === 'agent') {
    const checks = [
      [0, form.exerciseMode === 'baseline' || listAgentAttackTemplates().some(row => row.id === form.attackTemplateId && row.status === 'published'), '请选择已发布的攻击者'],
      [0, form.exerciseMode === 'baseline' || judges().some(model => model.id === form.attackerId), '请选择可用的攻击模型'],
      [1, !!form.targetApplicationSnapshot || agentTargets().some(agent => agent.id === form.targetId), '请选择已接入的靶标智能体'],
      [1, judges().some(model => model.id === form.targetModelId), '请选择可用的配置基模'],
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
  if (error) { form.step = form.type==='model'?0:errorStep; refresh(); if (form.nameError) document.getElementById('tw-name')?.focus(); return false; }
  return true;
}
async function persistForm(form, draft) {
  if (form.busy || !validate(form, { draft, through: stepsOf(form.type).length - 1 })) return false;
  form.busy = true; refresh();
  try {
    const config = form.type === 'agent' ? agentFormInput(form) : modelFormInput(form);
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
  router.nav(route.page, draft ? route.list : route.detail, form.id, { replace: true });
}

async function startConfiguredTask(){
  const form=activeForm();if(!await persistForm(form,false))return;
  form.busy=true;refresh();
  try{await store.startTask(form.id,form.type);forms.delete(form.type);const route=routes(form.type);router.nav(route.page,route.detail,form.id,{replace:true});}
  catch(error){form.error=error.message;form.busy=false;refresh();}
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
    if (!['configure-models','configure-target'].includes(transition.options.purpose)) forms.delete(type);
    transition.proceed();
  };
  if (!hasUnsavedChanges(form)) {
    if (!['configure-models','configure-target'].includes(transition.options.purpose)) forms.delete(type);
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
  syncModelValidation(form);
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
function choiceRows(key) {
  return key === 'attackTemplateId' ? listAgentAttackTemplates().filter(row => row.status === 'published')
    : key === 'evaluatorId' ? publishedModelEvaluators() : key === 'guardId' ? store.guards : publishedStrategies();
}
function renderChoicePicker() {
  const { key, query, chosen } = choicePicker;
  const shown = choiceRows(key).filter(row => `${row.name} ${row.desc || row.description || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const count = Math.max(1,Math.ceil(shown.length/UI.PAGE_SIZE)), page = Math.min(count,choicePicker.page||1);
  choicePicker.page=page;
  const pg = {page,count,total:shown.length,slice:shown.slice((page-1)*UI.PAGE_SIZE,page*UI.PAGE_SIZE)};
  const columns = [
    {title:'', width:'42px', render:row=>`<span data-strategy-id="${UI.esc(row.id)}"><input type="radio" name="tw-picker-value" aria-label="选择 ${UI.esc(row.name)}" value="${UI.esc(row.id)}" ${chosen === row.id ? 'checked' : ''} onchange="App.twPickChoice(this.value)"></span>`},
    {title:key==='strategyId'?'策略名称':key==='attackTemplateId'?'攻击者名称':key==='guardId'?'防护策略':'评估器名称', render:row=>`<strong>${UI.esc(row.name)}</strong>`},
    ...(key === 'strategyId' ? [
      {title:'攻击方法', render:row=>UI.esc((row.methods||[]).map(ref=>ref.name||store.methods.find(method=>(ref.key||ref.methodKey)&&(method.key===ref.key||method.key===ref.methodKey||method.id===ref.key||method.id===ref.methodKey))?.name||ref.key||ref.methodKey||'—').join('、')||'—')},
      {title:'攻击题目', cls:'num', render:row=>`${(row.banks||[]).reduce((sum,ref)=>sum+(ref.itemIds?.length??ref.count??store.getBank(ref.bankId)?.items.length??0),0)} 题`},
    ] : key === 'guardId' ? [
      {title:'防护模型', render:row=>UI.esc(row.model||'—')},
      {title:'说明', render:row=>UI.esc(row.desc||row.description||'—')},
    ] : key === 'attackTemplateId' ? [
      {title:'说明', render:row=>UI.esc(row.desc||'—')},
      {title:'攻击面',render:row=>UI.esc((row.surfaceKinds||[]).map(kind=>SURFACE_KIND[kind]||kind).join('、')||'—')},
    ] : [
      {title:'评估指标',render:()=> '攻击成功率（ASR）'},
      {title:'来源',render:row=>row.source==='system'?'系统':'自建'},
    ]),
    {title:'状态',width:'90px',render:()=>UI.badge('已发布')},
  ];
  return UI.table(columns,pg.slice,'没有符合条件的资源') + UI.pager(pg,'App.twPickPage({p})');
}
export const actions = {
  editTaskConfig, copyTaskConfig,
  async twOpenSandboxIDE(){
    const form=activeForm();if(form.type!=='agent'||form.busy)return;
    const input=targetSandboxInput(form);
    if(!input.target||!input.model)return UI.toast('请先选择靶标与基模');
    if(!await persistForm(form,true))return;
    router.nav('agent','ag-task-create',form.id,{replace:true,purpose:'locate-task-draft'});
    openTargetWebIde({input,report:form.sandboxValidation,onResult:report=>{
      if(!sandboxValidationIsCurrent(report,targetSandboxInput(form)))return;
      form.sandboxValidation=report;
      form.injectionSurfaceIds=report.state==='passed'?form.injectionSurfaceIds.filter(id=>report.discoveredSurfaces.some(surface=>surface.id===id)):[];
    },onReturn:()=>router.nav('agent','ag-task-create',form.id)});
  },
  twPick(key) {
    const form = activeForm(); if (form.busy) return;
    if (key === 'targetId' && form.type === 'agent') {
      const current = form.targetApplicationSnapshot || listApplicationAssets().find(asset => resolveApplicationTarget(asset, store.agents, asset).executableId === form.targetId && form.targetId);
      openApplicationPicker({ value: current || null, onSelect: snapshot => {
        if (forms.get('agent') !== form || form.busy || router.state().sub !== routes('agent').create) return;
        const resolved = resolveApplicationTarget(snapshot, store.agents, getApplicationAsset(snapshot.id));
        const changed = JSON.stringify(form.targetApplicationSnapshot) !== JSON.stringify(resolved.applicationSnapshot) || form.targetId !== resolved.executableId;
        form.targetApplicationSnapshot = resolved.applicationSnapshot;
        form.targetId = resolved.executableId || '';
        if (changed) { form.injectionSurfaceIds = []; form.sandboxRun = null; if (form.sandboxValidation?.state === 'running') form.sandboxValidation = null; }
        clearError(form); refresh();
      } });
      return;
    }
    if (['attackTemplateId', 'strategyId', 'evaluatorId', 'guardId'].includes(key)) {
      choicePicker = { key, query: '', chosen: form[key] || '', form, page:1 };
      UI.modal(({ strategyId: '选择攻击策略', attackTemplateId: '选择攻击者', evaluatorId: '选择评估器', guardId:'选择防护策略' })[key], `<div class="tw-resource-search"><input type="search" id="tw-pick-search" placeholder="搜索名称" aria-label="搜索资源" oninput="App.twPickSearch(this.value)"></div><div id="tw-choice-table">${renderChoicePicker()}</div>`, button('取消', { onclick: 'UI.closeModal()' }) + button('确认选择', { kind: 'primary', onclick: 'App.twPickConfirm()', disabled: !choiceRows(key).some(row => row.id === choicePicker.chosen) }).replace('<button ', '<button id="tw-choice-confirm" '), { wide: true });
      return;
    }
    if (!['targetId', 'targetModelId', 'attackerId', 'judgeId'].includes(key)) return;
    const title = ({ targetId: form.type === 'agent' ? '选择靶标' : '选择靶标模型', targetModelId: '选择配置基模', attackerId: '选择攻击模型', judgeId: '选择裁判模型' })[key];
    openResourcePicker({ kind: key === 'targetId' && form.type === 'agent' ? 'agent' : 'model', allowUnverified: key === 'targetId' && form.type === 'agent', value: form[key], title,
      onSelect: resource => { if (forms.get(form.type) !== form || form.busy || router.state().sub !== routes(form.type).create) return; if (key !== 'targetId' && !usableTaskModel(resource)) return UI.toast('该资源不支持本次模型调用'); actions.twSelect(key, resource.id); } });
  },
  twPickSearch(value) { if (!choicePicker) return; choicePicker.query = value; choicePicker.page=1; document.getElementById('tw-choice-table').innerHTML = renderChoicePicker(); },
  twPickPage(page) { if (!choicePicker) return; choicePicker.page=Math.max(1,Number(page)||1); const host=document.getElementById('tw-choice-table'); if(host)host.innerHTML=renderChoicePicker(); },
  twPickChoice(value) { if (!choicePicker) return; choicePicker.chosen = value; const confirm = document.getElementById('tw-choice-confirm'); if (confirm) confirm.disabled = !choiceRows(choicePicker.key).some(row => row.id === value); },
  twPickConfirm() { if (!choicePicker || !document.getElementById('modal')?.classList.contains('open') || choicePicker.form !== forms.get(typeOfRoute()) || router.state().sub !== routes(typeOfRoute()).create) return; if (!choicePicker.chosen) return UI.toast('请选择一项资源'); const { key, chosen } = choicePicker; if (!choiceRows(key).some(row => row.id === chosen)) return UI.toast('该资源已不可用，请重新选择'); choicePicker = null; UI.closeModal(); actions.twSelect(key, chosen); },
  async twValidateModel() {
    const form=activeForm();if(form.type!=='model'||form.busy)return;
    let config;
    try { config=preflightConfiguration(form); }
    catch(error) {
      form.modelPreflight={kind:'model-preflight',mode:'demo',actualExecuted:false,state:'failed',checkedAt:new Date().toISOString(),blockingIssues:[error.message],logs:[{message:error.message}],steps:[{id:'configuration',name:'检查完整配置',phase:'全配置最小验证',state:'failed',detail:error.message,remedy:'补齐或修正上方配置后重新验证'}]};
      syncModelValidation(form);return form.modelPreflight;
    }
    const fingerprint=modelPreflightFingerprint(config,modelCatalog());
    if(form.modelPreflight?.state==='running'&&form.modelPreflight.fingerprint===fingerprint)return;
    const token={};form.modelPreflightRun=token;clearError(form);
    const active=()=>forms.get('model')===form&&router.state().sub===routes('model').create;
    const current=()=>{try{return form.modelPreflightRun===token&&fingerprint===modelPreflightFingerprint(preflightConfiguration(form),modelCatalog());}catch{return false;}};
    const report=await runModelPreflight(config,modelCatalog(),{onUpdate:progress=>{if(!current())return;form.modelPreflight=progress;if(active())syncModelValidation(form);}});
    if(current()){form.modelPreflight=report;if(active())syncModelValidation(form);}
    return report;
  },
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
        if (node) node.innerHTML = targetSandboxPanel(form);
        const start = document.querySelector('.tw-footer-actions .primary'); if (start) start.disabled = !targetSandboxPassed(form);
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
  async twConfigureStrategy() {
    const form=activeForm();if(form.busy||!await persistForm(form,true))return;
    router.nav('exercise','task-create',form.id,{replace:true,purpose:'locate-task-draft'});
    router.nav('strategy', 'strategy-create', null, { purpose: 'configure-strategies' });
  },
  twAttackMode(mode){const form=activeForm();if(form.type!=='model'||form.busy||!['strategy','custom'].includes(mode))return;form.attackMode=mode;clearError(form);refresh();},
  twAnchor(id){const section=document.getElementById('tw-section-'+id);section?.scrollIntoView?.({behavior:'smooth',block:'start'});section?.focus({preventScroll:true});},
  twAgentMode(value) { const form = activeForm(); if (form.type !== 'agent' || !['baseline', 'attack'].includes(value)) return; form.exerciseMode = value; if (value === 'baseline') form.injectionSurfaceIds = []; clearError(form); refresh(); },
  twEvaluation(value) { if (value !== 'llm') return; const form = activeForm(); if (form.type !== 'agent') return; form.evaluationMode = 'llm'; clearError(form); refresh(); },
  twPickEnvironments() {
    const form = activeForm(); if (form.type !== 'agent' || form.busy) return;
    openEnvironmentPicker({ value: [...form.questionIds], onConfirm(ids) {
      if (forms.get('agent') !== form || form.busy) return;
      form.questionIds = [...new Set(ids)]; clearError(form); refresh();
    } });
  },
  twQuestionFilter(key, value) {
    const form = activeForm(); if (form.type !== 'agent' || !['questionSearch', 'questionBusiness', 'questionRisk', 'questionSource'].includes(key)) return;
    if(value&&['questionBusiness','questionRisk'].includes(key)){
      const dimension=key==='questionBusiness'?'business':'risk',name=dimension==='risk'?(RISK_LABEL[value]?.label||value):value;
      value=ResourceTags.listTags(dimension).find(tag=>tag.id===value||tag.name===name)?.id||'';
    }
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
    if (form.type === 'agent' && key === 'targetId' && form.targetApplicationSnapshot) { form.targetApplicationSnapshot = null; form.injectionSurfaceIds = []; form.sandboxRun = null; }
    if (form.type === 'agent' && ['targetId', 'targetModelId'].includes(key) && form[key] !== value) {
      form.injectionSurfaceIds = [];
      form.sandboxRun = null;
      if (form.sandboxValidation?.state === 'running') form.sandboxValidation = null;
    }
    if (['judgeId', 'targetModelId', 'attackerId'].includes(key) && value) value = resolveJudge(value)?.id || value;
    if (form.type === 'agent' && key === 'attackTemplateId') {
      const template = getAgentAttackTemplate(value);
      if (value && template?.status !== 'published') return;
      form.injectionSurfaceIds = store.agentInjectionFiles(store.agentOf(form.targetId)).filter(file => form.injectionSurfaceIds.includes(file.id) && template?.surfaceKinds.includes(file.kind)).map(file => file.id);
    }
    if (key === 'evaluatorId' && value && !publishedModelEvaluators().some(row => row.id === value)) return;
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
  twStep(step) { const form = activeForm(); if (form.type==='model'||form.busy || !Number.isInteger(step) || step < 0 || step > form.visited) return; if (step > form.step && !validate(form, { through: step - 1 })) return; form.step = step; clearError(form); refresh(); },
  twNext() { const form = activeForm(); if(form.type==='model')return validate(form);if (form.busy || !validate(form,{through:form.step})) return; if (form.step === stepsOf(form.type).length - 1) return save(false); form.step += 1; form.visited = Math.max(form.visited, form.step); refresh(); },
  twPrevious() { const form = activeForm(); if (form.busy) return; form.step = Math.max(0, form.step - 1); clearError(form); refresh(); },
  twSaveDraft: () => save(true), twSave: () => save(false), twStart:startConfiguredTask,
  twExit() { const form = activeForm(); if (form.busy) return; const route = routes(form.type); router.nav(route.page, route.list); },
};
