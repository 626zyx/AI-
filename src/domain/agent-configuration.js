/* Agent task configuration is selected from assets and published strategies, independently of replay evidence. */
import { selectedAgentSurfaces } from './agent-surfaces.js';

export function buildAgentConfiguration(data, catalog, { draft = false } = {}) {
  const target = catalog.agents.find(agent => agent.id === data.targetId && agent.status === 'connected');
  const strategy = catalog.agentStrategies.find(item => item.id === data.strategyId && item.status === 'published');
  const judge = catalog.models.find(model => model.id === data.judgeId && model.roles.includes('裁判'));
  for (const [id, found, message] of [[data.targetId, target, '请选择已接入的靶标智能体'], [data.strategyId, strategy, '请选择已发布的演练策略'], [data.judgeId, judge, '请选择裁判模型']]) {
    if ((!draft || id) && !found) throw new Error(message);
  }
  const method = strategy && catalog.agentMethods.find(item => item.id === strategy.methodId);
  if (strategy && !method) throw new Error('演练策略的攻击方法不可用');
  const attacker = method?.requiresRole && catalog.models.find(model => model.id === strategy.attackerModelId && model.roles.includes(method.requiresRole));
  if (method?.requiresRole && !attacker) throw new Error('演练策略的攻击生成模型不可用');
  const banks = (strategy?.banks || []).map(ref => {
    const bank = catalog.sceneBanks.find(item => item.id === ref.bankId);
    if (!bank || bank.archived) throw new Error('演练策略引用的场景题库不可用');
    const count = ref.count == null ? bank.items.length : Math.min(ref.count, bank.items.length);
    return { bankId: bank.id, name: bank.name, version: bank.version || 'V1', count, taskIds: bank.items.slice(0, count).map(item => item.taskId) };
  });
  const taskIdSnapshot = [...new Set(banks.flatMap(bank => bank.taskIds))];
  if (!draft && !taskIdSnapshot.length) throw new Error('演练策略没有可用的场景题目');
  const requested = selectedAgentSurfaces(target, data.injectionSurfaceIds || []);
  const executionMethod = method?.baseMethod || method?.id;
  const requestedSurfaces = executionMethod === 'baseline' ? [] : requested;
  if (!draft && executionMethod === 'universal' && !requestedSurfaces.length) throw new Error('请至少选择一个注入面文件');
  return {
    objectType: 'agent', targetId: target?.id || '', targetName: target?.name || '',
    ...(target?.assetId && target.assetSnapshot ? { targetAssetId: target.assetId, targetAssetVersion: target.assetVersion, targetSnapshot: JSON.parse(JSON.stringify(target.assetSnapshot)) } : {}),
    strategyId: strategy?.id || '', strategyName: strategy?.name || '', strategyVersion: strategy?.version || '1.0',
    technique: method?.id || '', techniqueName: method?.name || '',
    ...(method?.authoringId ? { methodSnapshot: JSON.parse(JSON.stringify(method)), methodTemplate: method.template, executionMethod } : {}),
    attackerId: attacker?.id || null, attackerName: attacker?.name || null,
    banks, sceneBankId: banks.map(bank => bank.bankId).join(','), sceneBankName: banks.map(bank => bank.name).join('、'),
    taskIdSnapshot, total: taskIdSnapshot.length,
    injectionSurfaceIds: requestedSurfaces.map(surface => surface.id), requestedSurfaces,
    judgeId: judge?.id || '', judgeName: judge?.name || '', evaluationMetrics: ['asr'],
    ...(judge?.reviewOnly ? { judgeProvenance: 'Codex 对已保存的来源与产物做语义复核；本 demo 回放已导入判定，不调用在线裁判。', evaluationBasis: 'semantic-output-review-v1' } : {}),
    guardEnabled: false, guardId: null, guardName: null, guardStages: [],
    concurrency: 4, targetTimeout: 900,
  };
}
