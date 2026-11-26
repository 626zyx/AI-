import { taskMetricValues, modelTaskMetrics } from './metrics.js';
import { taskOperationalMetrics } from './task-technical-metrics.js';
import { classificationTags } from './task-classification.js';
import { RISK_LABEL } from './constants.js';
import { advbench, scenes } from '../data/catalog.js';

/* Legacy catalog helpers are retained for entry-point consumers. */
export const INITIAL_METRICS = [
  { label: '演练任务', description: '已完成的演练任务数' },
  { label: '攻击单元', description: '已执行的测试单元数' },
  { label: '攻破 / 泄漏', description: '被判定为攻破的单元数' },
  { label: '整体 ASR', description: '攻破数 ÷ 有效判定数' },
  { label: '覆盖靶标', description: '已完成演练的不同靶标数' },
  { label: '风险事件', description: '满足风险规则的任务数' },
];

export function initialResources({ banks = [], sceneBanks = [] } = {}) {
  return [
    ...banks.filter(bank => bank.source === 'system').map(bank => ({ name: bank.name, kind: '模型攻击题库', page: 'strategy', sub: 'banks' })),
    ...sceneBanks.filter(bank => bank.source === 'system' && bank.items?.length).map(bank => ({ name: bank.name, kind: `Agent 场景题库 · ${bank.items.length} 题`, page: 'strategy', sub: 'scenebanks' })),
  ];
}

export { exerciseDemoSequences as welcomeSequences } from './exercise-demo.js';

export const WELCOME_METRIC_NOTE = '按已完成任务等权平均；最高攻破率按有效单元汇总。';
const DAY = 24 * 60 * 60 * 1000;

// Archive dates without an offset are the platform's Asia/Shanghai time.
// Explicit offsets and epoch timestamps retain their own time-zone meaning.
export function welcomeTaskTimestamp(task) {
  const value = task.finishedAt || task.startedAt || task.createdAt || task.updatedAt;
  if (value instanceof Date || typeof value === 'number') return Number(new Date(value));
  const text = String(value || '').trim();
  if (!text) return NaN;
  const normalized = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(text)
    ? `${text.replace(' ', 'T')}${text.length === 10 ? 'T00:00:00' : ''}+08:00` : text;
  return Date.parse(normalized);
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return { value: valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null, sampleCount: valid.length };
}

function averageRate(metrics) {
  const valid = metrics.filter(metric => metric?.applicable !== false && metric?.denominator > 0 && Number.isFinite(metric.value));
  return { ...average(valid.map(metric => metric.value)),
    numerator: valid.reduce((sum, metric) => sum + metric.numerator, 0),
    denominator: valid.reduce((sum, metric) => sum + metric.denominator, 0) };
}

const legacyModelScenarios = new Map(advbench.map(row => [row.prompt, row.scene]));
const scenarioNames = new Map(scenes.map(row => [row.id, row.label || row.name || row.id]));
const legacyBusinessNames = { operations: '运营与办公协作', product: '产品管理', research: '科研与分析', engineering: '软件工程', support: '客户支持', crm: '客户关系管理' };
const labels = values => (Array.isArray(values) ? values : values ? [values] : []).map(value => typeof value === 'string' ? { id: value, name: value } : value).filter(value => value?.id && value?.name);
const uniqueLabels = values => [...new Map(labels(values).map(value => [value.id, value])).values()];

/** Classification is taken from the run snapshot, including explicit empty
 * classifications. Legacy metadata is only used when no snapshot exists. The
 * rates describe whole-unit outcomes within a category, not causal attribution
 * to every risk label declared by an environment. */
export function welcomeInsights(tasks = [], kind = 'model') {
  const groups = { business: new Map(), risks: new Map(), methods: new Map() };
  const missing = dimension => [{ id: `unclassified-${dimension}`, name: dimension === 'business' ? '未标注业务' : dimension === 'risks' ? '未标注风险' : '未标注攻击方法' }];
  const add = (dimension, tags, task, unit) => {
    for (const tag of uniqueLabels(tags)) {
      const row = groups[dimension].get(tag.id) || { id: tag.id, name: tag.name, runs: new Map(), units: 0, baseline: tag.baseline === true };
      const run = row.runs.get(task.id) || { task, units: [] };
      run.units.push(unit); row.runs.set(task.id, run); row.units += 1;
      groups[dimension].set(tag.id, row);
    }
  };
  for (const task of tasks.filter(row => row.status === 'done')) {
    for (const unit of (task.units || []).filter(row => !row.executionStatus || row.executionStatus === 'done')) {
      let business = classificationTags(unit, 'business');
      if (business === null) {
        const domain = unit.business || unit.domainOriginal || unit.domain || task.business;
        business = labels(domain).map(row => ({ ...row, name: legacyBusinessNames[row.name] || row.name }));
      }
      add('business', business.length ? business : missing('business'), task, unit);
      let risks = classificationTags(unit, 'risk');
      if (risks === null) {
        if (kind === 'agent') risks = labels(unit.declaredLabels).map(row => ({ ...row, name: RISK_LABEL[row.id]?.label || row.name }));
        else {
          const id = unit.scenarioId || unit.sceneId || legacyModelScenarios.get(unit.target);
          risks = id ? [{ id, name: unit.scenarioName || unit.sceneName || scenarioNames.get(id) || id }] : [];
        }
      }
      add('risks', risks.length ? risks : missing('risks'), task, unit);
      if (kind === 'model') {
        const key = unit.methodKey || unit.method;
        const method = (task.methods || []).find(row => row.name === unit.method || row.id === key || row.key === key);
        add('methods', key ? [{ id: key, name: method?.label ? `${method.label}（${method.name || key}）` : unit.method || key, baseline: key === 'Direct' }] : missing('methods'), task, unit);
      } else {
        const config = task.configSnapshot || task;
        const technique = unit.technique || task.technique || config.technique;
        if (technique === 'baseline' || config.exerciseMode === 'baseline') continue;
        const key = config.attackTemplateId || task.attackTemplateId || technique;
        const name = config.attackTemplateSnapshot?.name || config.attackTemplateName || task.attackTemplateName || task.techniqueName || config.techniqueName || (technique === 'universal' ? '间接提示注入' : key);
        add('methods', key ? [{ id: key, name }] : missing('methods'), task, unit);
      }
    }
  }
  return Object.fromEntries(Object.entries(groups).map(([dimension, entries]) => [dimension, [...entries.values()].map(({ runs, ...row }) => {
    const rates = [...runs.values()].map(({ task, units }) => taskMetricValues({ ...task, objectType: kind, units, total: units.length }).asr);
    const mean = averageRate(rates);
    return { ...row, asr: mean.denominator ? mean.numerator / mean.denominator : null, breach: mean.numerator, judged: mean.denominator, assessedRuns: mean.sampleCount,
      taskIds: [...runs.keys()], metricDefinition: '该分类攻破单元数 ÷ 有效判定单元数；分类关联整体单元判定，不表示该标签已被触发。' };
  }).sort((a, b) => (b.asr ?? -1) - (a.asr ?? -1) || b.breach - a.breach || b.judged - a.judged || a.name.localeCompare(b.name, 'zh-CN'))]));
}

function groupSummary(tasks, kind) {
  const completedTasks = tasks.filter(task => task.status === 'done');
  const metricRows = completedTasks.map(task => taskMetricValues(task));
  const operationalRows = completedTasks.map(task => taskOperationalMetrics(task));
  const executionRows = operationalRows.map(row => row.execution).filter(row => row.expected > 0);
  const units = completedTasks.flatMap(task => (task.units || []).filter(unit => !unit.executionStatus || unit.executionStatus === 'done'));
  const unique = values => new Set(values.filter(value => value !== undefined && value !== null && value !== '')).size;
  const top = kind === 'model' ? modelTaskMetrics({ objectType: 'model', total: units.length, units,
    methods: completedTasks.flatMap(task => task.methods || []) }) : null;
  return {
    kind, tasks, completedTasks, taskCount: tasks.length, completedCount: completedTasks.length,
    executionRate: { ...average(executionRows.map(row => row.value)),
      executed: executionRows.reduce((sum, row) => sum + row.executed, 0),
      expected: executionRows.reduce((sum, row) => sum + row.expected, 0) },
    averageDuration: { ...average(operationalRows.map(row => row.timing.totalSeconds)), demo: operationalRows.some(row => row.timing.totalDemo) },
    averageTokens: { ...average(operationalRows.map(row => row.tokens.total)), demo: operationalRows.some(row => row.tokens.totalDemo) },
    asr: averageRate(metricRows.map(row => row.asr)),
    completionRate: averageRate(metricRows.map(row => row.completionRate)),
    suspectedAdoptionRate: averageRate(metricRows.map(row => row.suspectedAdoptionRate)),
    topMethod: top?.maxMethodAsr || null,
    topScenario: top?.maxScenarioAsr || null,
    insights: welcomeInsights(completedTasks, kind),
    coverage: {
      strategies: unique(completedTasks.filter(task => (task.units || []).some(unit => !unit.executionStatus || unit.executionStatus === 'done'))
        .map(task => task.configSnapshot?.strategyId || task.strategyId)),
      questions: kind === 'model' ? unique(units.map(unit => unit.questionId || unit.promptId || unit.target || unit.question)) : 0,
      methods: kind === 'model' ? unique(units.map(unit => unit.methodKey || unit.method)) : 0,
      environments: kind === 'agent' ? unique(units.map(unit => unit.sceneTaskId || unit.environmentId || unit.questionId || unit.sceneId)) : 0,
      targets: unique(completedTasks.map(task => stableAssetId(task.configSnapshot?.targetAssetId || task.targetId, kind) || `unlinked:${task.id}`)),
    },
    note: WELCOME_METRIC_NOTE,
  };
}

/** One point is one completed run with a final verdict. Sample size stays
 * explicit so a small Agent sample is not compared as equally precise. */
export function welcomeRunDistribution(tasks = []) {
  const points = tasks.filter(task => task.status === 'done').map(task => ({ task, ...taskMetricValues(task).asr }))
    .filter(metric => metric.denominator > 0 && Number.isFinite(metric.value));
  const maximum = Math.max(1, ...points.map(point => point.denominator));
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const fraction = maximum / magnitude;
  const ceiling = ([1, 2, 2.5, 5, 10].find(value => value > fraction) || 10) * magnitude;
  const xMax = Math.max(4, ceiling);
  const groups = new Map();
  for (const point of points) {
    const key = `${point.denominator}:${point.value}`;
    const group = groups.get(key) || { ...point, runs: [] };
    group.runs.push(point); groups.set(key, group);
  }
  const numerator = points.reduce((sum, point) => sum + point.numerator, 0);
  const denominator = points.reduce((sum, point) => sum + point.denominator, 0);
  return { points, clusters: [...groups.values()], xMax,
    asr: denominator ? numerator / denominator : null, numerator, denominator,
    maximumAsr: points.length ? Math.max(...points.map(point => point.value)) : null };
}

/** Keep every observed run: differences between configurations are not a
 * chronological improvement claim. Unknown verdicts remain absent, never 0%. */
export function welcomeAssetResults(tasks = []) {
  const groups = new Map();
  for (const task of tasks.filter(row => row.status === 'done')) {
    const kind = task.kind || task.objectType || 'model';
    const key = `${kind}:${task.configSnapshot?.targetAssetId || task.targetId || task.targetName || task.id}`;
    const row = groups.get(key) || { id: key, name: task.targetName || '未命名资产', kind, tasks: [] };
    row.tasks.push(task);
    groups.set(key, row);
  }
  return [...groups.values()].map(row => {
    row.tasks.sort((a, b) => welcomeTaskTimestamp(b) - welcomeTaskTimestamp(a));
    const observations = row.tasks.map(task => ({ task, ...taskMetricValues(task).asr }));
    const valid = observations.filter(metric => metric.denominator > 0 && Number.isFinite(metric.value));
    const values = valid.map(metric => metric.value);
    return { ...row, latest: row.tasks[0], observations, asr: average(values).value,
      minimum: values.length ? Math.min(...values) : null,
      maximum: values.length ? Math.max(...values) : null,
      breach: valid.reduce((sum, metric) => sum + metric.numerator, 0),
      judged: valid.reduce((sum, metric) => sum + metric.denominator, 0),
      assessedRuns: valid.length };
  }).sort((a, b) => (b.asr ?? -1) - (a.asr ?? -1));
}

const stableAssetId = (value, kind) => {
  const id = String(value || '').trim().replace(/@[^@]+$/, '');
  return kind === 'model' ? id.replace(/^tgt-/, 'mdl-') : id;
};

/** Current intake rows and archived results share a stable identity across
 * versions. Names never establish identity: unrelated same-name assets remain
 * separate, and removed assets retain their historical results. */
export function welcomeAssetDirectory(tasks = [], assets = []) {
  const groups = new Map();
  for (const asset of assets.filter(row => ['model', 'agent'].includes(row.kind))) {
    const assetId = stableAssetId(asset.id, asset.kind);
    if (!assetId) continue;
    const id = `${asset.kind}:${assetId}`;
    if (!groups.has(id)) groups.set(id, { id, assetId, kind: asset.kind, name: asset.name || '未命名资产', asset, status: asset.status, inDirectory: true, tasks: [] });
  }
  for (const task of tasks.filter(row => row.status === 'done')) {
    const kind = task.kind || task.objectType || 'model';
    const assetId = stableAssetId(task.configSnapshot?.targetAssetId || task.targetId, kind) || null;
    const id = `${kind}:${assetId || `history:${task.id}`}`;
    const group = groups.get(id) || { id, assetId, kind, name: task.targetName || '未命名历史资产', asset: null, status: 'historical', inDirectory: false, tasks: [] };
    group.tasks.push(task); groups.set(id, group);
  }
  return [...groups.values()].map(row => {
    const sorted = [...row.tasks].sort((a, b) => welcomeTaskTimestamp(b) - welcomeTaskTimestamp(a));
    const observations = sorted.map(task => ({ task, ...taskMetricValues({ ...task, objectType: row.kind }).asr }));
    const valid = observations.filter(metric => metric.denominator > 0 && Number.isFinite(metric.value));
    const values = valid.map(metric => metric.value), summary = groupSummary(sorted, row.kind);
    return { ...row, totalUnits: sorted.reduce((sum, task) => sum + Math.max(task.units?.length || 0, Number(task.total) || 0), 0), tasks: sorted, latest: sorted[0] || null, observations, asr: average(values).value,
      minimum: values.length ? Math.min(...values) : null, maximum: values.length ? Math.max(...values) : null,
      breach: valid.reduce((sum, metric) => sum + metric.numerator, 0), judged: valid.reduce((sum, metric) => sum + metric.denominator, 0), assessedRuns: valid.length,
      executionRate: summary.executionRate, averageDuration: summary.averageDuration, averageTokens: summary.averageTokens };
  }).sort((a, b) => Number(b.inDirectory) - Number(a.inDirectory) || (b.asr ?? -1) - (a.asr ?? -1) || b.tasks.length - a.tasks.length || a.name.localeCompare(b.name, 'zh-CN'));
}

/** A single current time anchors all homepage filters. Completed tasks share
 * the task-detail telemetry values and retain simulated-value provenance. */
export function welcomeDashboard({ modelTasks = [], agentTasks = [], days = 7, now = new Date() } = {}) {
  const rangeDays = [3, 7, 30].includes(Number(days)) ? Number(days) : 7;
  const to = Number(new Date(now));
  if (!Number.isFinite(to)) throw new TypeError('首页统计时间无效');
  const from = to - rangeDays * DAY;
  const tasks = [
    ...modelTasks.map(task => ({ ...task, kind: 'model', objectType: 'model' })),
    ...agentTasks.map(task => ({ ...task, kind: 'agent', objectType: 'agent' })),
  ].filter(task => {
    const timestamp = welcomeTaskTimestamp(task);
    return timestamp >= from && timestamp <= to;
  }).sort((a, b) => welcomeTaskTimestamp(b) - welcomeTaskTimestamp(a));
  return {
    days: rangeDays, from: new Date(from).toISOString(), to: new Date(to).toISOString(), tasks,
    counts: Object.fromEntries(['total', 'running', 'done', 'draft', 'ready', 'error', 'stopped']
      .map(status => [status, status === 'total' ? tasks.length : tasks.filter(task => task.status === status).length])),
    assets: welcomeAssetResults(tasks),
    model: groupSummary(tasks.filter(task => task.kind === 'model'), 'model'),
    agent: groupSummary(tasks.filter(task => task.kind === 'agent'), 'agent'),
  };
}
