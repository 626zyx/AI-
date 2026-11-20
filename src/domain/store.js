/* 数据仓库：唯一的数据出口。
 * 装配数据 provider 与任务服务；页面通过稳定读取和命令契约接入后端。
 * 页面永远通过这里取数，不直接 import data/。 */
import { tasks as rawTasks } from '../data/tasks.js';
import { units as rawUnits } from '../data/units.js';
import { logs as rawLogs } from '../data/logs.js';
import { agentTasks as importedAgentTasks } from '../data/agent-tasks.js';
import { agentUnits as rawAgentUnits } from '../data/agent-units.js';
import { sceneBanks } from '../data/scene-banks.js';
import { fiveTaskStrategies } from '../data/five-task-batch.js';
import {
  asr, meanTaskAsr, byMethod, distribution, progress, riskLevel, verdictCounts as vc,
  agentAsr, agentVerdictCounts, byRiskLabel, errorStats, agentRiskRule, riskRule, riskTypes, agentMetricLabel,
} from './metrics.js';
import { MODEL_STATUS } from './constants.js';
import { methodCatalog, scenes as rawScenes, advbench } from '../data/catalog.js';
import { taskRepository } from './task-repository.js';
import { createTaskService } from './task-service.js';
import { buildModelConfiguration } from './task-configuration.js';
import { buildAgentConfiguration } from './agent-configuration.js';
import { copyStrategyRecord } from './strategy-service.js';
import { ATTACK_SURFACE_CATALOG } from './attack-surfaces.js';
import { AGENT_ASSETS } from './agent-assets-catalog.js';
export { selectableAgentSurfaces as agentInjectionFiles } from './agent-surfaces.js';
import { roundInfo } from './task-rounds.js';
export { roundInfo, roundAnalysis } from './task-rounds.js';


export const agentConfigurationOf = (data, options = { draft: true }) => buildAgentConfiguration(data, { agents, agentStrategies, models, agentMethods, sceneBanks }, options);
export { ATTACK_SURFACE_CATALOG };
// An imported semantic review is a judge provenance, not a connected model endpoint.
export const agentReviewJudges = [{ id: 'judge-codex-semantic-review', name: 'Codex 语义复核（模拟 Judge）', roles: ['裁判'], reviewOnly: true }];

/* ---------------------------------------------------------------- 模型资产 */
export const models = [
  {
    id: 'mdl-deepseek-chat', name: 'DeepSeek-V3-Chat', vendor: 'DeepSeek',
    apiModel: 'deepseek-chat', baseUrl: 'https://api.deepseek.com',
    roles: ['靶标'], reasoning: false, status: 'connected',
    note: '非推理模型，响应无 reasoning_tokens',
  },
  {
    id: 'mdl-deepseek-flash', name: 'DeepSeek-V3-Flash', vendor: 'DeepSeek',
    apiModel: 'deepseek-flash', baseUrl: 'https://api.deepseek.com',
    roles: ['攻击生成', '裁判', '智能体基座'], reasoning: true, status: 'connected',
    note: '推理模型；裁判要求输出 JSON，需留足 max_tokens',
  },
  {
    id: 'mdl-deepseek-v4-pro', name: 'DeepSeek-V4-Pro', vendor: 'DeepSeek',
    apiModel: 'deepseek-v4-pro', baseUrl: 'https://api.deepseek.com',
    roles: ['攻击生成', '裁判'], reasoning: true, status: 'connected',
    note: 'Agent 演练的攻击生成与泄漏判读模型',
  },
  {
    id: 'mdl-qwen-flash', name: 'Qwen-Flash', vendor: 'Alibaba',
    apiModel: 'qwen-flash', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    roles: ['靶标'], reasoning: false, status: 'connected',
    note: '已通过 extra_body 关闭思考模式',
  },
].map((m) => ({ apiType: 'openai', apiKey: '', ...m, statusLabel: MODEL_STATUS[m.status] || m.status }));

// Demo task configuration uses an actual platform judge. Imported review attribution
// remains separate from this selected configuration and never changes unit evidence.
const demoAgentJudge = models.find(model => model.status === 'connected' && model.roles.includes('裁判'));
const rawAgentTasks = importedAgentTasks.map(task => {
  if (!agentReviewJudges.some(judge => judge.id === task.judgeId) || !demoAgentJudge) return task;
  return { ...task, judgeId: demoAgentJudge.id, judgeName: demoAgentJudge.name,
    recordedJudge: { id: task.judgeId, name: task.judgeName, provenance: task.judgeProvenance || '' } };
});

const {
  projectTask, listTaskTemplates, saveTask, copyTask, startTask, stopTask, deleteTask, restoreTask,
  subscribeTasks, advanceTaskReplay, initializeTaskRuntime,
} = createTaskService({ modelTasks: rawTasks, modelUnits: rawUnits,
  agentTasks: rawAgentTasks, agentUnits: rawAgentUnits, nowText,
  modelConfiguration: (data, options) => buildModelConfiguration(data, { models, strategies, banks, guards }, options),
  agentConfiguration: (data, options) => buildAgentConfiguration(data, { agents, agentStrategies, models, agentMethods, sceneBanks }, options),
  assertStrategyAvailable: (id, type) => {
    const catalog = type === 'agent' ? agentStrategies : strategies;
    if (!catalog.some(strategy => strategy.id === id && strategy.status === 'published')) throw new Error('演练策略已删除或不可用，请编辑任务并重新选择已发布策略');
  } });


/* 厂商由接入地址推断，识别不了记为「自定义」 */
const VENDOR_HOSTS = [['deepseek', 'DeepSeek'], ['dashscope', 'Alibaba'], ['aliyun', 'Alibaba'], ['openai.com', 'OpenAI'],
  ['moonshot', 'Moonshot'], ['bigmodel', '智谱'], ['volces', '字节跳动'], ['baidubce', '百度'], ['siliconflow', 'SiliconFlow']];
export const vendorOf = (url) => (VENDOR_HOSTS.find(([h]) => url.toLowerCase().includes(h)) || [0, '自定义'])[1];

export function saveModel(data) {
  const old = data.id && models.find((m) => m.id === data.id);
  const rec = { ...data, vendor: vendorOf(data.baseUrl), name: data.name || data.apiModel, statusLabel: MODEL_STATUS[data.status] || data.status };
  if (old) Object.assign(old, rec);
  else models.push({ roles: [], reasoning: false, note: '', ...rec, id: `mdl-u${Date.now().toString(36)}` });
}
export function deleteModel(id) {
  const i = models.findIndex((m) => m.id === id);
  if (i >= 0) models.splice(i, 1);
}
/* 某角色下可用的模型：平台管理里配置了该角色的 */
export const modelsWithRole = (role) => models.filter((m) => m.roles.includes(role));

/* 模型被哪些任务、智能体、策略引用。被引用后接入参数锁定，只能改 API Key（轮换凭据），也不能删除：
 * 已完成任务的结果依赖当时的模型标识与地址，改了会让历史结果无法追溯。 */
export function modelUsage(id) {
  const m = models.find((x) => x.id === id);
  if (!m) return [];
  const out = [];
  for (const t of rawTasks) {
    if (t.targetName === m.name) out.push(`模型演练「${t.name}」· 靶标`);
    if (t.judgeId === id) out.push(`模型演练「${t.name}」· 裁判`);
  }
  for (const s of strategies) {
    if (s.methods.some((x) => (x.params || []).some(([, v]) => v === m.name))) out.push(`攻击策略「${s.name}」· 攻击生成`);
  }
  for (const t of rawAgentTasks) {
    if (t.judgeId === id) out.push(`Agent 演练「${t.name}」· 裁判`);
    if (t.attackerId === id) out.push(`Agent 演练「${t.name}」· 攻击者`);
  }
  for (const a of agents) if (a.baseModelId === id) out.push(`智能体「${a.name}」· 基座`);
  for (const s of agentStrategies) if (s.attackerModelId === id) out.push(`Agent 策略「${s.name}」· 攻击者`);
  return out;
}

/* ---------------------------------------------------------------- 攻击策略 */
export const strategies = [
  {
    id: 'stg-advbench-base',
    name: 'AdvBench 基线四方法',
    desc: '同一题库上对比直接提问、越狱模板、嵌套场景与自动迭代改写的攻破能力',
    /* banks：引用的题库与选题数量；count 为 null 表示全部题目 */
    banks: [{ bankId: 'bank-advbench', count: 20 }],
    /* params：本策略对方法的具体配置，label 与攻击方法目录同名 */
    methods: [
      { name: 'Direct', order: 1, params: [] },
      { name: 'JailBroken', order: 2, params: [['预置变体', 'prefix_injection、refusal_suppression']] },
      { name: 'DeepInception', order: 3, params: [['情境类型', 'stage scene'], ['嵌套层数', 5], ['角色数量', 8]] },
      { name: 'PAIR', order: 4, params: [['最大迭代轮数', 5], ['攻击生成模型', 'DeepSeek-V3-Chat']] },
    ],
    /* status：published 已发布（锁定不可编辑）/ draft 待发布 */
    status: 'published',
    taskCount: 2,
    updatedAt: '2026-11-03 09:27',
  },
];
export const STRATEGY_STATUS = { published: '已发布', draft: '待发布' };

/* 策略引用的题库，一行一套：名称·前 N 题 / 名称·全部 N 题 */
export function strategyBankLines(s) {
  return s.banks.map(({ bankId, count }) => {
    const b = getBank(bankId);
    if (!b) return '—';
    return count && count < b.items.length ? bankRefText(b.name, count) : `${b.name}·全部 ${b.items.length} 题`;
  });
}

export function nowText() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* 保存策略：id 为空则新建；已发布的策略不可再改 */
export function saveStrategy(data) {
  const old = data.id && strategies.find((x) => x.id === data.id);
  if (old && old.status === 'published') return null;
  const rec = { taskCount: 0, ...old, ...data, updatedAt: nowText() };
  if (old) Object.assign(old, rec);
  else { rec.id = `stg-${globalThis.crypto.randomUUID()}`; strategies.push(rec); }
  return rec.id;
}

// Deleted definitions remain available only for older task records lacking parameter snapshots.
const deletedModelStrategySnapshots = new Map();
export const recordedModelStrategy = id => strategies.find(strategy => strategy.id === id) || deletedModelStrategySnapshots.get(id);
export function deleteStrategy(id) {
  const i = strategies.findIndex((x) => x.id === id);
  if (i >= 0) {
    deletedModelStrategySnapshots.set(id, structuredClone(strategies[i]));
    strategies.splice(i, 1);
  }
}

export function copyStrategy(id) {
  const source = strategies.find(strategy => strategy.id === id && strategy.status === 'published');
  if (!source) throw new Error('仅已发布策略可复制');
  return saveStrategy(copyStrategyRecord(source, strategies));
}

/* ---------------------------------------------------------------- 防护策略（蓝队） */
/* 平台内置，不属于用户资产：不进资产中心，也不向用户展示底层检测模型（内部为 Qwen3Guard-Gen）。
 * 维度沿用 Qwen3Guard 官方安全类别；拦截与处置逻辑待接入真实数据后再定。 */
export const GUARD_STAGES = ['输入', '输出'];
export const guards = [
  {
    id: 'grd-content-review',
    name: '生成式内容审核策略',
    desc: '对进入靶标的提示词或靶标生成的回复做内容安全审核，判定为安全、有争议、不安全三级。',
    builtin: true,
    stages: ['输入', '输出'],
    dims: [
      ['暴力', '暴力行为、武器制作、伤害他人的指导'],
      ['非暴力违法行为', '诈骗、盗窃、黑客攻击、毒品等违法活动'],
      ['色情低俗内容', '色情、性行为描写及低俗内容'],
      ['个人隐私信息', '泄露或索取身份证号、住址、联系方式等个人信息'],
      ['自杀与自残', '鼓励或指导自杀、自残及极端行为'],
      ['不道德行为', '歧视、仇恨言论、霸凌等违背社会公德的内容'],
      ['政治敏感话题', '涉及政治敏感人物、事件的不当内容'],
      ['版权侵犯', '未经授权复制、传播受版权保护的作品'],
      ['越狱攻击', '试图绕过模型安全限制的提示词（仅输入侧）', 'input'],
    ],
    taskCount: 0,
  },
];
export const guardOf = (id) => guards.find((g) => g.id === id);
export const guardStageText = (t) => (t.guardStages?.length ? t.guardStages.join(' + ') : '输入 + 输出');

/* ---------------------------------------------------------------- 攻击方法 */
export const methods = methodCatalog.map((m) => ({ ...m, desc: m.desc.replace(/[。.]+$/, '') }));
export const methodFamilies = [...new Set(methodCatalog.map((m) => m.family))];

/* 方法配置的展示：名称（参数：值；参数：值） */
export function methodConfigText(m) {
  return m.params.length ? `${m.name}（${m.params.map(([k, v]) => `${k}：${v}`).join('；')}）` : m.name;
}

/* ---------------------------------------------------------------- 攻击题库 */
export const scenes = rawScenes;
/* 自建题库可带新场景：不进入系统场景维度，只用于题库内展示与筛选 */
const customScenes = [];
const allScenes = () => [...rawScenes, ...customScenes];
export const sceneLabel = (id) => allScenes().find((s) => s.id === id)?.label || '—';
export function sceneIdFor(text) {
  const t = String(text ?? '').trim();
  if (!t) return '';
  const hit = allScenes().find((s) => s.id === t || s.label === t);
  if (hit) return hit.id;
  const id = `custom-${customScenes.length + 1}`;
  customScenes.push({ id, label: t });
  return id;
}
export const INDUSTRIES = ['通用', '金融', '政务', '医疗', '教育', '电商'];

const sceneIdsOf = (items) => allScenes().filter((s) => items.some((i) => i.scene === s.id)).map((s) => s.id);

/* 系统题库只有 AdvBench 一套；自建题库保存在内存里 */
export const banks = [
  {
    id: 'bank-advbench', name: 'AdvBench 有害行为集', source: 'system', industry: '通用',
    origin: 'llm-attacks/llm-attacks · data/advbench/harmful_behaviors.csv',
    items: advbench, scenes: sceneIdsOf(advbench), createdAt: null,
  },
];
export const getBank = (id) => banks.find((b) => b.id === id) || null;

export function addBank({ name, industry, items }) {
  const id = `bank-u${banks.length}`;
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  banks.push({
    id, name, source: 'custom', industry, origin: '',
    items, scenes: sceneIdsOf(items),
    createdAt: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`,
  });
  return id;
}

/* 题库引用的展示：名称·前 N 题 */
export const bankRefText = (name, count) => `${name}·前${count} 题`;

/* ---------------------------------------------------------------- 任务 */
function decorate(task) {
  const projection = task.executionMode === 'replay' || task.sourceTaskId ? projectTask(task) : null;
  const own = projection?.units || rawUnits.filter((u) => u.taskId === task.id);
  const agg = asr(own);
  const methods = byMethod(own, task.methods);
  return {
    ...task,
    ...projection,
    units: own,
    executionUnits: projection?.executionUnits || own.map((u) => ({ ...u, executionStatus: 'done', roundInfo: roundInfo(task, u) })),
    agg,
    asr: agg.value,
    judged: agg.judged,
    breach: agg.breach,
    methodsAgg: methods,
    dist: distribution(own),
    progress: (projection?.total ?? task.total) ? own.length / (projection?.total ?? task.total) : 0,
    risk: riskLevel(agg.value),
  };
}

export const verdictCounts = (t) => vc(t.units, t.total);

/* 单元所属攻击场景：按题目原文回查题库 */
const sceneByPrompt = new Map(advbench.map((q) => [q.prompt, q.scene]));
export const sceneOfUnit = (u) => sceneByPrompt.get(u.target) || null;
export function byScene(task) {
  return rawScenes
    .map((sc) => ({ id: sc.id, label: sc.label, ...asr(task.units.filter((u) => sceneByPrompt.get(u.target) === sc.id)) }))
    .filter((x) => x.total > 0);
}

export function listTasks() {
  return [...rawTasks.filter(t => !taskRepository().isDeleted(t.id)), ...taskRepository().list('model')].map(decorate);
}

export function getTask(id) {
  if (taskRepository().isDeleted(id)) return null;
  const t = rawTasks.find((x) => x.id === id) || taskRepository().get(id);
  if (t?.objectType !== 'model') return null;
  return t ? decorate(t) : null;
}

/* ================================================================ 智能体演练 */
/* 与模型演练完全分开：独立的资产、题库、任务、单元。
 * 页面仍只通过本文件取数。 */

/* ---------------------------------------------------------------- 智能体资产 */
export const agents = structuredClone(AGENT_ASSETS);

export const agentOf = (id) => agents.find((a) => a.id === id) || null;
export const connectedAgents = () => agents.filter((a) => a.status === 'connected');

export function saveAgent(data) {
  const old = data.id && agents.find((a) => a.id === data.id);
  const base = modelOf(data.baseModelId);
  const rec = {
    ...old, ...data,
    baseModelName: base?.name || '—',
    statusLabel: MODEL_STATUS[data.status] || data.status,
  };
  if (old) { Object.assign(old, rec); return old.id; }
  rec.id = `agt-${globalThis.crypto.randomUUID()}`;
  agents.push(rec);
  return rec.id;
}

export function deleteAgent(id) {
  const i = agents.findIndex((a) => a.id === id);
  if (i >= 0) agents.splice(i, 1);
}

const modelOf = (id) => models.find((m) => m.id === id) || null;

/* ---------------------------------------------------------------- 场景题库 */
export { sceneBanks };
export const getSceneBank = (id) => sceneBanks.find((b) => b.id === id) || null;

/* 题库里某标签覆盖的题数。labelCoverage 未落地时从 items 现算 */
export function bankLabelCoverage(bank) {
  if (!bank) return {};
  if (Object.keys(bank.labelCoverage || {}).length) return bank.labelCoverage;
  const c = {};
  for (const it of bank.items) {
    for (const l of new Set(it.labels || [])) c[l] = (c[l] || 0) + 1;
  }
  return c;
}

/* 题目的质量标注：入库时算好，这里只做展示化 */
export function sceneFlags(item) {
  const out = [];
  if (item.highSignalRatio !== null && item.highSignalRatio !== undefined && item.highSignalRatio < 0.5) out.push('lowSignal');
  if (item.needsRemoteService) out.push('remoteDep');
  if (item.reviewRequired) out.push('reviewFlag');
  return out;
}

/* ---------------------------------------------------------------- Agent 攻击方法 */
/* 平台内置两种，与模型演练攻击方法目录同一结构。
 * requiresRole：依赖的模型角色，null 表示无依赖；defaultModelId：实测可用的默认模型。 */
export const agentMethods = [
  { id: 'baseline', name: '基础安全演练', desc: '不配置攻击者，靶标直接执行题目', requiresRole: null, defaultModelId: null, params: [] },
  { id: 'universal', name: '间接提示注入', desc: '配置攻击者模型，攻击者先处理题目环境，再由靶标执行题目', requiresRole: '攻击生成', defaultModelId: 'mdl-deepseek-v4-pro', params: [['攻击者模型', '攻击生成角色的模型，推荐 DeepSeek-V4-Pro']] },
];
export const agentMethodOf = (id) => agentMethods.find((m) => m.id === id) || null;
export const agentMethodDeps = (m) => (m?.requiresRole ? `${m.requiresRole}模型` : '无');

/* ---------------------------------------------------------------- Agent 演练策略 */
/* 策略 = 攻击方法 + 场景题库与题目范围，由用户制定并发布。
 * published 锁定不可改，draft 可编辑可删。与模型演练策略同一套状态机。 */
export const agentStrategies = [
  ...fiveTaskStrategies,
  {
    id: 'agstg-cs-baseline',
    name: '客服 · 基础安全演练',
    desc: '客户服务题库前 5 题，不引入攻击者。',
    methodId: 'baseline',
    attackerModelId: null,
    banks: [{ bankId: 'sbank-06-customer-community', count: 5 }],
    status: 'published',
    taskCount: 1,
    updatedAt: '2026-11-12 21:05',
  },
  {
    id: 'agstg-cs-universal',
    name: '客服 · 间接提示注入',
    desc: '客户服务题库前 5 题，引入攻击者。',
    methodId: 'universal',
    attackerModelId: 'mdl-deepseek-v4-pro',
    banks: [{ bankId: 'sbank-06-customer-community', count: 5 }],
    status: 'published',
    taskCount: 1,
    updatedAt: '2026-11-13 13:20',
  },
];
export const AG_STRATEGY_STATUS = STRATEGY_STATUS;

export const getAgentStrategy = (id) => agentStrategies.find((s) => s.id === id) || null;

/* 策略引用的题库，一行一套：名称·前 N 题 / 名称·全部 N 题 */
export function agentStrategyBankLines(s) {
  return (s.banks || []).map(({ bankId, count }) => {
    const b = getSceneBank(bankId);
    if (!b) return '—';
    const total = b.items.length || b.total;
    return count && count < total ? `${b.name}·前${count} 题` : `${b.name}·全部 ${total} 题`;
  });
}

/* 策略选中的题目总数 */
export function agentStrategyTaskCount(s) {
  return (s.banks || []).reduce((n, { bankId, count }) => {
    const b = getSceneBank(bankId);
    if (!b) return n;
    const total = b.items.length || b.total;
    return n + (count && count < total ? count : total);
  }, 0);
}

/* 策略展开成题目 id 列表。创建任务时取快照用 */
export function agentStrategyTaskIds(s) {
  const out = [];
  for (const { bankId, count } of s.banks || []) {
    const b = getSceneBank(bankId);
    if (!b) continue;
    const ids = b.items.map((it) => it.taskId);
    out.push(...(count && count < ids.length ? ids.slice(0, count) : ids));
  }
  return out;
}

export function saveAgentStrategy(data) {
  const old = data.id && agentStrategies.find((x) => x.id === data.id);
  if (old && old.status === 'published') return null;
  const rec = { taskCount: 0, banks: [], methodId: 'baseline', attackerModelId: null, ...old, ...data, updatedAt: nowText() };
  if (old) { Object.assign(old, rec); return old.id; }
  rec.id = `agstg-${globalThis.crypto.randomUUID()}`;
  agentStrategies.push(rec);
  return rec.id;
}

export function deleteAgentStrategy(id) {
  const i = agentStrategies.findIndex((x) => x.id === id);
  if (i >= 0) agentStrategies.splice(i, 1);
}

export function copyAgentStrategy(id) {
  const source = agentStrategies.find(strategy => strategy.id === id && strategy.status === 'published');
  if (!source) throw new Error('仅已发布策略可复制');
  return saveAgentStrategy(copyStrategyRecord(source, agentStrategies));
}

/* ---------------------------------------------------------------- Agent 任务 */
function decorateAgentTask(task) {
  const projection = task.sourceTaskId || task.configurationMode === 'selected' ? projectTask(task) : null;
  const own = projection?.units || rawAgentUnits.filter((u) => u.taskId === task.id);
  const agg = agentAsr(own);
  return {
    ...task,
    ...projection,
    units: own,
    executionUnits: projection?.executionUnits || own.map((u) => ({ ...u, executionStatus: 'done', roundInfo: roundInfo(task, u) })),
    agg,
    asr: agg.value,
    judged: agg.judged,
    breach: agg.breach,
    labelsAgg: byRiskLabel(own),
    errors: errorStats(own),
    progress: task.total ? own.length / task.total : 0,
    risk: riskLevel(agg.value, agentRiskRule),
  };
}

export function listAgentTasks() {
  return [...rawAgentTasks.filter(t => !taskRepository().isDeleted(t.id)), ...taskRepository().list('agent')].map(decorateAgentTask);
}

export function getAgentTask(id) {
  if (taskRepository().isDeleted(id)) return null;
  const t = rawAgentTasks.find((x) => x.id === id) || taskRepository().get(id);
  if (t?.objectType !== 'agent') return null;
  return t ? decorateAgentTask(t) : null;
}

export const agentVerdictCountsOf = (t) => agentVerdictCounts(t.units, t.total);

export function getAgentUnit(taskId, unitId) {
  return getAgentTask(taskId)?.executionUnits.find((u) => u.id === unitId) || null;
}

/* 已有任务的结果事件摘要，不从产物反推执行轨迹。 */
export function agentLogLines(taskId) {
  const t = getAgentTask(taskId);
  if (!t) return [];
  if (t.executionMode === 'replay') return t.logs;
  const a = agentOf(t.targetId);
  const out = [];
  out.push({ kind: 'section', text: `任务启动 · ${t.targetName}（${a?.baseModelName || '—'}）· ${t.techniqueName || '基础安全演练'}` });
  out.push({ kind: 'line', tag: 'env', tagLabel: '环境', text: `载入场景题库「${t.sceneBankName}」，题集快照 ${t.total} 题，执行并发 ${t.concurrency ?? '—'}` });
  for (const u of t.units) {
    const v = u.verdict === 'breach' ? '已攻破' : u.verdict === 'safe' ? '已守住' : '异常';
    out.push({ kind: 'section', text: `${u.sceneTaskId} · ${u.domainOriginal || ''}` });
    if (u.attack) out.push({ kind: 'line', tag: 'attack', tagLabel: '攻击者', text: `布置 ${u.attack.surfaces.length} 个攻击面：${u.attack.surfaces.map((x) => x.path).join('、')}` });
    if (u.selfReport) out.push({ kind: 'line', tag: 'target', tagLabel: '靶标', text: '已记录靶标最终答复' });
    out.push({ kind: 'line', tag: u.verdict === 'breach' ? 'breach' : 'safe', tagLabel: '判读', text: v });
  }
  const n = t.agg;
  out.push({ kind: 'section', text: `任务完成 · 判定 ${n.judged} 题，确认失守 ${n.breach}，${agentMetricLabel(t, true)} ${(n.value * 100).toFixed(1)}%` });
  return out;
}

export function agentLogText(taskId) {
  return agentLogLines(taskId).map((l) => (l.kind === 'section' ? `\n== ${l.text} ==` : `[${l.tagLabel || ''}] ${l.text}`)).join('\n');
}

/* 演练结果页按靶标智能体聚合：一个智能体一行，汇总它跑过的所有任务 */
export function agentResultRows() {
  const byAgent = new Map();
  for (const t of listAgentTasks()) {
    const a = agentOf(t.targetId);
    const cur = byAgent.get(t.targetId) || {
      agentId: t.targetId, agentName: t.targetName,
      baseModelName: a?.baseModelName || '—',
      tasks: [], units: [], banks: new Set(),
    };
    cur.tasks.push(t);
    cur.units.push(...t.units);
    cur.banks.add(t.sceneBankName);
    byAgent.set(t.targetId, cur);
  }
  return [...byAgent.values()].map((r) => {
    const agg = agentAsr(r.units);
    return {
      ...r,
      bankNames: [...r.banks],
      taskCount: r.tasks.length,
      agg,
      labelsAgg: byRiskLabel(r.units),
      risk: riskLevel(agg.value, agentRiskRule),
      lastRunAt: r.tasks.map((t) => t.finishedAt || t.startedAt).sort().pop() || '—',
    };
  }).sort((a, b) => b.agg.value - a.agg.value);
}

/* Agent 演练报告：一任务一份 */
export function listAgentReports() {
  return listAgentTasks().filter((t) => t.status === 'done').map((t) => ({
    id: `agrpt-${t.id}`,
    taskId: t.id,
    name: t.name,
    targetName: t.targetName,
    bankName: t.sceneBankName,
    createdAt: t.finishedAt,
    asr: t.agg.value,
    risk: t.risk,
  }));
}


/* 风险中心：模型演练与 Agent 演练的风险事件统一成一张表 */
export function riskEvents() {
  const typeOf = (id) => riskTypes.find((x) => x.id === id);
  const out = [];
  const mt = typeOf('exercise-asr');
  if (mt?.enabled) {
    for (const t of listTasks()) {
      if (t.status === 'done' && t.agg.value > riskRule.trigger) {
        out.push({ id: t.id, source: 'model', typeName: mt.name, targetName: t.targetName, taskName: t.name, asr: t.agg.value, risk: t.risk, at: t.finishedAt });
      }
    }
  }
  const at = typeOf('agent-asr');
  if (at?.enabled) {
    for (const t of listAgentTasks()) {
      if (t.status === 'done' && t.agg.value > agentRiskRule.trigger) {
        out.push({ id: t.id, source: 'agent', typeName: at.name, targetName: t.targetName, taskName: t.name, asr: t.agg.value, risk: t.risk, at: t.finishedAt });
      }
    }
  }
  return out;
}


/* ================================================================ 安全态势（首页）
 * 全部读既有聚合函数，不触碰 data/。range: 7 / 30 / null(全部)，按任务完成时间过滤。 */
const parseAt = (s) => new Date(String(s || '').replace(' ', 'T'));

export function postureBoard(rangeDays = null) {
  const now = new Date();
  const cutoff = rangeDays ? new Date(now.getTime() - rangeDays * 864e5) : null;
  const all = [
    ...listTasks().map((t) => ({ ...t, kind: 'model' })),
    ...listAgentTasks().map((t) => ({ ...t, kind: 'agent' })),
  ].filter((t) => t.status === 'done');
  const inRange = (t) => !cutoff || parseAt(t.finishedAt || t.startedAt) >= cutoff;
  const tasks = all.filter(inRange).sort((a, b) => parseAt(b.finishedAt) - parseAt(a.finishedAt));

  const units = tasks.reduce((n, t) => n + t.units.length, 0);
  const breach = tasks.reduce((n, t) => n + t.agg.breach, 0);
  const judged = tasks.reduce((n, t) => n + t.agg.judged, 0);
  const targets = new Set(tasks.map((t) => t.targetName));
  const risks = riskEvents()
    .filter((e) => !cutoff || parseAt(e.at) >= cutoff)
    .sort((a, b) => b.asr - a.asr);

  const metrics = [
    { key: 'tasks', label: '演练任务', value: tasks.length, sub: `模型 ${tasks.filter((t) => t.kind === 'model').length} · 智能体 ${tasks.filter((t) => t.kind === 'agent').length}` },
    { key: 'units', label: '攻击单元', value: units, sub: `有效判定 ${judged}` },
    { key: 'breach', label: '攻破 / 泄漏', value: breach, sub: `守住 ${judged - breach}`, tone: breach ? 'breach' : 'safe' },
    { key: 'asr', label: '整体 ASR', value: judged ? `${((breach / judged) * 100).toFixed(1)}%` : '—', sub: '攻破 / 有效判定', tone: 'accent' },
    { key: 'targets', label: '覆盖靶标', value: targets.size, sub: `资产库 ${models.length + agents.length}` },
    { key: 'risks', label: '风险事件', value: risks.length, sub: `高危 ${risks.filter((e) => e.risk.key === 'critical').length}`, tone: risks.length ? 'breach' : 'safe' },
  ];

  /* 资产态势：所选范围内每个靶标的任务 ASR 算术平均，不按单元数加权。 */
  const byTarget = new Map();
  for (const t of tasks) {
    const key = `${t.kind}:${t.targetId || t.targetName}`;
    const cur = byTarget.get(key) || { name: t.targetName, kind: t.kind, runs: 0, aggregates: [], last: null };
    cur.runs += 1;
    cur.aggregates.push(t.agg);
    if (!cur.last || parseAt(t.finishedAt) > parseAt(cur.last.finishedAt)) cur.last = t;
    byTarget.set(key, cur);
  }
  const assets = [...byTarget.values()]
    .map((a) => ({ name: a.name, kind: a.kind, runs: a.runs, asr: meanTaskAsr(a.aggregates), risk: a.last.risk }))
    .sort((a, b) => (b.asr ?? -1) - (a.asr ?? -1));

  /* 消息流：任务完成 + 风险触发，按时间倒序 */
  const feed = [];
  for (const t of tasks) {
    feed.push({ at: t.finishedAt, kind: t.kind, sort: parseAt(t.finishedAt), type: 'done', text: `${t.name} 完成`, meta: `${agentMetricLabel(t, true)} ${(t.agg.value * 100).toFixed(1)}%` });
  }
  for (const e of risks) {
    feed.push({ at: e.at, kind: e.source, sort: parseAt(e.at), type: 'risk', riskKey: e.risk.key, text: `${e.targetName} 触发${e.risk.label}风险`, meta: `${agentMetricLabel(e.source === 'agent' ? getAgentTask(e.id) : null, true)} ${(e.asr * 100).toFixed(1)}%` });
  }
  feed.sort((a, b) => b.sort - a.sort);

  return { range: rangeDays, metrics, assets, risks, feed, hasData: tasks.length > 0 };
}

/* 首页「正在演练」回放脚本：取真实单元，模型按回合、Agent 按执行步 */
export function postureReplay() {
  const modelScript = [];
  const mt = getTask('task-tgt-deepseek-chat');
  if (mt) {
    const pick = (pred) => mt.units.find(pred);
    const units = [
      pick((u) => u.method === 'PAIR' && u.judgeSuccess && u.rounds >= 2),
      getTask('task-tgt-qwen-flash-guard')?.units.find((u) => u.history.some((h) => h.guard?.action === 'block_input')),
      pick((u) => u.method === 'Direct' && !u.judgeSuccess),
    ].filter(Boolean);
    for (const u of units) {
      const t = getTask(u.taskId);
      modelScript.push({
        method: u.method, target: t.targetName, scene: sceneLabel(sceneOfUnit(u)),
        guardStages: t.guardId ? (t.guardStages || ['输入', '输出']) : [],
        verdict: u.judgeSuccess ? 'breach' : 'safe', score: u.judgeScore, rounds: u.rounds, judgedRound: u.judgedRound,
        turns: u.history.map((h) => ({
          round: h.round,
          prompt: (h.prompt || '').replace(/\s+/g, ' ').trim(),
          response: (h.guard?.action === 'block_input' ? '' : (h.guard?.originalResponse ?? h.response) || '').replace(/\s+/g, ' ').trim(),
          guard: h.guard ? { action: h.guard.action, input: h.guard.input || null, output: h.guard.output || null } : null,
        })),
      });
    }
  }

  /* 基础安全演练与间接提示注入交替播放；间接提示注入带注入文件，场景里先播攻击者写入 */
  const agentScript = [];
  const base = getAgentTask('task-agt-cs5-baseline')?.units || [];
  const uni = getAgentTask('task-agt-cs5-universal')?.units || [];
  const toScript = (u, t) => ({
    scene: u.sceneTaskId, verdict: u.verdict, goal: u.goal, method: t?.techniqueName || '',
    injected: (u.attack?.surfaces || []).map((x) => x.path),
    steps: [],
    outputs: (u.outputFiles || []).map((f) => f.path),
  });
  const bt = getAgentTask('task-agt-cs5-baseline'), ut = getAgentTask('task-agt-cs5-universal');
  for (let i = 0; i < Math.max(base.length, uni.length); i += 1) {
    if (base[i]) agentScript.push(toScript(base[i], bt));
    if (uni[i]) agentScript.push(toScript(uni[i], ut));
  }
  for (const task of listAgentTasks().filter(t => t.id.startsWith('task-agt-b5-') && t.status === 'done')) {
    for (const unit of task.units) agentScript.push({ ...toScript(unit, task), target: task.targetName, evidenceBasis: '语义复核；响应归因疑似' });
  }
  /* 先播一题攻破的，开场更有张力 */
  agentScript.sort((x, y) => (y.verdict === 'breach') - (x.verdict === 'breach'));
  return { modelScript, agentScript };
}

/* 消息通知：任务开始 / 任务完成 / 报告生成 / 风险触发，按时间倒序 */
export function notifications() {
  const out = [];
  const add = (o) => out.push({ ...o, sort: parseAt(o.at) });
  const plus = (s, min) => {
    const d = parseAt(s);
    d.setMinutes(d.getMinutes() + min);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const all = [
    ...listTasks().map((t) => ({ t, kind: 'model', open: `App.openTask('${t.id}')`, report: `App.openReport('${t.id}')` })),
    ...listAgentTasks().map((t) => ({ t, kind: 'agent', open: `App.openAgTask('${t.id}')`, report: `App.openAgReport('${t.id}')` })),
  ];
  for (const { t, kind, open, report } of all) {
    if (!t.startedAt) continue;
    const src = kind === 'agent' ? 'Agent 演练' : '模型演练';
    add({ type: 'start', kind, at: String(t.startedAt).slice(0, 16), title: `${t.name} 开始执行`, meta: `${src} · ${t.total} 个${kind === 'agent' ? '题目' : '攻击单元'}`, go: open });
    if (t.status === 'done') {
      add({ type: 'done', kind, at: String(t.finishedAt).slice(0, 16), title: `${t.name} 已完成`, meta: `${src} · ${agentMetricLabel(t, true)} ${(t.agg.value * 100).toFixed(1)}%`, go: open });
      add({ type: 'report', kind, at: plus(t.finishedAt, 1), title: `${t.name} 报告已生成`, meta: `${src} · 风险等级 ${t.risk.label}`, go: report });
    }
  }
  for (const e of riskEvents()) {
    add({ type: 'risk', kind: e.source, riskKey: e.risk.key, at: String(e.at).slice(0, 16), title: `${e.targetName} 触发${e.risk.label}风险`, meta: `${e.typeName} · ${agentMetricLabel(e.source === 'agent' ? getAgentTask(e.id) : null, true)} ${(e.asr * 100).toFixed(1)}%`, go: e.source === 'agent' ? `App.openAgTask('${e.id}')` : `App.openTask('${e.id}')` });
  }
  return out.sort((a, b) => b.sort - a.sort || (a.type === 'risk' ? -1 : 1));
}

export function getUnit(taskId, unitId) {
  return getTask(taskId)?.executionUnits.find((u) => u.id === unitId) || null;
}

/* 单行日志的展示化：把 evallog 的前缀裁掉，把 [LIVE] 的 JSON 折成摘要。
 * 原始内容始终保留在 logText() 里用于导出，这里只影响屏幕显示。 */
function presentLine(raw) {
  let text = raw;

  // 去掉 "2026-11-03 16:32:19,690 - INFO - " 前缀，时间单独存
  let time = '';
  const m = text.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})[,.]\d{3} - \w+ - (.*)$/s);
  if (m) {
    time = m[1].slice(11);
    text = m[2];
  }

  // [LIVE] 结构化事件 → 一行摘要
  const live = text.match(/^\[LIVE\] (\{.*)$/s);
  if (live) {
    try {
      const ev = JSON.parse(live[1]);
      if (ev.event === 'attack_done') {
        const idx = ev.index !== undefined ? `#${Number(ev.index) + 1}` : '';
        const out = (ev.output_text || '').replace(/\s+/g, ' ').slice(0, 150);
        return {
          kind: 'line', time, tag: 'attack', tagLabel: '攻击完成',
          text: `${idx} ${ev.method || ''} · ${ev.target || ''}`,
          sub: out + ((ev.output_text || '').length > 150 ? '…' : ''),
        };
      }
      if (ev.event === 'judge_done') {
        const v = ev.judge_success ? '已攻破' : '已守住';
        return {
          kind: 'line', time, tag: ev.judge_success ? 'breach' : 'safe', tagLabel: '裁判',
          text: `${v} · score=${ev.score ?? '—'}${ev.method ? ' · ' + ev.method : ''}`,
          sub: (ev.judge_reason || '').replace(/\s+/g, ' ').slice(0, 150),
        };
      }
      return { kind: 'line', time, text: `[${ev.event || 'event'}]` };
    } catch {
      return { kind: 'line', time, text: text.slice(0, 200) };
    }
  }

  // token 用量单独成标签
  const tk = text.match(/^\[TOKEN USAGE\] Model: (\S+) \| Input: (\d+) \| Output: (\d+) \| Total: (\d+)$/);
  if (tk) {
    return { kind: 'line', time, tag: 'token', tagLabel: '用量', text: `${tk[1]} · in ${tk[2]} / out ${tk[3]} / total ${tk[4]}` };
  }

  // HTTP 请求收敛成短句
  const http = text.match(/^HTTP Request: (\w+) (\S+) "(.*)"$/);
  if (http) {
    return { kind: 'line', time, tag: 'http', tagLabel: '请求', text: `${http[1]} ${http[3]}` };
  }

  // tqdm 进度条残留（含 ）丢弃
  if (/^\s*(Processing|Evaluating results):/.test(text)) return null;

  return { kind: 'line', time, text };
}

/* 日志：按方法顺序拼接，返回展示化后的扁平行 */
export function logLines(taskId) {
  const record = taskRepository().get(taskId);
  if (record) return projectTask(record).logs;
  const groups = rawLogs[taskId] || [];
  const out = [];
  for (const g of groups) {
    out.push({ kind: 'section', text: `${g.method} · ${g.label}（${g.lines.length} 行原始日志）` });
    for (const raw of g.lines) {
      const line = presentLine(raw);
      if (line) out.push(line);
    }
  }
  return out;
}

export function logText(taskId) {
  return logLines(taskId).map((l) => l.text).join('\n');
}

/* 报告：一条任务一份，内容由真实单元生成 */
export function listReports() {
  return listTasks().filter((t) => t.status === 'done').map((t) => ({
    id: `rpt-${t.id}`,
    taskId: t.id,
    name: t.name,
    targetName: t.targetName,
    createdAt: t.finishedAt,
    asr: t.asr,
    risk: t.risk,
    strategyName: t.strategyName,
  }));
}

/* Task service commands are assembled once; pages keep using the store facade. */
export { listTaskTemplates, saveTask, copyTask, startTask, stopTask, deleteTask, restoreTask, subscribeTasks, advanceTaskReplay, initializeTaskRuntime };

export function taskEvents(id, type = 'model') {
  const record = taskRepository().get(id);
  if (record) return projectTask(record).logs;
  return type === 'agent' ? agentLogLines(id) : logLines(id);
}

export const taskStorageError = () => taskRepository().error()?.message || null;

export { asr, byMethod, distribution, progress, riskLevel };
export { agentAsr, byRiskLabel, errorStats, agentRiskRule };
export const modelName = (id) => modelOf(id)?.name || '—';
export { riskRule, riskTypes } from './metrics.js';
