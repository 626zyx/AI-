import { taskMetricValues, modelTaskMetrics } from './metrics.js';
import { taskOperationalMetrics } from './task-technical-metrics.js';

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
    coverage: {
      questions: kind === 'model' ? unique(units.map(unit => unit.questionId || unit.promptId || unit.target || unit.question)) : 0,
      methods: kind === 'model' ? unique(units.map(unit => unit.methodKey || unit.method)) : 0,
      environments: kind === 'agent' ? unique(units.map(unit => unit.sceneTaskId || unit.environmentId || unit.questionId || unit.sceneId)) : 0,
      targets: unique(completedTasks.map(task => task.targetId || task.targetName)),
    },
    note: WELCOME_METRIC_NOTE,
  };
}

/** A single current time anchors all homepage filters. Missing measurements stay
 * null; only the shared operational display layer supplies demo technical data. */
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
    counts: { total: tasks.length, running: tasks.filter(task => task.status === 'running').length,
      done: tasks.filter(task => task.status === 'done').length, draft: tasks.filter(task => task.status === 'draft').length },
    model: groupSummary(tasks.filter(task => task.kind === 'model'), 'model'),
    agent: groupSummary(tasks.filter(task => task.kind === 'agent'), 'agent'),
  };
}
