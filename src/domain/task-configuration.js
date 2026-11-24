/* 用户配置与演示证据分别建模。配置来自资产/已发布策略；回放源只在启动时匹配。 */
import { modelEvaluatorConfiguration, modelEvaluatorMatches } from './model-evaluators.js';
const copy = value => JSON.parse(JSON.stringify(value));
const isModelParameter = label => /模型/.test(label);
const roundParameter = label => /最大.*轮数|迭代轮数|最大轮次/.test(label);

export const MODEL_EXECUTION_DEFAULTS = Object.freeze({ concurrency: 3, maxTokens: 2048 });
export function modelExecutionConfiguration(data = {}) {
  const result = {};
  for (const [key, label] of [['concurrency', '并发数'], ['maxTokens', 'Token 限制']]) {
    const value = Number(data[key] ?? MODEL_EXECUTION_DEFAULTS[key]);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label}需为大于 0 的整数`);
    result[key] = value;
  }
  return result;
}

export function buildModelConfiguration(data, catalog, { draft = false } = {}) {
  // Historical task records use tgt-* identifiers; assets use mdl-* identifiers.
  const targetId = String(data.targetId || '').replace(/^tgt-/, 'mdl-');
  const target = catalog.models.find(m => m.id === targetId && (!m.status || m.status === 'connected') && m.testable !== false);
  const strategy = catalog.strategies.find(s => s.id === data.strategyId && s.status === 'published');
  const judge = catalog.models.find(m => m.id === data.judgeId && (!m.status || m.status === 'connected') && m.testable !== false);
  for (const [id, found, message] of [[data.targetId, target, '请选择靶标模型'], [data.strategyId, strategy, '请选择已发布的攻击策略'], [data.judgeId, judge, '请选择裁判模型']]) {
    if ((!draft || id) && !found) throw new Error(message);
  }
  const guardEnabled = data.guardEnabled === true || (data.guardEnabled === undefined && !!data.guardId);
  const guard = guardEnabled ? catalog.guards.find(g => g.id === (data.guardId || 'grd-content-review')) : null;
  if (guardEnabled && !guard) throw new Error('蓝队防护策略不可用');
  const suppliedStages = Array.isArray(data.guardStages) ? data.guardStages : [];
  if (suppliedStages.some(s => !['输入', '输出'].includes(s))) throw new Error('蓝队防护位置无效');
  const guardStages = guardEnabled ? ['输入', '输出'].filter(s => suppliedStages.includes(s)) : [];
  if (!draft && guardEnabled && !guardStages.length) throw new Error('请选择蓝队防护位置');
  const banks = (strategy?.banks || []).map(ref => {
    const bank = catalog.banks.find(b => b.id === ref.bankId);
    if (!bank) throw new Error('攻击策略引用的题库不可用');
    return { bankId: bank.id, name: bank.name, count: ref.count == null ? bank.items.length : Math.min(ref.count, bank.items.length) };
  });
  const methods = (strategy?.methods || []).map((m, index) => {
    const params = copy(m.params || []);
    const auxiliaryModels = params.filter(([label]) => isModelParameter(label)).map(([role, name]) => ({
      role, name, id: catalog.models.find(model => model.name === name)?.id || null,
    }));
    const maxRounds = Number(params.find(([label]) => roundParameter(label))?.[1] ?? m.maxRounds ?? 1);
    return { name: m.name, order: m.order ?? index + 1, params, auxiliaryModels, maxRounds: Number.isInteger(maxRounds) && maxRounds > 0 ? maxRounds : 1 };
  });
  const bankCount = banks.reduce((sum, b) => sum + b.count, 0);
  const attacker = methods.flatMap(m => m.auxiliaryModels)[0];
  return { objectType: 'model', targetId: target?.id || '', targetName: target?.name || '',
    ...(target?.assetId && target.assetSnapshot ? { targetAssetId: target.assetId, targetAssetVersion: target.assetVersion, targetSnapshot: copy(target.assetSnapshot) } : {}),
    strategyId: strategy?.id || '', strategyName: strategy?.name || '', banks,
    bankName: banks.map(b => b.name).join('、'), bankCount, methods, total: bankCount * methods.length,
    guardEnabled, guardId: guard?.id || null, guardName: guard?.name || null, guardStages,
    judgeId: judge?.id || '', judgeName: judge?.name || '', evaluationMetrics: ['asr'],
    ...modelEvaluatorConfiguration(data, { draft }),
    attackerId: attacker?.id || null, attackerName: attacker?.name || null,
    ...modelExecutionConfiguration(data), stopRule: '按攻击方法配置执行' };
}

const sameStages = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
export function replayMatchesConfiguration(config, source) {
  return config.targetName === source.targetName && config.strategyId === source.strategyId
    && modelEvaluatorMatches(config, source)
    && config.judgeId === source.judgeId && (config.guardId || null) === (source.guardId || null)
    && sameStages(config.guardStages, source.guardStages)
    && config.total === source.total
    && JSON.stringify((config.methods || []).map(m => [m.name, m.maxRounds])) === JSON.stringify((source.methods || []).map(m => [m.name, m.maxRounds]));
}

export function resolveModelReplaySource(config, sources) {
  // A different rubric or protection model cannot inherit another run's verdicts.
  const compatible = sources.filter(source => modelEvaluatorMatches(config, source) && (config.guardId || null) === (source.guardId || null));
  const exact = compatible.find(source => replayMatchesConfiguration(config, source));
  if (exact) return exact;
  const score = source => Number(config.strategyId === source.strategyId) * 16
    + Number(Boolean(config.guardId) === Boolean(source.guardId)) * 8
    + Number(config.targetName === source.targetName) * 4
    + Number(config.judgeId === source.judgeId) * 2
    + Number(sameStages(config.guardStages, source.guardStages));
  // In demo mode a compatible recorded run is preferred; its own provenance remains explicit.
  return [...compatible].sort((a, b) => score(b) - score(a) || Number(Boolean(b.guardId)) - Number(Boolean(a.guardId)))[0] || null;
}
