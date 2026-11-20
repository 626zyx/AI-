/* 真实快照回放的纯函数。事件只记录证据位置，不生成攻击内容或判定。
 * 原始单元只有在 unit_complete 后进入结果集；进行中的投影逐字段揭示。
 * 将来服务端可提供同结构事件，详情页不依赖本地定时器。 */
import { roundInfo } from './task-rounds.js';

const copy = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
export const STAGE_LABELS = {
  preparing: '准备环境', ready: '各方就绪', attack: '红队攻击', input_guard: '输入防护', target: '靶标响应',
  output_guard: '输出防护', judge: '裁判评估', round_complete: '轮次结束', unit_complete: '单元结束', complete: '结果汇总',
};

export function buildReplayEvents(source, units) {
  const events = [{ stage: 'preparing', text: '正在准备演练环境' }, { stage: 'ready', text: '演练配置已就绪' }];
  units.forEach((u, unitIndex) => {
    const add = (stage, text, extra = {}) => events.push({ stage, text, unitIndex, ...extra });
    if (source.objectType === 'agent') {
      if (u.attack) add('attack', `载入已记录的攻击面：${(u.attack.surfaces || []).map((s) => s.path).join('、')}`);
      if (u.selfReport) add('target', '靶标最终答复已载入');
      add('judge', '读取本单元的实际裁判结果');
    } else {
      (u.history || []).forEach((h, historyIndex) => {
        const meta = { round: h.round || historyIndex + 1, historyIndex };
        add('attack', `${u.method} · 第 ${meta.round} 轮攻击已生成`, meta);
        if (h.guard?.input) add('input_guard', `输入防护：${h.guard.input.labelCn || h.guard.input.label || '已检测'}${h.guard.action === 'block_input' ? '，已拦截' : ''}`, meta);
        if (h.guard?.action !== 'block_input') add('target', '靶标响应已返回', meta);
        if (h.guard?.output) add('output_guard', `输出防护：${h.guard.output.labelCn || h.guard.output.label || '已检测'}${h.guard.action === 'block_output' ? '，已拦截' : ''}`, meta);
        add('round_complete', `第 ${meta.round} 轮执行结束`, meta);
      });
      add('judge', '读取本单元的实际裁判结果');
    }
    const verdict = source.objectType === 'agent' ? u.verdict : u.judgeSuccess === true ? 'breach' : u.judgeSuccess === false ? 'safe' : 'error';
    add('unit_complete', verdict === 'breach' ? '单元结束：已攻破' : verdict === 'safe' ? '单元结束：未攻破' : '单元结束：判定缺失或执行异常');
  });
  events.push({ stage: 'complete', text: '全部单元结束，结果与报告已汇总' });
  return events;
}

const unitId = (task, unit) => task.sourceTaskId ? `${task.id}--${unit.id}` : unit.id;
const metadata = (task, sourceUnit) => task.objectType === 'agent' ? {
  id: unitId(task, sourceUnit), sourceUnitId: sourceUnit.id, taskId: task.id, sceneTaskId: sourceUnit.sceneTaskId,
  domainOriginal: sourceUnit.domainOriginal, technique: sourceUnit.technique, goal: sourceUnit.goal,
  taskDescription: sourceUnit.taskDescription, taskSteps: copy(sourceUnit.taskSteps || []), taskStepsLabel: sourceUnit.taskStepsLabel,
  taskDefinitionSource: sourceUnit.taskDefinitionSource,
  declaredLabels: copy(sourceUnit.declaredLabels || []), attack: null, verdict: null,
  errors: [], leaks: [], triggeredLabels: [], outputFiles: [],
} : {
  id: unitId(task, sourceUnit), sourceUnitId: sourceUnit.id, taskId: task.id, method: sourceUnit.method,
  methodKey: sourceUnit.methodKey, target: sourceUnit.target, history: [], rounds: 0,
  judgeSuccess: null, judgeScore: null, judgeReason: '', finalPrompt: '', output: '',
};

export function projectReplay(task, source, sourceUnits, events, cursor = task.replayCursor || 0) {
  const visible = events.slice(0, Math.max(0, Math.min(events.length, cursor)));
  const executionUnits = sourceUnits.map((u) => ({ ...metadata(task, u), executionStatus: 'pending', roundInfo: {
    maxRounds: roundInfo(source, u).maxRounds, completedRounds: task.objectType === 'agent' ? null : 0,
    currentRound: null, breachRound: null, firstBreachRound: null, endReason: null,
  } }));
  let activeUnitId = null;
  for (const event of visible) {
    if (event.unitIndex === undefined) continue;
    const original = sourceUnits[event.unitIndex];
    let unit = executionUnits[event.unitIndex];
    activeUnitId = unit.id;
    if (event.stage === 'unit_complete') {
      unit = { ...copy(original), id: unit.id, sourceUnitId: original.id, taskId: task.id,
        executionStatus: 'done', roundInfo: roundInfo(source, original) };
      if (task.objectType === 'agent') delete unit.trace;
      executionUnits[event.unitIndex] = unit;
      continue;
    }
    unit.executionStatus = 'running';
    unit.roundInfo.currentRound = event.round || null;
    if (event.stage === 'judge') unit.judgeContent = original.judgeRationale || original.judgeReason || '';
    if (task.objectType === 'agent') {
      if (event.stage === 'attack') unit.attack = {
        summary: original.attack?.summary,
        surfaces: (original.attack?.surfaces || []).map(({ path, kind, scope, intent }) => ({ path, kind, scope, intent })),
      };
      if (event.stage === 'target') unit.selfReport = original.selfReport || '';
      continue;
    }
    if (event.historyIndex === undefined) continue;
    const raw = original.history[event.historyIndex];
    let h = unit.history.find((entry) => entry.round === event.round);
    if (!h) { h = { round: event.round, prompt: '', response: '', complete: false }; unit.history.push(h); }
    if (event.stage === 'attack') { h.prompt = raw.prompt || ''; unit.finalPrompt = h.prompt; }
    if (event.stage === 'input_guard') h.guard = { input: copy(raw.guard.input), output: null, action: raw.guard.action === 'block_input' ? 'block_input' : 'pass', originalResponse: null };
    if (event.stage === 'target') { h.response = raw.guard?.originalResponse ?? raw.response ?? ''; unit.output = h.response; }
    if (event.stage === 'output_guard') { h.guard = copy(raw.guard); h.response = raw.response || ''; unit.output = h.response; }
    if (event.stage === 'round_complete') {
      Object.assign(h, copy(raw), { complete: true });
      unit.rounds = unit.history.filter((entry) => entry.complete).length;
      unit.roundInfo.completedRounds = unit.rounds;
      unit.roundInfo.currentRound = null;
    }
  }
  if (task.status === 'stopped' || task.status === 'error') {
    for (const unit of executionUnits) if (unit.executionStatus === 'running') {
      unit.executionStatus = 'stopped';
      unit.roundInfo.endReason = task.status === 'error' ? '执行异常' : '主动终止';
    }
  }
  const units = executionUnits.filter((u) => u.executionStatus === 'done');
  const last = visible.at(-1);
  const start = Date.parse(task.startedAt || '') || Date.now();
  const logs = visible.map((e, index) => ({ ...e, id: `${task.id}-ev-${index}`, unitId: e.unitIndex === undefined ? null : executionUnits[e.unitIndex].id,
    time: new Date(start + index * (task.replayIntervalMs || 650)).toLocaleTimeString('zh-CN', { hour12: false }),
    sourceTime: source.startedAt || null, kind: 'line', tag: e.stage, tagLabel: STAGE_LABELS[e.stage] }));
  return { units, executionUnits, logs, replay: { cursor: visible.length, totalEvents: events.length,
    activeUnitId, stage: last?.stage || 'ready', round: last?.round || null, completedUnits: units.length } };
}
