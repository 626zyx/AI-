/* 数据仓库：唯一的数据出口。
 * 目前读 src/data 的真实快照；接后端时只改这一个文件里的读取实现。
 * 页面永远通过这里取数，不直接 import data/。 */
import { tasks as rawTasks } from '../data/tasks.js';
import { units as rawUnits } from '../data/units.js';
import { logs as rawLogs } from '../data/logs.js';
import { agentTasks as rawAgentTasks } from '../data/agent-tasks.js';
import { agentUnits as rawAgentUnits } from '../data/agent-units.js';
import { sceneBanks } from '../data/scene-banks.js';
import {
  asr, byMethod, distribution, progress, riskLevel, verdictCounts as vc,
  agentAsr, agentVerdictCounts, byRiskLabel, markerStats,
} from './metrics.js';
import { MODEL_STATUS } from './constants.js';
import { methodCatalog, scenes as rawScenes, advbench } from '../data/catalog.js';

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
    roles: ['攻击生成', '裁判'], reasoning: true, status: 'connected',
    note: '推理模型；裁判要求输出 JSON，需留足 max_tokens',
  },
  {
    id: 'mdl-qwen-flash', name: 'Qwen-Flash', vendor: 'Alibaba',
    apiModel: 'qwen-flash', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    roles: ['靶标'], reasoning: false, status: 'connected',
    note: '已通过 extra_body 关闭思考模式',
  },
].map((m) => ({ apiType: 'openai', apiKey: '', ...m, statusLabel: MODEL_STATUS[m.status] || m.status }));

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
  else { rec.id = `stg-u${Date.now().toString(36)}`; strategies.push(rec); }
  return rec.id;
}

export function deleteStrategy(id) {
  const i = strategies.findIndex((x) => x.id === id && x.status === 'draft');
  if (i >= 0) strategies.splice(i, 1);
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
  const own = rawUnits.filter((u) => u.taskId === task.id);
  const agg = asr(own);
  const methods = byMethod(own, task.methods);
  return {
    ...task,
    units: own,
    agg,
    methodsAgg: methods,
    dist: distribution(own),
    progress: progress(task),
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
  return rawTasks.map(decorate);
}

export function getTask(id) {
  const t = rawTasks.find((x) => x.id === id);
  return t ? decorate(t) : null;
}

/* ================================================================ 智能体演练 */
/* 与模型演练完全分开：独立的资产、题库、任务、单元。
 * 页面仍只通过本文件取数。 */

/* ---------------------------------------------------------------- 智能体资产 */
export const agents = [];

export const agentOf = (id) => agents.find((a) => a.id === id) || null;
export const connectedAgents = () => agents.filter((a) => a.status === 'connected');

export function saveAgent(data) {
  const old = data.id && agents.find((a) => a.id === data.id);
  const base = modelOf(data.baseModelId);
  const rec = {
    surfaces: [], note: '', delivery: 'env', envNames: '', configPath: '', configFormat: 'json',
    ...old, ...data,
    baseModelName: base?.name || '—',
    statusLabel: MODEL_STATUS[data.status] || data.status,
  };
  if (old) { Object.assign(old, rec); return old.id; }
  rec.id = `agt-u${Date.now().toString(36)}`;
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

/* ---------------------------------------------------------------- Agent 演练策略 */
/* 策略 = 题库 + 题目范围。一期没有攻击方法维度，二期才加攻击入口。
 * published 锁定不可改，draft 可编辑可删。与模型演练策略同一套状态机。 */
export const agentStrategies = [];
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
  const rec = { taskCount: 0, banks: [], maxIterations: 1, ...old, ...data, updatedAt: nowText() };
  if (old) { Object.assign(old, rec); return old.id; }
  rec.id = `agstg-u${Date.now().toString(36)}`;
  agentStrategies.push(rec);
  return rec.id;
}

export function deleteAgentStrategy(id) {
  const i = agentStrategies.findIndex((x) => x.id === id && x.status === 'draft');
  if (i >= 0) agentStrategies.splice(i, 1);
}

/* ---------------------------------------------------------------- Agent 任务 */
function decorateAgentTask(task) {
  const own = rawAgentUnits.filter((u) => u.taskId === task.id);
  const agg = agentAsr(own);
  return {
    ...task,
    units: own,
    agg,
    labelsAgg: byRiskLabel(own),
    markers: markerStats(own),
    progress: progress(task),
    risk: riskLevel(agg.value),
  };
}

export function listAgentTasks() {
  return rawAgentTasks.map(decorateAgentTask);
}

export function getAgentTask(id) {
  const t = rawAgentTasks.find((x) => x.id === id);
  return t ? decorateAgentTask(t) : null;
}

export const agentVerdictCountsOf = (t) => agentVerdictCounts(t.units, t.total);

export function getAgentUnit(taskId, unitId) {
  return rawAgentUnits.find((u) => u.taskId === taskId && u.id === unitId) || null;
}

/* 演练结果页按靶标智能体聚合：一个智能体一行，汇总它跑过的所有任务 */
export function agentResultRows() {
  const byAgent = new Map();
  for (const t of listAgentTasks()) {
    const a = agentOf(t.targetId);
    const cur = byAgent.get(t.targetId) || {
      agentId: t.targetId, agentName: t.targetName,
      launchCmd: a?.launchCmd || '—',
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
      risk: riskLevel(agg.value),
      lastRunAt: r.tasks.map((t) => t.finishedAt || t.startedAt).sort().pop() || '—',
    };
  }).sort((a, b) => b.agg.value - a.agg.value);
}

/* Agent 演练报告：一任务一份 */
export function listAgentReports() {
  return listAgentTasks().map((t) => ({
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


export function getUnit(taskId, unitId) {
  return rawUnits.find((u) => u.taskId === taskId && u.id === unitId) || null;
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
  return listTasks().map((t) => ({
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

export { asr, byMethod, distribution, progress, riskLevel };
export { agentAsr, byRiskLabel, markerStats };
export { riskRule, riskTypes } from './metrics.js';
