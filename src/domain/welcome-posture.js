/* Unified resource posture. Every plotted value is backed by completed execution
 * units; missing judgments stay null and tag filters recompute their denominator. */
import { taskMetricValues } from './metrics.js';
import { classificationTags } from './task-classification.js';
import { RISK_LABEL } from './constants.js';
import { advbench, scenes } from '../data/catalog.js';

const questionByPrompt = new Map(advbench.map(row => [row.prompt, row]));
const questionById = new Map(advbench.map(row => [row.id, row]));
const questionBySnapshot = new Map(advbench.map((row, index) => [`bank-advbench:${index}`, row]));
const scenarioNames = new Map(scenes.map(row => [row.id, row.label || row.name || row.id]));
// These are the fixed IDs issued for built-in classification tags. Reconcile
// their pre-snapshot archive keys without merging arbitrary same-name tags or
// consulting mutable classification metadata from today's catalog.
const systemRiskAliases = {
  model: new Map([...new Set(scenes.map(row => row.label))].map((name, index) =>
    [`tag-question-risk-preset-${index}`, scenes.find(row => row.label === name).id])),
  agent: new Map([...new Set(Object.values(RISK_LABEL).map(row => row.label))].map((name, index) =>
    [`tag-environment-risk-preset-${index}`, Object.keys(RISK_LABEL).find(key => RISK_LABEL[key].label === name)])),
};
const systemRiskCoverageAliases = new Map(Object.entries(systemRiskAliases).flatMap(([kind, aliases]) =>
  [...aliases].map(([id, legacyId]) => [id, { kind, id: legacyId }])));
const businessNames = { operations: '运营与办公协作', product: '产品管理', research: '科研与分析', engineering: '软件工程', support: '客户支持', crm: '客户关系管理' };
const labelList = value => [...new Map((Array.isArray(value) ? value : value ? [value] : [])
  .map(row => typeof row === 'string' ? { id: row, name: row } : row)
  .filter(row => row?.id && row?.name).map(row => [String(row.id), { id: String(row.id), name: String(row.name) }])).values()];
const identity = (...parts) => parts.map(value => encodeURIComponent(String(value))).join(':');
const byAttention = (a, b) => (b.asr ?? -1) - (a.asr ?? -1) || b.breach - a.breach || b.judged - a.judged || a.name.localeCompare(b.name, 'zh-CN');

function classifications(task, unit, kind) {
  let riskTags = classificationTags(unit, 'risk');
  if (riskTags === null) {
    if (kind === 'agent') riskTags = labelList(unit.declaredLabels).map(row => ({ ...row, name: RISK_LABEL[row.id]?.label || row.name }));
    else {
      const id = unit.scenarioId || unit.sceneId || questionByPrompt.get(unit.target)?.scene;
      riskTags = id ? [{ id, name: unit.scenarioName || unit.sceneName || scenarioNames.get(id) || id }] : [];
    }
  }
  let businessTags = classificationTags(unit, 'business');
  if (businessTags === null) businessTags = labelList(unit.business || unit.domainOriginal || unit.domain || task.business)
    .map(row => ({ ...row, name: businessNames[row.name] || row.name }));
  riskTags = labelList(labelList(riskTags).map(tag => ({ ...tag, id: systemRiskAliases[kind]?.get(tag.id) || tag.id })));
  businessTags = labelList(businessTags);
  return {
    riskTags: riskTags.length ? riskTags : [{ id: 'unclassified-risks', name: '未标注风险' }],
    businessTags: businessTags.length ? businessTags : [{ id: 'unclassified-business', name: '未标注业务' }],
  };
}

function questionResource(task, unit, index) {
  const name = unit.questionTitle || unit.questionName || unit.target || unit.question || '未命名题目';
  const captured = unit.classificationSnapshot?.resourceId;
  const bank = unit.questionBankId || unit.bankId;
  const question = unit.questionId || unit.promptId;
  let key;
  if (captured && questionBySnapshot.has(captured)) key = ['advbench', questionBySnapshot.get(captured).id];
  else if (captured) key = ['snapshot', captured];
  else if (bank === 'bank-advbench' && questionById.has(question)) key = ['advbench', question];
  else if (bank && question) key = ['bank', bank, question];
  // A known source takes precedence over coincident text. Only legacy records
  // without a different declared origin can resolve through exact AdvBench text.
  else if (!bank && !question && (!task.bankName || /^AdvBench\b/i.test(task.bankName)) && questionByPrompt.has(unit.target)) key = ['advbench', questionByPrompt.get(unit.target).id];
  else key = ['run', task.id, bank || '', question || unit.target || unit.question || unit.id || index];
  return { id: identity('model', 'question', ...key), kind: 'model', resourceKind: 'question', name: String(name) };
}

function environmentResource(task, unit, index) {
  const key = unit.sceneTaskId || unit.environmentId || unit.classificationSnapshot?.resourceId;
  return { id: key ? identity('agent', 'environment', key) : identity('agent', 'environment', 'run', task.id, unit.id || index),
    kind: 'agent', resourceKind: 'environment', name: String(unit.goal || unit.goalCn || unit.environmentName || unit.sceneName || unit.title || key || '未命名环境') };
}

function methodResource(task, unit, kind) {
  if (kind === 'model') {
    const key = unit.methodKey || unit.method;
    const method = (task.methods || task.configSnapshot?.methods || []).find(row => row.name === unit.method || row.id === key || row.key === key);
    return { id: identity('model', 'method', key || `unknown-${task.id}`), kind, resourceKind: 'method',
      name: method?.label ? `${method.label}（${method.name || key}）` : String(unit.method || key || '未标注攻击方法'), baseline: key === 'Direct' };
  }
  const config = task.configSnapshot || task, technique = unit.technique || task.technique || config.technique;
  if (technique === 'baseline' || config.exerciseMode === 'baseline') return null;
  const key = config.attackTemplateId || task.attackTemplateId || technique;
  const name = config.attackTemplateSnapshot?.name || config.attackTemplateName || task.attackTemplateName || task.techniqueName || config.techniqueName || (technique === 'universal' ? '间接提示注入' : key);
  return { id: identity('agent', 'attacker', key || `unknown-${task.id}`), kind, resourceKind: 'attacker', name: String(name || '未标注攻击者') };
}

function aggregate(records, resourceOf) {
  const groups = new Map();
  for (const record of records) {
    const resource = resourceOf(record);
    if (!resource) continue;
    const row = groups.get(resource.id) || { ...resource, units: 0, breach: 0, judged: 0, taskIds: new Set(), riskTags: new Map(), businessTags: new Map() };
    row.units += 1; row.breach += record.metric.numerator; row.judged += record.metric.denominator;
    row.taskIds.add(record.task.id);
    for (const tag of record.riskTags) row.riskTags.set(tag.id, tag);
    for (const tag of record.businessTags) row.businessTags.set(tag.id, tag);
    groups.set(resource.id, row);
  }
  return [...groups.values()].map(row => ({ ...row, asr: row.judged ? row.breach / row.judged : null,
    taskIds: [...row.taskIds], riskTags: [...row.riskTags.values()], businessTags: [...row.businessTags.values()] })).sort(byAttention);
}

function radarAxes(records) {
  return ['model', 'agent'].flatMap(kind => {
    const own = records.filter(record => record.kind === kind);
    const tagIds = [...new Set(own.flatMap(record => record.riskTags.map(tag => tag.id)))].filter(id => id !== 'unclassified-risks');
    const available = tagIds.map(tagId => {
      const matching = own.filter(record => record.riskTags.some(tag => tag.id === tagId));
      const breach = matching.reduce((sum, record) => sum + record.metric.numerator, 0);
      const judged = matching.reduce((sum, record) => sum + record.metric.denominator, 0);
      return { id: identity(kind, 'risk', tagId), kind, tagId, name: matching[0].riskTags.find(tag => tag.id === tagId).name,
        asr: judged ? breach / judged : null, breach, judged, taskIds: [...new Set(matching.map(record => record.task.id))] };
    }).filter(row => row.judged > 0).sort(byAttention).slice(0, 3);
    return Array.from({ length: 3 }, (_, index) => available[index] || {
      id: identity(kind, 'risk-missing', index), kind, tagId: null, name: '暂无风险标签', asr: null, breach: 0, judged: 0, taskIds: [],
    });
  });
}

function coverageIdentity(record, dimension, tag, captured) {
  // Snapshot IDs belong to the shared tag registry. Legacy IDs only identify
  // a tag within its object domain, except for the explicit built-in aliases.
  const legacy = dimension === 'risk' && systemRiskCoverageAliases.get(tag.id);
  return captured === null || legacy
    ? identity('legacy', legacy?.kind || record.kind, dimension, legacy?.id || tag.id)
    : identity('tag', dimension, tag.id);
}

function coverageLabels(record, dimension) {
  const missing = dimension === 'risk' ? 'unclassified-risks' : 'unclassified-business';
  const captured = classificationTags(record.unit, dimension);
  const labels = captured === null ? record[`${dimension}Tags`] : labelList(captured);
  return labels.filter(tag => tag.id !== missing).map(tag => ({
    id: coverageIdentity(record, dimension, tag, captured), name: tag.name,
  }));
}

function classificationCoverage(records, dimension) {
  const keys = { model: new Set(), agent: new Set() };
  for (const record of records) {
    for (const tag of coverageLabels(record, dimension)) keys[record.kind].add(tag.id);
  }
  return { total: new Set([...keys.model, ...keys.agent]).size, model: keys.model.size, agent: keys.agent.size };
}

function judgedSummary(records) {
  const breach = records.reduce((sum, record) => sum + record.metric.numerator, 0);
  const judged = records.reduce((sum, record) => sum + record.metric.denominator, 0);
  return { units: records.length, breach, judged, asr: judged ? breach / judged : null };
}

function classificationPosture(records, dimension, limit) {
  const groups = new Map(), unclassified = [];
  for (const record of records) {
    const labels = [...new Map(coverageLabels(record, dimension).map(label => [label.id,label])).values()];
    if (!labels.length) unclassified.push(record);
    for (const label of labels) {
      const group = groups.get(label.id) || { ...label, records: [] };
      group.records.push(record);
      groups.set(label.id, group);
    }
  }
  const series = [...groups.values()].map(group => ({
    id: group.id, name: group.name,
    kinds: ['model', 'agent'].filter(kind => group.records.some(record => record.kind === kind)),
    taskIds: [...new Set(group.records.map(record => record.task.id))],
    ...judgedSummary(group.records),
  })).sort((a, b) => (b.asr ?? -1) - (a.asr ?? -1) || b.judged - a.judged || a.name.localeCompare(b.name, 'zh-CN'));
  return { all: series, displayed: series.filter(row => row.judged > 0).slice(0, limit), unclassified: judgedSummary(unclassified) };
}

function focusHighlights(businesses, risks, methods) {
  const empty = (id, name) => ({ id, name, asr: null, breach: 0, judged: 0, units: 0, taskIds: [] });
  // Select an actual customer-service classification rather than inferring
  // business evidence from a strategy or task title. Different tag identities
  // remain separate, even when their display names happen to match.
  const customerNames = ['客户服务', '客服', '客户支持'];
  const business = businesses.find(row => customerNames.includes(row.name.trim()))
    || empty('focus:customer-service', '客户服务');
  const risk = risks[0] || empty('focus:risk', '暂无风险场景');
  const pair = methods.find(row => row.id === 'model:method:PAIR');
  const method = pair ? { ...pair, sourceName: pair.name, name: 'PAIR' } : empty('model:method:PAIR', 'PAIR');
  return { business, risk, method };
}

/** Radar and headline counts always describe the unfiltered dashboard period.
 * Tag filtering applies to units before grouping, so selected-resource ASR never
 * borrows judgments from unrelated labels. Risk tags describe covered scenarios,
 * not evidence that every declared risk was triggered. */
export function welcomeUnifiedPosture(dashboard, { mode = 'resources', tag = null } = {}) {
  const tasks = (dashboard?.tasks || ['model', 'agent'].flatMap(kind => (dashboard?.[kind]?.tasks || []).map(task => ({ ...task, kind, objectType: kind }))))
    .filter(task => task.status === 'done').map((task, index) => ({ ...task, id: task.id || `unidentified-task-${index}`, kind: task.kind || task.objectType || 'model' }));
  const records = tasks.flatMap(task => (task.units || []).flatMap((unit, index) => {
    if (unit.executionStatus && unit.executionStatus !== 'done') return [];
    const kind = task.kind;
    const metric = taskMetricValues({ ...task, objectType: kind, total: 1, units: [unit] }).asr;
    return [{ task, unit, kind, index, metric, ...classifications(task, unit, kind) }];
  }));
  const resourceOf = record => record.kind === 'model' ? questionResource(record.task, record.unit, record.index) : environmentResource(record.task, record.unit, record.index);
  const methodOf = record => methodResource(record.task, record.unit, record.kind);
  const resources = aggregate(records, resourceOf), methods = aggregate(records, methodOf);
  const selected = tag ? records.filter(record => record.kind === tag.kind && record.riskTags.some(row => row.id === tag.id)) : records;
  const businessCoverage = classificationCoverage(records, 'business'), riskCoverage = classificationCoverage(records, 'risk');
  const axes = radarAxes(records);
  const businesses = classificationPosture(records, 'business', 4), risks = classificationPosture(records, 'risk', 6);
  const metrics = tasks.map(task => taskMetricValues({ ...task, objectType: task.kind }).asr).filter(row => row.denominator > 0 && Number.isFinite(row.value));
  return {
    radarAxes: axes,
    businessSeries: businesses.displayed, allBusinessSeries: businesses.all, unclassifiedBusiness: businesses.unclassified,
    riskSeries: risks.displayed, allRiskSeries: risks.all,
    highlights: focusHighlights(businesses.all, risks.all, methods),
    rows: tag ? aggregate(selected, mode === 'methods' ? methodOf : resourceOf) : mode === 'methods' ? methods : resources,
    counts: { resources: resources.length, methods: methods.length,
      model: resources.filter(row => row.kind === 'model').length, agent: resources.filter(row => row.kind === 'agent').length,
      modelMethods: methods.filter(row => row.kind === 'model').length, agentMethods: methods.filter(row => row.kind === 'agent').length,
      businessTypes: businessCoverage.total, modelBusinessTypes: businessCoverage.model, agentBusinessTypes: businessCoverage.agent,
      riskScenarios: riskCoverage.total, modelRiskScenarios: riskCoverage.model, agentRiskScenarios: riskCoverage.agent },
    overallAsr: metrics.length ? metrics.reduce((sum, row) => sum + row.value, 0) / metrics.length : null,
  };
}
