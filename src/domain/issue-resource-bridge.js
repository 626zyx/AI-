/* Production feedback becomes a reviewed draft; published resources and previous runs stay immutable. */
import * as A from './resource-authoring.js';
import * as store from './store.js';
import * as issues from './issue-service.js';

export const getResource = A.getAuthoredResource;
export function addFeedbackCase(feedback) {
  if (!issues.can('edit')) throw new Error('当前角色不能编辑回归题库');
  const old = A.listAuthoredResources().find(r => r.sourceFeedbackId === feedback.id);
  if (old) return { bankId: old.id, caseId: old.items?.[0]?.id || `${old.id}-task` };
  if (!feedback.input?.trim() || !feedback.expected?.trim()) throw new Error('请补齐复现输入与通过条件');
  const settings = { kind: feedback.assetKind, name: `回流 · ${feedback.title}`, business: feedback.business || '生产回归', goal: feedback.purpose || feedback.input,
    rule: feedback.rule || feedback.expected, template: A.AGENT_GENERATION_TEMPLATE, count: 1, modelId: '', sourceFeedbackId: feedback.id };
  const caseId = `feedback-${feedback.id}`;
  if (settings.kind === 'model') settings.items = [{ id: caseId, prompt: feedback.input, scene: settings.business, expected: feedback.expected, group: feedback.group || 'attack', method: 'Direct', sourceRecord: { feedbackId: feedback.id, productionVersion: feedback.productionVersion } }];
  else {
    settings.files = A.generateAgentBundle(settings);
    settings.files['task.md'] = `# ${feedback.title}\n\n${feedback.input}\n\n请完成业务任务并生成所需交付物。\n`;
    settings.files['checkpoints.md'] = `# 生产回归通过条件\n\n${feedback.expected}\n\n业务边界：${settings.rule}\n\n请根据实际交付物调整评估器和工具配置，再发布场景包。\n`;
    settings.files['feedback.source.json'] = JSON.stringify({ feedbackId: feedback.id, assetId: feedback.assetId, productionVersion: feedback.productionVersion, group: feedback.group, expected: feedback.expected }, null, 2);
  }
  const saved = A.saveAuthoredDraft(settings);
  return { bankId: saved.id, caseId };
}
export function regressionStrategies(bankId, kind) {
  const resource = getResource(bankId), published = resource?.versions.at(-1);
  if (!published) return [];
  return (kind === 'agent' ? store.agentStrategies : store.strategies).filter(s => s.status === 'published' && s.banks?.some(b => b.bankId === published.catalogId));
}
export function createRegressionStrategy(feedback) {
  if (!issues.can('edit')) throw new Error('当前角色不能编辑回归策略');
  const resource = getResource(feedback.bankId), version = resource?.versions.at(-1);
  if (!version) throw new Error('请先审阅并发布回归题库');
  const values = { name: `回归 · ${feedback.title} · ${Date.now().toString(36).slice(-4)}`, desc: `生产反馈 ${feedback.id}；固定题库 v${version.version}`, banks: [{ bankId: version.catalogId, count: null }], status: 'draft' };
  return feedback.assetKind === 'agent' ? store.saveAgentStrategy({ ...values, methodId: 'baseline', attackerModelId: null })
    : store.saveStrategy({ ...values, methods: [{ name: 'Direct', params: [], aux: {} }] });
}
export const taskOf = (id, kind) => kind === 'agent' ? store.getAgentTask(id) : store.getTask(id);
export const assetIdOfTask = task => task.configSnapshot?.targetAssetId || task.targetAssetId || String(task.targetId || '').replace(/^tgt-/, 'mdl-').split('@')[0];
export const versionOfTask = task => task.configSnapshot?.targetAssetVersion || task.targetAssetVersion || String(task.targetId || '').split('@')[1] || 'V1';
export function completedTasks(assetId, kind, version) {
  return (kind === 'agent' ? store.listAgentTasks() : store.listTasks()).filter(t => t.status === 'done' && assetIdOfTask(t) === assetId && (!version || versionOfTask(t).toLowerCase() === version.toLowerCase()));
}
export function recordReviewedRetest(id, taskId, review) {
  const finding = issues.getFinding(id), task = finding && taskOf(taskId, finding.assetKind);
  if (!finding || !task || !completedTasks(finding.assetId, finding.assetKind, finding.fixVersion).some(t => t.id === taskId)) throw new Error('请选择同一资产修复版本的已完成演练任务');
  return issues.recordRetest(id, { taskId, targetVersion: finding.fixVersion, targetAssetId: finding.assetId, taskCompleted: true, ...review });
}
export function recordFeedbackTask(id, taskId) {
  const feedback = issues.getFeedback(id), task = feedback && taskOf(taskId, feedback.assetKind);
  const bank = getResource(feedback?.bankId), catalogIds = bank?.versions.map(v => v.catalogId) || [];
  if (!task || task.status !== 'done' || assetIdOfTask(task) !== feedback.assetId) throw new Error('请选择同一资产的已完成任务');
  if (!task.configSnapshot?.banks?.some(b => catalogIds.includes(b.bankId))) throw new Error('任务未引用该反馈的已发布回归题库');
  return issues.recordFeedbackValidation(id, taskId);
}
