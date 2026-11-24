/* Read only the visible unit projection. The canvas never reaches into replay sources. */
import { agentAssessmentText, injectionDeliveryText } from './agent-evidence.js';

const output = (label, text, role = 'neutral') => ({ label, text: text || '—', role });
const guardText = check => check ? [check.labelCn || check.label, ...(check.categories || [])].filter(Boolean).join(' · ') : '';
const judgment = unit => unit.judgeContent || unit.judgeRationale || unit.judgeReason || '';

export function currentTaskContent(task, unit, { selected = false } = {}) {
  if (['draft', 'ready'].includes(task.status)) return output('待开始', '—');
  if (!unit || unit.executionStatus === 'pending') return output('待执行', '—');
  const live = !selected && task.status === 'running';
  const phase = live ? task.replay?.stage : null;
  const history = unit.history || [];
  const round = history.find(h => h.round === task.replay?.round) || history.at(-1);
  const input = () => output('输入审核', guardText(round?.guard?.input), 'guard');
  const response = () => output('靶标响应', round?.guard?.originalResponse || round?.response || unit.output, 'target');
  const review = () => output('输出审核', guardText(round?.guard?.output), 'guard');
  const judge = () => {
    const text = judgment(unit) || round?.judgeReason || round?.judge?.reason;
    return output(task.objectType === 'agent' ? 'LLM 评估' : '裁判判定', task.objectType === 'agent' ? agentAssessmentText(text) : text, 'judge');
  };

  if (task.objectType === 'agent') {
    const target = () => {
      if (unit.selfReport) return output('靶标最终答复', unit.selfReport, 'target');
      const files = unit.originalOutputFiles?.length ? unit.originalOutputFiles : unit.outputFiles || [];
      return output('靶标产物', files.map(file => `${file.path || file.name}${file.size == null ? '' : ` · ${file.size} B`}`).join('\n') || '尚无已记录的靶标产物。', 'target');
    };
    if (phase === 'attack') return output('攻击生成', agentAssessmentText(unit.attack?.summary), 'attack');
    if (phase === 'attack_delivery') return output('攻击文件交付', injectionDeliveryText(unit), 'attack');
    if (phase === 'target') return target();
    if (phase === 'judge' || phase === 'unit_complete' || (!live && judgment(unit))) return judge();
    if (unit.selfReport || unit.originalOutputFiles?.length || unit.outputFiles?.length) return target();
    if (unit.attack?.deliveryStatus) return output('攻击文件交付', injectionDeliveryText(unit), 'attack');
    if (unit.attack) return output('攻击生成', agentAssessmentText(unit.attack.summary), 'attack');
    return output('准备环境', '—');
  }
  if (phase === 'attack') return output('攻击生成', round?.prompt || unit.finalPrompt, 'attack');
  if (phase === 'input_guard') return input();
  if (phase === 'target') return response();
  if (phase === 'output_guard') return review();
  if (phase === 'judge' || phase === 'unit_complete' || (!live && judgment(unit))) return judge();
  // Between steps, keep the latest available module output; no future data is read.
  if (round?.judgeReason || round?.judge?.reason) return judge();
  if (round?.guard?.output) return review();
  if (round?.response || round?.guard?.originalResponse) return response();
  if (round?.guard?.input) return input();
  if (round?.prompt) return output('攻击生成', round.prompt, 'attack');
  return output('准备演练', '—');
}
