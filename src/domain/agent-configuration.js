/* Agent tasks select assets, an optional attacker template, questions and one evaluator. */
import { selectedAgentSurfaces } from './agent-surfaces.js';
import { getAgentQuestions } from './agent-environments.js';
import { getAgentAttackTemplate } from './agent-attack-library.js';
import { sandboxTargetValidationPassed, sandboxTargetSurfaces } from './sandbox-validation.js';
import { resolveApplicationTarget } from './application-target.js';

const copy = value => value == null ? null : structuredClone(value);
export const modelApiIdentity = model => model?.apiModel || model?.model || model?.modelName || '';
export const usableTaskModel = model => !!model && (!model.status || model.status === 'connected') && model.testable !== false
  && !(/embedding/i.test(model.apiType || '') || (model.capabilities?.length && model.capabilities.every(value => /embedding/i.test(value))));
export function agentQuestionFingerprint(question) {
  const content = JSON.stringify([question.id, question.version, Object.entries(question.files || {}).sort(([a], [b]) => a.localeCompare(b))]);
  let hash = 2166136261;
  for (let i = 0; i < content.length; i += 1) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildAgentConfiguration(data, catalog, { draft = false } = {}) {
  const application = data.targetApplicationSnapshot ? (Object.hasOwn(catalog, 'applicationAssets')
    ? resolveApplicationTarget(data.targetApplicationSnapshot, catalog.agents, catalog.applicationAssets?.find(row => row.id === data.targetApplicationSnapshot.id) || null)
    : resolveApplicationTarget(data.targetApplicationSnapshot, catalog.agents)) : null;
  const target = application?.target || catalog.agents.find(agent => agent.id === data.targetId && agent.status !== 'disabled' && agent.sourceStatus !== '已停用' && agent.testable !== false);
  const sandboxValidationRequired = data.sandboxValidationRequired === true || !!application;
  if (!application && (!draft || data.targetId) && !target) throw new Error('请选择已接入的靶标智能体');
  if (!draft && application) {
    if (application.issues.length) throw new Error(application.issues.join('；'));
    if (application.missingFields.length) throw new Error(`靶标运行配置缺少${application.missingFields.join('、')}`);
    if (data.targetId && data.targetId !== application.executableId) throw new Error('应用对应的运行配置已变更，请重新选择并验证');
    if (target.status === 'disabled' || target.sourceStatus === '已停用' || target.testable === false) throw new Error('靶标运行配置已停用或不可用于演练');
  }
  if (!draft && !sandboxValidationRequired && target?.status !== 'connected') throw new Error('请先验证靶标运行配置');
  const legacyStrategy = catalog.agentStrategies?.find(strategy => strategy.id === data.strategyId);
  const exerciseMode = data.exerciseMode || (data.technique && data.technique !== 'baseline' ? 'attack' : legacyStrategy?.methodId === 'universal' ? 'attack' : 'baseline');
  if (!['baseline', 'attack'].includes(exerciseMode)) throw new Error('请选择基础安全演练或加入攻击');
  const attackTemplateId = exerciseMode === 'attack' ? (Object.hasOwn(data,'attackTemplateId') ? String(data.attackTemplateId || '').trim() || null : data.technique || legacyStrategy?.methodId || 'universal') : null;
  const template = attackTemplateId ? getAgentAttackTemplate(attackTemplateId) : null;
  if ((attackTemplateId || exerciseMode === 'attack' && !draft) && (!template || template.status !== 'published')) throw new Error('请选择已发布的攻击者');
  const targetModelId = data.targetModelId ?? (target?.baseModelVersion ? `${target.baseModelId}@${target.baseModelVersion}` : target?.baseModelId) ?? '';
  const baseModel = catalog.models.find(model => model.id === targetModelId);
  if ((!draft || targetModelId) && !usableTaskModel(baseModel)) {
    if (baseModel?.status && baseModel.status !== 'connected' && baseModel.status !== 'disabled') throw new Error('靶标基模尚未连通，请先检查连接');
    throw new Error('请选择可用的靶标基模');
  }
  const sandboxValid = sandboxTargetValidationPassed(data.sandboxValidation, { target, model: baseModel });
  if (!draft && sandboxValidationRequired && !sandboxValid) throw new Error('请先完成当前靶标与基模配置的沙箱演示验证');
  const attackerId = exerciseMode === 'attack' ? (data.attackerId ?? legacyStrategy?.attackerModelId ?? '') : null;
  const attacker = catalog.models.find(model => model.id === attackerId);
  if (exerciseMode === 'attack' && (!draft || attackerId) && !usableTaskModel(attacker)) throw new Error('请选择可用的攻击模型');
  if (data.evaluationMode && data.evaluationMode !== 'llm') throw new Error('Agent 演练仅支持 LLM 评估');
  const evaluationMode = 'llm';
  const judge = catalog.models.find(model => model.id === data.judgeId);
  if ((!draft || data.judgeId) && !usableTaskModel(judge)) throw new Error('请选择可用的裁判模型');
  const questions = catalog.questions || getAgentQuestions();
  const legacyIds = legacyStrategy?.banks?.flatMap(ref => catalog.sceneBanks?.find(bank => bank.id === ref.bankId)?.items.slice(0, ref.count).map(item => item.taskId) || []) || [];
  const questionIds = [...new Set(data.questionIds ?? data.taskIdSnapshot ?? legacyIds)];
  const selected = questionIds.map(id => questions.find(question => question.id === id || question.taskId === id));
  if (selected.some(question => !question || question.status !== 'published')) throw new Error('所选环境未发布、已删除或不可用，请重新选择');
  if (!draft && !selected.length) throw new Error('请至少选择一个已发布的环境');
  if (selected.some(question => !question.hasLlm)) throw new Error('所选环境缺少 LLM 评估定义');
  const surfaceTarget = sandboxValid ? { ...target, intakeMode: 'configuration', surfaces: sandboxTargetSurfaces(target).map(surface => ({ ...surface, configurationOnly: true })) } : target;
  const requestedSurfaces = exerciseMode === 'attack' && !(draft && application && !application.matched) ? selectedAgentSurfaces(surfaceTarget, data.injectionSurfaceIds || []) : [];
  if (!draft && exerciseMode === 'attack' && !requestedSurfaces.length) throw new Error('请至少选择一个可用的注入面');
  if (template && requestedSurfaces.some(surface => !template.surfaceKinds?.includes(surface.kind))) throw new Error('所选注入面不受攻击者支持');
  const banks = [...new Set(selected.map(question => question.bankId))].map(bankId => {
    const rows = selected.filter(question => question.bankId === bankId);
    return { bankId, name: rows[0].business, count: rows.length, taskIds: rows.map(question => question.taskId) };
  });
  const questionSnapshots = selected.map(question => ({ id: question.id, taskId: question.taskId, title: question.title,
    version: question.version, source: question.source, contentMode: question.contentMode || 'authored',
    historicalTaskId: question.source === 'system' ? question.historicalTaskId || question.taskId : null,
    contentFingerprint: agentQuestionFingerprint(question), llmDefinition: copy(question.llmDefinition) }));
  return {
    objectType: 'agent', targetId: application ? application.executableId : target?.id || '', targetName: application?.applicationSnapshot.name || target?.name || '',
    ...(application ? { targetApplicationSnapshot: copy(application.applicationSnapshot) } : {}),
    sandboxValidationRequired, sandboxValidation: copy(data.sandboxValidation),
    ...(target?.assetId && target.assetSnapshot ? { targetAssetId: target.assetId, targetAssetVersion: target.assetVersion, targetSnapshot: copy(target.assetSnapshot) } : {}),
    targetImage: target?.image || '', targetModelId: baseModel?.id || '', targetModelName: baseModel?.name || '', targetModelApi: modelApiIdentity(baseModel),
    ...(baseModel?.assetSnapshot ? { targetModelSnapshot: copy(baseModel.assetSnapshot) } : {}),
    exerciseMode, attackTemplateId, attackTemplateName: template?.name || null, attackTemplateSnapshot: template ? copy(template) : null,
    strategyId: '', strategyName: exerciseMode === 'baseline' ? '基础安全演练' : template?.name || '',
    technique: exerciseMode === 'baseline' ? 'baseline' : template?.id || '', techniqueName: exerciseMode === 'baseline' ? '基础安全演练' : template?.name || '',
    attackerId: attacker?.id || null, attackerName: attacker?.name || null, attackerModelApi: modelApiIdentity(attacker) || null,
    questionIds: selected.map(question => question.id), questionSnapshots, taskIdSnapshot: selected.map(question => question.taskId), total: selected.length,
    banks, sceneBankId: banks.map(bank => bank.bankId).join(','), sceneBankName: [...new Set(banks.map(bank => bank.name))].join('、'),
    injectionSurfaceIds: requestedSurfaces.map(surface => surface.id), requestedSurfaces,
    evaluationMode, evalStrategy: 'llm',
    judgeId: judge?.id || '', judgeName: judge?.name || '', evaluationMetrics: ['asr'],
    evaluationProvenance: 'planned', executionIntent: 'historical-demo',
    guardEnabled: false, guardId: null, guardName: null, guardStages: [], concurrency: 3, targetTimeout: null, maxRounds: 1,
    executionBudgetNote: '演示采用原归档逐题预算；只回放最终保留尝试，不发起在线调用。',
  };
}
