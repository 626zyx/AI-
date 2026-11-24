/* Recorded evaluations are selected, never rerun or attributed to a newly chosen model. */
import { getAgentQuestion } from './agent-environments.js';
import { getAgentAttackTemplate } from './agent-attack-library.js';
import { agentQuestionFingerprint } from './agent-configuration.js';

const stableId = value => String(value || '').split('@')[0];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = value => structuredClone(value);
export const AGENT_REPLAY_CASES = ['task-agt-b5-dc-baseline', 'task-agt-b5-dc-universal'];

export function resolveAgentReplaySource(config, sources) {
  const source = sources.find(item => item.id === `task-agt-b5-dc-${config.technique}` && AGENT_REPLAY_CASES.includes(item.id));
  const mismatch = reason => ({ source: null, reason });
  if (!source) return mismatch('该攻击模板没有对应的历史演示记录');
  if (stableId(config.targetAssetId || config.targetId) !== source.targetId || config.targetImage !== source.targetSnapshot?.image)
    return mismatch('靶标或镜像与两条 Deep Agents 历史案例不同');
  if (stableId(config.targetModelId) !== 'mdl-deepseek-flash' || config.targetModelApi !== source.targetSnapshot?.model)
    return mismatch('靶标基模与历史案例的 deepseek-flash 不同');
  if (config.evaluationMode !== 'llm') return mismatch('Agent 演练仅支持 LLM 评估，请重新保存配置');
  if (config.technique !== 'baseline') {
    if (config.attackTemplateId !== 'universal' || !same(config.attackTemplateSnapshot, getAgentAttackTemplate('universal')))
      return mismatch('攻击模板已变更，没有匹配的历史运行');
    if (stableId(config.attackerId) !== 'mdl-deepseek-flash' || config.attackerModelApi !== 'deepseek-flash')
      return mismatch('攻击模型与历史案例不同');
    const paths = rows => (rows || []).map(row => `${row.vector}:${row.path}`).sort();
    if (!same(paths(config.requestedSurfaces), paths(source.requestedSurfaces))) return mismatch('注入范围与历史案例不同；需选择已归档的记忆与技能两个范围');
  }
  const snapshots = config.questionSnapshots || [];
  if (!snapshots.length || snapshots.length !== config.taskIdSnapshot?.length) return mismatch('环境快照缺失，请重新保存配置');
  for (const snapshot of snapshots) {
    const current = getAgentQuestion(snapshot.id);
    if (!current || current.status !== 'published' || current.source !== 'system' || snapshot.source !== 'system'
      || !source.taskIdSnapshot.includes(snapshot.historicalTaskId) || snapshot.taskId !== snapshot.historicalTaskId
      || snapshot.contentFingerprint !== agentQuestionFingerprint(current)) return mismatch('环境或内容已变更，没有匹配的历史证据');
  }
  const ordered = source.taskIdSnapshot.filter(id => config.taskIdSnapshot.includes(id));
  if (!same(ordered, config.taskIdSnapshot)) return mismatch('环境顺序与归档不同，请按环境库顺序重新选择');
  if (config.maxRounds !== 1 || config.concurrency !== 3 || config.targetTimeout !== null) return mismatch('执行预算与归档演示不同');
  return { source, reason: '', questionIds: ordered };
}

export function agentReplayEvaluationSource(source, mode = 'llm') {
  if (mode !== 'llm' || source.evaluationBasis !== 'semantic-output-review-v1') throw new Error('缺少对应的 LLM 语义复核归档，不能套用其他评估结果');
  return { ...clone(source), evaluationMode: 'llm', evalStrategy: 'llm',
    judgeId: 'judge-codex-semantic-review', judgeName: 'Codex 离线语义复核',
    evaluationBasis: 'semantic-output-review-v1', evaluationProvenance: 'historical-offline-review',
    judgeProvenance: '读取 Codex 对历史产物的离线语义复核；未调用本次选择的在线裁判模型。',
    reportSummary: null,
  };
}

export function projectAgentEvaluationUnits(units, mode = 'llm') {
  if (mode !== 'llm') throw new Error('Agent 演练仅支持 LLM 评估');
  return units.map(original => {
    if (original.evaluationBasis !== 'semantic-output-review-v1') throw new Error(`环境 ${original.sceneTaskId} 缺少 LLM 语义复核归档`);
    return { ...clone(original), evaluationMode: 'llm', evaluationProvenance: 'historical-offline-review' };
  });
}
