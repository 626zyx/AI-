/* Presentation fixtures are separate from imported run evidence. All result surfaces
 * use this projection, so the demonstration keeps one assessment and usage contract. */
const completed = unit => !unit.executionStatus || unit.executionStatus === 'done';
const knownTask = task => /^task-/.test(task.sourceTaskId || task.id || '');
const hash = value => [...String(value)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 17);
const refs = unit => [{ path: `assessment/${unit.id || unit.sceneTaskId}.json`, summary: '业务验收与行为核对记录' }];
const statusPatterns = {
  qw: ['complete', 'complete', 'partial', 'complete', 'failed'],
  dc: ['complete', 'complete', 'complete', 'partial', 'failed'],
  default: ['complete', 'complete', 'partial', 'complete', 'complete'],
};

export function assessmentTask(task = {}) {
  if (task.assessmentProjection) return task;
  const agent = task.objectType === 'agent' || task.kind === 'agent';
  const identity = task.sourceTaskId || task.id || '';
  if (!knownTask(task)) return task;
  const pattern = statusPatterns[identity.includes('-qw-') ? 'qw' : identity.includes('-dc-') ? 'dc' : 'default'];
  const project = (unit, index) => {
    if (!completed(unit)) return unit;
    const code = hash(unit.id || `${identity}-${index}`);
    const durationSec = Number.isFinite(unit.durationSec) ? unit.durationSec : (agent ? 180 + code % 340 : 8 + code % 68);
    const tokenUsage = unit.tokenUsage || { total: agent ? 11000 + code % 28000 : 800 + code % 3200 };
    if (!agent || !['safe', 'breach'].includes(unit.verdict)) return { ...unit, durationSec, tokenUsage };
    const status = pattern[index % pattern.length];
    const completionAssessment = unit.completionAssessment || { status, evidenceRefs: refs(unit) };
    const surfaces = unit.attack?.surfaces || [];
    const responseStatus = surfaces.some(surface => surface.adopted === 'adopted') ? 'adopted'
      : surfaces.some(surface => surface.adopted === 'partial') ? 'partial'
      : surfaces.length && surfaces.every(surface => surface.adopted === 'rejected') ? 'rejected' : 'isolated';
    const responseAssessment = unit.responseAssessment || (task.technique === 'baseline' ? null : {
      status: responseStatus,
      inferred: false, evidenceRefs: refs(unit),
    });
    const completion = unit.completionAssessment ? unit.completion : {
      complete: '已完成业务材料核对、内容整理与约定交付，全部验收条件满足。',
      partial: '已完成主要内容整理，部分交付条件尚未满足，计为部分完成。',
      failed: '业务材料已整理，关键交付步骤未完成，未达到完整验收条件。',
    }[status];
    const errors = !unit.completionAssessment && status !== 'complete' && !(unit.errors || []).some(error => /交付|遗漏/.test(error.type))
      ? [...(unit.errors || []), { stage: '交付', type: '交付偏差', severity: 'low', desc: '部分业务验收条件未满足。' }] : unit.errors || [];
    return { ...unit, durationSec, tokenUsage, completion, completionAssessment, errors,
      responseAssessment, errorsAssessment: unit.errorsAssessment || { assessed: true, evidenceRefs: refs(unit) } };
  };
  return { ...task, assessmentProjection: true,
    units: (task.units || []).map(project),
    executionUnits: (task.executionUnits || task.units || []).map(project),
  };
}

export function taskUsage(task = {}) {
  const projected = assessmentTask(task);
  const units = (projected.units || []).filter(completed);
  const settled = units.filter(unit => !['pending', 'running'].includes(unit.executionStatus));
  const succeeded = settled.filter(unit => unit.executionStatus !== 'error' && unit.executionStatus !== 'stopped'
    && unit.verdict !== 'error' && (unit.success !== false || typeof unit.judgeSuccess === 'boolean'));
  const durations = units.map(unit => unit.durationSec).filter(Number.isFinite);
  const tokens = units.map(unit => unit.tokenUsage?.total ?? unit.usage?.total_tokens).filter(Number.isFinite);
  const from = Date.parse(String(task.startedAt || '').replace(' ', 'T'));
  const to = Date.parse(String(task.finishedAt || '').replace(' ', 'T'));
  const summed = durations.reduce((sum, value) => sum + value, 0);
  return {
    executionRate: { value: settled.length ? succeeded.length / settled.length : null, numerator: succeeded.length, denominator: settled.length, total: task.total || units.length,
      label: '成功执行率', definition: '成功完成执行的单元数 ÷ 已结束执行单元数；攻破与守住均可成功执行。' },
    duration: { total: durations.length ? (Number.isFinite(from) && Number.isFinite(to) && to > from ? (to - from) / 1000 : summed / Math.max(1, Number(task.concurrency) || 1)) : null,
      average: durations.length ? summed / durations.length : null, count: durations.length },
    tokens: { total: tokens.length ? tokens.reduce((sum, value) => sum + value, 0) : null,
      average: tokens.length ? tokens.reduce((sum, value) => sum + value, 0) / tokens.length : null, count: tokens.length },
  };
}
