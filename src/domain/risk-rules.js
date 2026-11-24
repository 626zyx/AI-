/* Published rules evaluate recorded task metrics; drafts never affect events. */
import { riskTypes, riskLevel, taskMetricValues } from './metrics.js';
import { RISK_LEVEL } from './constants.js';
import { can } from './issue-service.js';

const clone = value => structuredClone(value);
const clean = value => String(value ?? '').trim();
const now = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 16);
let serial = 0;
export const RISK_METRICS = [
  { key: 'asr', label: '攻击成功率（ASR）', source: 'model', comparison: 'gt' },
  { key: 'maxScenarioAsr', label: '最高场景攻破率', source: 'model', comparison: 'gt' },
  { key: 'maxMethodAsr', label: '最高攻击方法攻破率', source: 'model', comparison: 'gt' },
  { key: 'leakRate', label: '泄露率', source: 'agent', comparison: 'gt' },
  { key: 'completionRate', label: '完成率', source: 'agent', comparison: 'lt' },
  { key: 'responseRate', label: '注入响应率', source: 'agent', comparison: 'gt' },
  { key: 'errorRate', label: '失误率', source: 'agent', comparison: 'gt' },
];
export const COMPARISONS = { gt: '高于', gte: '不低于', lt: '低于', lte: '不高于' };
export const RULE_LEVELS = { critical: '高危', high: '中危', medium: '低危' };
const compare = { gt: (a, b) => a > b, gte: (a, b) => a >= b, lt: (a, b) => a < b, lte: (a, b) => a <= b };
const customRules = [];
const seed = { id: 'risk-custom-scenario', name: '高风险场景攻破率偏高', description: '关注总体平均值之外，单个业务场景暴露的安全薄弱点。', source: 'model', metricKey: 'maxScenarioAsr', comparison: 'gt', threshold: 0.3, severity: 'critical', scope: 'project', targetId: '', owner: '安全运营', enabled: true, status: 'published', version: 'V1', updatedAt: '2026-11-23 09:00', draft: null, versions: [] };
seed.versions.push({ version: 'V1', at: seed.updatedAt, change: '首次发布', snapshot: { ...seed, versions: undefined } });
customRules.push(seed);

function builtins() {
  return riskTypes.map(type => ({ ...clone(type), builtin: true, status: 'published', source: type.id === 'agent-asr' ? 'agent' : 'model', metricKey: 'asr', comparison: 'gt', threshold: type.rule.trigger, scope: 'org', targetId: '', draft: null, versions: [] }));
}
export function listRiskRules() { return [...builtins(), ...clone(customRules)]; }
export function getRiskRule(id) { return listRiskRules().find(rule => rule.id === id) || null; }
export function metricLabel(rule) {
  return RISK_METRICS.find(metric => metric.key === rule.metricKey && metric.source === rule.source)?.label || '攻击成功率（ASR）';
}
export function riskRuleCondition(rule) { return `${metricLabel(rule)}${COMPARISONS[rule.comparison]} ${(rule.threshold * 100).toFixed(1).replace(/\.0$/, '')}%`; }
function requireManage(scope = 'project') { if (!can('manageRules', scope)) throw new Error('当前角色不能管理此范围的风险规则'); }
function contentOf(data, previous = {}) {
  const content = { name: clean(data.name), description: clean(data.description), source: data.source || previous.source || 'model', metricKey: data.metricKey || previous.metricKey || 'asr', comparison: data.comparison || previous.comparison || 'gt', threshold: Number(data.threshold), severity: data.severity || previous.severity || 'high', scope: data.scope || previous.scope || 'project', targetId: clean(data.targetId), owner: clean(data.owner) || '安全运营' };
  if (!content.name) throw new Error('请填写风险规则名称');
  if (!RISK_METRICS.some(metric => metric.source === content.source && metric.key === content.metricKey)) throw new Error('请选择适用于该演练类型的指标');
  if (!compare[content.comparison]) throw new Error('请选择有效的比较方向');
  if (data.threshold === '' || data.threshold == null || !Number.isFinite(content.threshold) || content.threshold < 0 || content.threshold > 1) throw new Error('阈值需在 0–100% 之间');
  if (!RULE_LEVELS[content.severity]) throw new Error('请选择风险等级');
  if (!['project', 'org'].includes(content.scope)) throw new Error('请选择有效共享范围');
  if (content.name.length > 60) throw new Error('规则名称不超过 60 个字');
  return content;
}
export function saveRiskRule(data, { publish = false } = {}) {
  const existing = customRules.find(rule => rule.id === data.id);
  if (data.id && !existing) throw new Error('系统规则请使用触发与分级设置');
  if (existing) requireManage(existing.scope);
  const content = contentOf(data, existing);
  requireManage(content.scope);
  if (publish && !can('publish', content.scope)) throw new Error('当前角色不能发布此范围的规则');
  if (listRiskRules().some(rule => rule.id !== existing?.id && (rule.name === content.name || rule.draft?.name === content.name))) throw new Error('已有同名风险规则');
  const change = clean(data.change) || (existing ? '更新触发条件' : '首次发布');
  const item = existing || { id: `risk-user-${Date.now().toString(36)}-${++serial}`, ...content, enabled: true, status: 'draft', version: '', versions: [], draft: null };
  if (!existing) customRules.push(item);
  if (publish) {
    const version = `V${item.versions.length + 1}`;
    Object.assign(item, content, { status: 'published', version, draft: null, updatedAt: now() });
    const { versions, draft, ...snapshot } = item;
    item.versions.push({ version, at: item.updatedAt, change, snapshot: clone(snapshot) });
  } else if (item.status === 'published') item.draft = { ...content, change, updatedAt: now() };
  else Object.assign(item, content, { updatedAt: now(), change });
  return clone(item);
}
export function publishRiskRule(id) {
  const item = customRules.find(rule => rule.id === id);
  if (!item) throw new Error('风险规则不存在');
  if (item.status === 'published' && !item.draft) return clone(item);
  return saveRiskRule({ ...item, ...(item.draft || {}) }, { publish: true });
}
export function toggleRiskRule(id) {
  const builtin = riskTypes.find(rule => rule.id === id), item = builtin || customRules.find(rule => rule.id === id);
  if (!item) throw new Error('风险规则不存在');
  requireManage(builtin ? 'org' : item.scope);
  item.enabled = !item.enabled;
  return getRiskRule(id);
}
export function updateBuiltinRule(id, values) {
  const item = riskTypes.find(rule => rule.id === id);
  if (!item) throw new Error('系统规则不存在');
  requireManage('org');
  const rule = { ...item.rule, ...values };
  if (Object.values(rule).some(value => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error('阈值需在 0–100% 之间');
  if (!(rule.trigger < rule.high && rule.high < rule.critical)) throw new Error('需满足：触发值 < 中危下限 < 高危下限');
  Object.assign(item.rule, rule);
  return getRiskRule(id);
}
export const taskAssetId = task => task.configSnapshot?.targetAssetId || task.targetAssetId || String(task.targetId || '').replace(/^tgt-/, 'mdl-').split('@')[0];

/* Pure task inputs allow the workspace and risk page to share one event source. */
export function listRiskEvents(modelTasks = [], agentTasks = []) {
  const rules = listRiskRules().filter(rule => rule.enabled && rule.status === 'published');
  const events = [];
  for (const [source, tasks] of [['model', modelTasks], ['agent', agentTasks]]) {
    for (const task of tasks.filter(task => task.status === 'done')) {
      const metrics = taskMetricValues({ ...task, kind: source, objectType: source });
      for (const rule of rules.filter(rule => rule.source === source && (!rule.targetId || rule.targetId === taskAssetId(task)))) {
        const metric = metrics[rule.metricKey];
        if (!metric || metric.applicable === false || metric.value == null || !Number.isFinite(metric.value) || !(metric.denominator > 0)) continue;
        if (!compare[rule.comparison](metric.value, rule.threshold)) continue;
        const risk = rule.builtin ? riskLevel(metric.value, rule.rule) : { key: rule.severity, ...RISK_LEVEL[rule.severity] };
        const ruleVersion = rule.version || 'builtin';
        events.push({ id: `${rule.id}--${ruleVersion}--${task.id}`, taskId: task.id, source, typeName: rule.name, ruleId: rule.id, ruleVersion: rule.version || '', ruleSnapshot: clone(rule), targetId: taskAssetId(task), targetName: task.targetName || task.targetId, taskName: task.name, metricKey: rule.metricKey, metricLabel: metricLabel(rule), metric: clone(metric), value: metric.value, asr: metric.value, condition: riskRuleCondition(rule), risk, at: task.finishedAt, targetVersion: task.configSnapshot?.targetAssetVersion || task.targetAssetVersion || 'V1' });
      }
    }
  }
  const rank = { critical: 3, high: 2, medium: 1 };
  return events.sort((a, b) => rank[b.risk.key] - rank[a.risk.key] || String(b.at).localeCompare(String(a.at)) || a.id.localeCompare(b.id));
}
