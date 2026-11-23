/* 创建页只管理表单和步进。配置通过 store 保存，执行数据由任务服务在启动时选择。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { methodConfigurationTable } from '../core/config-detail.js';
import { SURFACE_KIND } from '../domain/constants.js';
import { MODEL_EXECUTION_DEFAULTS, modelExecutionConfiguration, bindTaskJudge } from '../domain/task-configuration.js';
import { CONFIGURE_MODEL_VALUE, configureModelsOption, configureMoreModels } from '../core/model-config-navigation.js';
import { promptUnsavedChanges } from '../core/unsaved-changes.js';
import { releaseLabel } from '../domain/strategy-service.js';

const stepsOf = () => ['任务与靶标', '演练策略', '执行与评估', '确认配置'];
const forms = new Map();
let pendingLeave = null;
let leavePromptOpen = false;
const typeOfRoute = () => router.state().page === 'agent' ? 'agent' : 'model';
const routes = (type) => type === 'agent'
  ? { page: 'agent', create: 'ag-task-create', list: 'ag-tasks', detail: 'ag-task-detail' }
  : { page: 'exercise', create: 'task-create', list: 'tasks', detail: 'task-detail' };
const tasksOf = (type) => type === 'agent' ? store.listAgentTasks() : store.listTasks();
const taskOf = (id, type) => type === 'agent' ? store.getAgentTask(id) : store.getTask(id);
const targetRows = rows => {
  const bridged = rows.filter(row => row.assetId);
  return (bridged.length ? bridged : rows).filter(row => (!row.status || row.status === 'connected') && row.testable !== false);
};
const targets = () => targetRows(store.modelsWithRole('靶标'));
const agentTargets = () => targetRows(store.agents);
const targetsOf = type => type === 'agent' ? agentTargets() : targets();
const assetKey = row => row.assetId || row.id;
const assetVersion = row => row?.enterpriseVersion || row?.assetSnapshot?.enterpriseVersion || row?.assetVersion || row?.version || '当前版本';
const selectedTarget = form => targetsOf(form.type).find(row => row.id === form.targetId);
const versionNumber = row => Number(String(assetVersion(row)).replace(/^[vV]/, '')) || 0;
const resolveTarget = (type, id, name) => {
  const rows = targetsOf(type);
  const key = String(id || '').replace(/^tgt-/, 'mdl-');
  const exact = rows.find(row => row.id === key);
  if (exact || key.includes('@')) return exact;
  return rows.filter(row => row.assetId === key || row.name === name).sort((a, b) => versionNumber(b) - versionNumber(a))[0];
};
const judges = () => store.modelsWithRole('裁判');
// Legacy tasks contain an unversioned auxiliary-model ID. Resolve it once in the
// editable form; an explicit historical version must never silently move forward.
const resolveJudge = (id, name) => {
  const rows = judges(), key = String(id || '');
  const exact = rows.find(row => row.id === key);
  if (key.includes('@')) return exact;
  const versions = rows.filter(row => row.assetId === key).sort((a, b) => versionNumber(b) - versionNumber(a));
  return versions[0] || exact || (!key && name ? rows.find(row => row.name === name) : undefined);
};
const publishedStrategies = () => store.strategies.filter(s => s.status === 'published' && (s.banks || []).every(ref => { const bank = store.getBank(ref.bankId); return bank && !bank.archived; }));
const strategyOf = form => publishedStrategies().find(s => s.id === form.strategyId);
const publishedAgentStrategies = () => store.agentStrategies.filter(strategy => strategy.status === 'published' && (strategy.banks || []).every(ref => { const bank = store.getSceneBank(ref.bankId); return bank && !bank.archived; }));
const button = (label, options = {}) => UI.btn(label, options).replace('<button ', '<button type="button" ');
const option = (id, label, selected) => `<option value="${UI.esc(id)}"${id === selected ? ' selected' : ''}>${UI.esc(label)}</option>`;
const plain = (value) => UI.esc(value ?? '未选择');
const field = (label, value, note = '') => `<div class="tw-read-field"><span>${UI.esc(label)}</span><strong>${value}</strong>${note ? `<small>${UI.esc(note)}</small>` : ''}</div>`;
const section = (title, body) => `<section class="tw-section"><h2>${UI.esc(title)}</h2>${body}</section>`;
const select = (id, label, key, rows, selected, placeholder, modelAsset = false) => `<div class="field"><label for="${id}">${label} <span class="req">*</span></label><select id="${id}" required aria-required="true" onchange="App.twSelect('${key}',this.value)">${option('', placeholder, selected)}${rows.map(row => option(row.id, row.name, selected)).join('')}${modelAsset ? configureModelsOption : ''}</select></div>`;
const formFingerprint = form => JSON.stringify([
  form.name, form.description, form.targetId, form.strategyId, form.judgeId,
  form.guardEnabled, form.guardStages, form.injectionSurfaceIds, form.concurrency, form.maxTokens,
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
    // Catalog changes must leave an editable form with validation feedback rather than breaking the page.
    const current = store.agentConfigurationOf({
      targetId: agentTargets().some(agent => agent.id === form.targetId) ? form.targetId : '',
      strategyId: publishedAgentStrategies().some(strategy => strategy.id === form.strategyId) ? form.strategyId : '',
      judgeId: judges().some(model => model.id === form.judgeId) ? form.judgeId : '',
      injectionSurfaceIds: form.injectionSurfaceIds.filter(id => store.agentInjectionFiles(store.agentOf(form.targetId)).some(file => file.id === id)),
    });
    const saved = form.configurationSnapshot;
    if (!saved) return current;
    const result = { ...saved, injectionSurfaceIds: current.injectionSurfaceIds, requestedSurfaces: current.requestedSurfaces };
    if (saved.targetId !== form.targetId) Object.assign(result, { targetId: current.targetId, targetName: current.targetName });
    if (saved.judgeId !== form.judgeId) Object.assign(result, { judgeId: current.judgeId, judgeName: current.judgeName });
    if (saved.strategyId !== form.strategyId) {
      for (const key of ['strategyId','strategyName','strategyVersion','banks','sceneBankId','sceneBankName','taskIdSnapshot','total','technique','techniqueName','attackerId','attackerName']) result[key] = current[key];
    }
    return result;
  }
  const strategy = strategyOf(form), guard = store.guardOf(strategy?.guardId);
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
    methods: bindTaskJudge(savedStrategy?.methods ?? strategy?.methods ?? [], judges().find(model => model.id === form.judgeId)),
    banks: savedStrategy?.banks, bankName: savedStrategy?.bankName,
    bankCount: savedStrategy?.bankCount ?? bankCount,
    total: savedStrategy?.total ?? bankCount * (strategy?.methods.length || 0),
    strategyVersion: savedStrategy?.strategyVersion ?? strategy?.version,
    guardId: form.guardEnabled ? savedStrategy?.guardId || guard?.id : null,
    guardName: form.guardEnabled ? savedStrategy?.guardName || guard?.name : null,
    guardVersion: savedStrategy?.guardVersion || guard?.version,
    guardSnapshot: savedStrategy?.guardSnapshot || guard,
    guardStages: form.guardEnabled ? form.guardStages : [],
    judgeName: snapshot?.judgeId === form.judgeId ? snapshot.judgeName : judges().find(m => m.id === form.judgeId)?.name,
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
    form.strategyId = config.strategyId || '';
    form.judgeId = resolveJudge(config.judgeId, config.judgeName)?.id || config.judgeId || '';
    form.configurationSnapshot = preset.configSnapshot ? structuredClone(preset.configSnapshot) : null;
  } else {
    form.configurationSnapshot = preset.configSnapshot ? structuredClone(preset.configSnapshot) : null;
    form.targetId = resolveTarget(type, config.targetId, config.targetName)?.id || '';
    form.strategyId = config.strategyId || '';
    form.guardEnabled = config.guardEnabled ?? !!config.guardId;
    form.guardStages = [...(config.guardStages || [])];
    form.judgeId = resolveJudge(config.judgeId, config.judgeName)?.id || config.judgeId || '';
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
    router.nav(route.page, route.list, copiedId);
    return copiedId;
  } catch (error) { UI.toast(error.message); }
}

function scopeText(config, type) {
  if (type === 'agent') return config.strategyId ? `${config.total} 个业务场景` : '未选择';
  if (!config.methods.length) return '未选择';
  return `${config.bankCount} 题 × ${config.methods.length} 种方法 · ${config.total} 个攻防单元`;
}
function objectStep(form, config) {
  const rows = targetsOf(form.type), chosen = selectedTarget(form);
  const unique = [...new Set(rows.map(assetKey))].map(key => {
    const versions = rows.filter(row => assetKey(row) === key).sort((a, b) => versionNumber(b) - versionNumber(a));
    return versions.find(row => row.id === form.targetId) || versions[0];
  });
  const versions = chosen ? rows.filter(row => assetKey(row) === assetKey(chosen)).sort((a, b) => versionNumber(b) - versionNumber(a)) : [];
  const object = `<div class="tw-field-grid">${select('tw-target', '靶标资产', 'targetId', unique, form.targetId, form.type === 'model' ? '请选择靶标模型' : '请选择靶标智能体')}<div class="field"><label for="tw-version">企业版本 <span class="req">*</span></label><select id="tw-version" required aria-required="true" onchange="App.twSelect('targetId',this.value)" ${chosen ? '' : 'disabled'}>${chosen ? versions.map(row => option(row.id, assetVersion(row), form.targetId)).join('') : option('', '先选择靶标资产', '')}</select></div></div>`;
  return section('任务与靶标', `<div class="tw-fields">
    <div class="field"><label for="tw-name">任务名称 <span class="req">*</span></label>
      <input id="tw-name" type="text" maxlength="100" value="${UI.esc(form.name)}" placeholder="为本次演练起一个名称" autocomplete="off" aria-describedby="tw-name-error" ${form.nameError ? 'aria-invalid="true"' : ''} oninput="App.twField('name',this.value)" />
      <span id="tw-name-error" class="tw-error" ${form.nameError ? '' : 'hidden'}>${UI.esc(form.nameError)}</span></div>
    <div class="field"><label for="tw-description">任务描述</label><textarea id="tw-description" rows="3" maxlength="1000" placeholder="选填，说明本次演练的目的" oninput="App.twField('description',this.value)">${UI.esc(form.description)}</textarea></div>
    ${object}${form.type === 'agent' ? injectionRange(form) : ''}</div>`);
}
function injectionRange(form) {
  if (!form.targetId) return '';
  const files = store.agentInjectionFiles(store.agentOf(form.targetId));
  if (!files.length) return '<div class="tw-rule">该靶标尚无已核验的注入文件，可用于基础安全演练。</div>';
  const groups = [...new Set(files.map(file => file.kind))];
  return `<fieldset class="tw-choice-group tw-surfaces"><legend>注入面范围</legend><p class="tw-note">可选择一个或多个具体文件。基础安全演练不使用注入文件。</p>${groups.map(kind => `<div class="tw-surface-group"><h3>${UI.esc(SURFACE_KIND[kind] || kind)}</h3>${files.filter(file => file.kind === kind).map(file => `<label><input type="checkbox" value="${UI.esc(file.id)}" ${form.injectionSurfaceIds.includes(file.id) ? 'checked' : ''} onchange="App.twSurface(this.value,this.checked)"><span>${UI.esc(file.path)}</span></label>`).join('')}</div>`).join('')}</fieldset>`;
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
    <header><h3>${UI.esc(config.strategyName)}</h3>${UI.badge(releaseLabel(strategy.version), 'blue')}</header>
    ${field('题库范围', bankScope.map(UI.esc).join('<br>'))}
    ${field('防护配置', UI.esc(guardText(config)))}<div class="tw-methods"><h4>演练方法</h4>${methodConfigurationTable(methods.sort((a,b) => a.order - b.order))}</div></div>`;
}
const unavailableStrategyNotice = form => form.strategyId ? '<p class="tw-error" role="alert">此策略版本不可用，请重新选择。</p>' : '';
function attackStep(form, config) {
  if (form.type === 'model') {
    const strategy = strategyOf(form);
    return section('演练策略', `<div class="tw-fields">${select('tw-strategy', '策略版本', 'strategyId', publishedStrategies().map(s=>({...s,name:`${s.name} · ${releaseLabel(s.version)}`})), form.strategyId, '请选择演练策略')}${strategy ? '' : unavailableStrategyNotice(form)}</div>${strategy ? strategyDetails(strategy, config) : ''}`);
  }
  const chosen = publishedAgentStrategies().find(strategy => strategy.id === form.strategyId);
  const bankScope = config.banks?.length
    ? config.banks.map(bank => `${bank.name} · 前 ${bank.count} 题`)
    : [`${config.sceneBankName || '场景题库'} · ${config.total || 0} 题`];
  return section('演练策略', `<div class="tw-fields">${select('tw-strategy', '策略版本', 'strategyId', publishedAgentStrategies().map(s=>({...s,name:`${s.name} · ${releaseLabel(s.version)}`})), form.strategyId, '请选择演练策略')}${chosen ? '' : unavailableStrategyNotice(form)}</div>${chosen ? `<div class="tw-strategy" data-tw-strategy-details><header><h3>${plain(config.strategyName)}</h3>${UI.badge(releaseLabel(chosen.version), 'blue')}</header>${field('场景题库范围', bankScope.map(UI.esc).join('<br>'))}${field('演练方法', plain(config.techniqueName))}${config.technique === 'universal' ? field('攻击生成模型', plain(config.attackerName)) : ''}</div>` : ''}`);
}
function evaluationStep(form, config) {
  return section('评估配置', `<div class="tw-fields">${select('tw-judge', '裁判模型', 'judgeId', judges(), form.judgeId, '请选择裁判模型', true)}</div>
    `);
}
function executionStep(form) {
  return section('执行配置', `<div class="tw-fields tw-execution-fields">
    <div class="field"><label for="tw-concurrency">并发数 <span class="req">*</span></label><input id="tw-concurrency" type="number" min="1" step="1" required value="${UI.esc(form.concurrency)}" oninput="App.twExecution('concurrency',this.value)" aria-describedby="tw-concurrency-help"><p id="tw-concurrency-help" class="tw-note">同时执行的攻防单元数量。</p></div>
    <div class="field"><label for="tw-max-tokens">Token 限制 <span class="req">*</span></label><div class="input-unit"><input id="tw-max-tokens" type="number" min="1" step="1" required value="${UI.esc(form.maxTokens)}" oninput="App.twExecution('maxTokens',this.value)" aria-describedby="tw-token-help"><span>tokens</span></div><p id="tw-token-help" class="tw-note">单次模型调用的最大输出长度，不是整场演练的总额度。</p></div>
  </div>`);
}
function guardText(config) {
  const builtin = config.guardSnapshot?.builtin ?? store.guardOf(config.guardId)?.builtin;
  return config.guardId ? `${config.guardName}${builtin ? '' : ` · ${releaseLabel(config.guardVersion)}`} · ${config.guardStages.map(stage=>stage+'审核').join(' + ')}` : '未启用防护';
}
function confirmStep(form, config) {
  return section('确认配置', `<div class="tw-confirm-name"><strong>${UI.esc(form.name)}</strong>${UI.badge(form.type === 'agent' ? 'Agent 演练' : '模型演练', 'blue')}</div>
    ${UI.kvTable([
      ['演练对象', plain(config.targetName)], ['资产版本', plain(assetVersion(selectedTarget(form)))], ['策略版本', plain(config.strategyName ? `${config.strategyName} · ${releaseLabel(config.strategyVersion)}` : '')],
      ['测试范围', UI.esc(scopeText(config, form.type))],
      ...(form.type === 'agent' ? [['注入面范围', config.technique === 'baseline' ? '不注入' : (config.requestedSurfaces || []).map(file => UI.esc(file.path)).join('<br>') || '未选择']] : [['防护配置', UI.esc(guardText(config))]]),
      ['裁判模型', plain(config.judgeName)], ...(form.type === 'model' ? [['评估指标', '攻击成功率（ASR）']] : []),
      ...(form.type === 'model' ? [['执行配置', `并发数 ${plain(config.concurrency)} · 单次输出上限 ${plain(config.maxTokens)} tokens`]] : []),
      ['任务描述', form.description ? UI.esc(form.description) : '—'],
    ])}`);
}
function summary(form, config) {
  const strategyUnavailable = form.strategyId && !(form.type === 'agent' ? publishedAgentStrategies() : publishedStrategies()).some(strategy => strategy.id === form.strategyId);
  return UI.card('配置摘要', `<dl class="tw-summary">
    <div><dt>对象类型</dt><dd>${form.type === 'agent' ? 'Agent' : '模型'}</dd></div>
    <div><dt>演练对象</dt><dd>${plain(config.targetName)}</dd></div>
    <div><dt>资产版本</dt><dd>${form.targetId ? plain(assetVersion(selectedTarget(form))) : '未选择'}</dd></div>
    <div><dt>策略版本</dt><dd>${plain(config.strategyName ? `${config.strategyName} · ${releaseLabel(config.strategyVersion)}` : undefined)}${strategyUnavailable ? '<span class="tw-error">（不可用，请重选）</span>' : ''}</dd></div>
    ${form.type === 'agent' ? `<div><dt>注入面范围</dt><dd>${config.technique === 'baseline' ? '不注入' : `${(config.requestedSurfaces || []).length} 个文件`}</dd></div>` : `<div><dt>防护配置</dt><dd>${UI.esc(guardText(config))}</dd></div>`}
    <div><dt>裁判模型</dt><dd>${plain(config.judgeName)}</dd></div>
    ${form.type === 'model' ? `<div><dt>测试范围</dt><dd>${UI.esc(scopeText(config, form.type))}</dd></div>` : ''}
    ${form.type === 'model' ? `<div><dt>执行配置</dt><dd>并发数 ${plain(config.concurrency)} · ${plain(config.maxTokens)} tokens / 次</dd></div>` : ''}</dl>`);
}

export function taskWizardPage(cur) {
  const type = cur.page === 'agent' ? 'agent' : 'model';
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
  const bodies = type === 'agent' ? [objectStep, attackStep, evaluationStep, confirmStep] : [objectStep, attackStep, (f, c) => evaluationStep(f, c) + executionStep(f), confirmStep];
  return `${UI.backBtn()}${UI.pageHead(title)}<div class="tw-root" aria-label="任务创建向导">
    <ol class="tw-steps" style="--step-count:${steps.length}" aria-label="创建步骤">${steps.map((label, i) => `<li class="${i === form.step ? 'current' : i < form.step ? 'complete' : ''}"><button type="button" ${i > form.visited || form.busy ? 'disabled' : ''} ${i === form.step ? 'aria-current="step"' : ''} onclick="App.twStep(${i})"><span class="tw-step-number">${i + 1}</span><span>${label}</span></button></li>`).join('')}</ol>
    <div class="tw-layout"><form class="tw-form" onsubmit="event.preventDefault();App.twNext()" novalidate aria-busy="${form.busy}">
      <div class="tw-content" ${form.busy ? 'inert' : ''}>${bodies[form.step](form, config)}<p class="tw-error tw-save-error" id="tw-save-error" role="alert" ${form.error ? '' : 'hidden'}>${UI.esc(form.error)}</p></div>
      <div class="tw-footer"><div class="tw-footer-actions">
        ${button('取消', { onclick: 'App.twExit()', disabled: form.busy })}
        ${button('保存草稿', { onclick: 'App.twSaveDraft()', disabled: form.busy })}
        ${form.step > 0 ? button('上一步', { onclick: 'App.twPrevious()', disabled: form.busy }) : ''}
        ${form.step === stepsOf(form.type).length - 1 ? button('保存待开始', { onclick: 'App.twSave()', disabled: form.busy }) : ''}
        ${button(form.busy ? '保存中…' : form.step === stepsOf(form.type).length - 1 ? '保存并发起' : '下一步', { kind: 'primary', onclick: form.step === stepsOf(form.type).length - 1 ? 'App.twSaveAndStart()' : 'App.twNext()', disabled: form.busy })}
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
      [1, !!strategyOf(form), '请选择已发布的演练策略'],
      [1, !form.guardEnabled || form.guardStages.some(stage => store.GUARD_STAGES.includes(stage)), '请选择至少一个防护位置'],
      [2, judges().some(m => m.id === form.judgeId), '请选择裁判模型'],
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
      [0, agentTargets().some(agent => agent.id === form.targetId), '请选择已接入的靶标智能体'],
      [1, publishedAgentStrategies().some(strategy => strategy.id === form.strategyId), '请选择已发布的演练策略'],
      [0, publishedAgentStrategies().find(strategy => strategy.id === form.strategyId)?.methodId !== 'universal' || form.injectionSurfaceIds.length > 0, '请选择至少一个注入文件'],
      [2, judges().some(model => model.id === form.judgeId), '请选择裁判模型'],
    ];
    const invalid = checks.find(([step, valid]) => step <= through && !valid);
    if (invalid) [errorStep, , error] = invalid;
  }
  form.error = error;
  if (error) { form.step = errorStep; refresh(); if (form.nameError) document.getElementById('tw-name')?.focus(); return false; }
  return true;
}
async function persistForm(form, draft) {
  if (form.busy || !validate(form, { draft, through: stepsOf(form.type).length - 1 })) return false;
  form.busy = true; refresh();
  try {
    const config = form.type === 'agent' ? { targetId: form.targetId, strategyId: form.strategyId, judgeId: form.judgeId, injectionSurfaceIds: form.injectionSurfaceIds } : {
      targetId: form.targetId, strategyId: form.strategyId, judgeId: form.judgeId,
      guardId: configurationOf(form).guardId,
      guardEnabled: form.guardEnabled, guardStages: form.guardEnabled ? form.guardStages : [],
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
async function save(draft, start = false) {
  const form = activeForm();
  if (!await persistForm(form, draft)) return;
  const route = routes(form.type);
  if (start) {
    try { await store.startTask(form.id, form.type); }
    catch (error) { UI.toast(`任务已保存待开始：${error.message || '暂未发起，请从详情重试'}`); }
  }
  forms.delete(form.type);
  router.nav(route.page, draft ? route.list : route.detail, draft ? null : form.id, { replace: true });
}

/* The router owns destinations; the wizard owns unsaved form data and its prompt.
 * A deliberate trip to model configuration retains the local form for its return action. */
router.beforeNavigate(transition => {
  const type = transition.from.page === 'agent' ? 'agent' : 'model';
  if (transition.from.sub !== routes(type).create) return true;
  if (transition.options.purpose === 'switch-object-type') return true;
  const form = forms.get(type);
  if (!form) return true;
  if (form.busy) return false;
  const finish = () => {
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
export const actions = {
  editTaskConfig, copyTaskConfig,
  twType(type) {
    const form = activeForm();
    if (form.busy || form.id || !['model', 'agent'].includes(type) || form.type === type) return;
    const next = createForm(type);
    next.name = form.name; next.description = form.description;
    const route = routes(type);
    router.nav(route.page, route.create, null, { purpose: 'switch-object-type', onCommit: () => { forms.delete(form.type); forms.set(type, next); } });
  },
  twField(key, value) {
    const form = activeForm();
    if (form.busy || !['name', 'description', 'desc'].includes(key)) return;
    form[key === 'desc' ? 'description' : key] = value;
    if (key === 'name') { form.nameError = ''; const err = document.getElementById('tw-name-error'); if (err) err.hidden = true; document.getElementById('tw-name')?.removeAttribute('aria-invalid'); }
    clearError(form);
  },
  twSelect(key, value) {
    const form = activeForm();
    if (form.busy || !['targetId', 'strategyId', 'judgeId'].includes(key)) return;
    if (value === CONFIGURE_MODEL_VALUE) {
      const selector = document.getElementById(key === 'judgeId' ? 'tw-judge' : 'tw-target');
      if (selector) selector.value = form[key];
      if (key === 'judgeId' || (form.type === 'model' && key === 'targetId')) {
        const route = routes(form.type);
        configureMoreModels(refresh, '返回任务配置', { returnRoute: () => ({ page: route.page, sub: route.create, param: form.id }) });
      }
      return;
    }
    if (form.type === 'agent' && key === 'targetId' && form.targetId !== value) form.injectionSurfaceIds = [];
    if (key === 'judgeId' && value) value = resolveJudge(value)?.id || value;
    if (key === 'strategyId') {
      const selected = (form.type === 'agent' ? publishedAgentStrategies() : publishedStrategies()).find(s => s.id === value);
      if (selected) {
        if (form.type === 'model') { form.guardEnabled = !!selected.guardId; form.guardStages = [...(selected.guardStages || store.guardOf(selected.guardId)?.stages || [])]; }
      }
    }
    form[key] = value; clearError(form); refresh();
  },
  twExecution(key, value) {
    const form = activeForm();
    if (form.busy || form.type !== 'model' || !['concurrency', 'maxTokens'].includes(key)) return;
    form[key] = value === '' ? '' : Number(value); clearError(form);
  },
  twSurface(id, enabled) {
    const form = activeForm(); if (form.busy || form.type !== 'agent') return;
    const files = store.agentInjectionFiles(store.agentOf(form.targetId));
    form.injectionSurfaceIds = files.filter(file => file.id === id ? enabled : form.injectionSurfaceIds.includes(file.id)).map(file => file.id);
    clearError(form); refresh();
  },
  twGuardEnabled(enabled) { const form = activeForm(); if (form.busy || form.type !== 'model') return; form.guardEnabled = enabled === true; clearError(form); refresh(); },
  twGuardStage(stage, enabled) {
    const form = activeForm(); if (form.busy || form.type !== 'model' || !store.GUARD_STAGES.includes(stage)) return;
    form.guardStages = store.GUARD_STAGES.filter(s => s === stage ? enabled : form.guardStages.includes(s)); clearError(form); refresh();
  },
  twStep(step) { const form = activeForm(); if (form.busy || !Number.isInteger(step) || step < 0 || step > form.visited) return; if (step > form.step && !validate(form, { through: step - 1 })) return; form.step = step; clearError(form); refresh(); },
  twNext() { const form = activeForm(); if (form.busy || !validate(form)) return; if (form.step === stepsOf(form.type).length - 1) return save(false, true); form.step += 1; form.visited = Math.max(form.visited, form.step); refresh(); },
  twPrevious() { const form = activeForm(); if (form.busy) return; form.step = Math.max(0, form.step - 1); clearError(form); refresh(); },
  twSaveDraft: () => save(true), twSave: () => save(false), twSaveAndStart: () => save(false, true),
  twExit() { const form = activeForm(); if (form.busy) return; const route = routes(form.type); router.nav(route.page, route.list); },
};
