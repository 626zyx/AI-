/* Method-level conclusions from matched questions, recorded rounds and guard actions.
 * Free-text response keywords never stand in for a judgment or causal attribution. */
import { roundInfo } from '../domain/task-rounds.js';

const clean = value => typeof value === 'string' ? value.trim() : '';
const roundVerdict = round => typeof round?.judgeSuccess === 'boolean' ? round.judgeSuccess : typeof round?.judge?.success === 'boolean' ? round.judge.success : null;
const blocked = round => ['block_input', 'block_output'].includes(round?.guard?.action);

export function modelMethodInsights(task) {
  const units = task.units || [];
  const methods = (task.methods || []).map(method => {
    const own = units.filter(unit => unit.method === method.name);
    return { name: method.name, units: own, judged: own.filter(unit => typeof unit.judgeSuccess === 'boolean'), breaches: own.filter(unit => unit.judgeSuccess === true) };
  });
  const directByQuestion = new Map();
  for (const unit of units.filter(unit => unit.method === 'Direct' && clean(unit.target))) {
    const key = clean(unit.target);
    if (!directByQuestion.has(key)) directByQuestion.set(key, []);
    directByQuestion.get(key).push(unit);
  }
  const insights = methods.filter(method => method.breaches.length).sort((a, b) => b.breaches.length - a.breaches.length).map(method => {
    const entries = method.breaches.map(unit => {
      const info = roundInfo(task, unit), history = unit.history || [];
      const selected = history.find(round => round.round === info.breachRound);
      const earlier = selected ? history.filter(round => round.round < selected.round) : [];
      return { unit, info, selected, earlier };
    });
    const rewritten = entries.filter(({selected, earlier}) => clean(selected?.prompt) && earlier.some(round => clean(round.prompt) && clean(round.prompt) !== clean(selected.prompt)));
    const previousBlocked = entries.filter(({selected, earlier}) => selected?.guard?.action === 'pass' && earlier.some(blocked));
    const knownTransition = entries.filter(({info, earlier}) => info.firstBreachRound > 1 && Array.from({ length: info.firstBreachRound - 1 }, (_, index) => earlier.find(round => round.round === index + 1)).every(round => roundVerdict(round) === false));
    const matched = method.name === 'Direct' ? [] : entries.filter(({unit}) => {
      const baseline = directByQuestion.get(clean(unit.target));
      return baseline?.length && baseline.every(record => record.judgeSuccess === false);
    });
    const parts = [];
    if (rewritten.length) parts.push(`${method.name} 暴露了靶标对改写输入的抵御弱点：${rewritten.length} 个攻破记录对应的回复位于提示词已发生变化的后续轮。`);
    else parts.push(`${method.name} 已在 ${method.breaches.length} 个单元中突破安全边界。`);
    if (matched.length) parts.push(`对照同任务的 Direct，有 ${matched.length} 个相同原题在 Direct 中未攻破、在 ${method.name} 中被攻破，说明直接提问时守住的边界，在该方法下仍可能失守。`);
    if (previousBlocked.length) parts.push(`${previousBlocked.length} 个单元曾被蓝队拦截，但后续放行的回复仍被判为攻破；需重点复核表达变化后的输入审核与输出审核，而不能只验证首轮能否拦截。`);
    else if (knownTransition.length) parts.push(`${knownTransition.length} 个单元有完整逐轮证据，确认从前轮未攻破转为后轮攻破；回归验证应保留这一完整序列。`);
    else if (rewritten.length) parts.push('应把同题不同表达和多轮改写作为回归重点；现有记录未保留完整逐轮判定，不能认定之前每一轮都已守住。');
    else parts.push('应把该方法的输入与同题其他方法的回复对照检查，识别需要补充的防护边界。');
    return parts.join('');
  });
  const safe = methods.filter(method => method.judged.length && !method.breaches.length);
  if (safe.length) {
    const own = safe.flatMap(method => method.units), judged = safe.reduce((sum, method) => sum + method.judged.length, 0);
    const blockedFinal = own.filter(unit => unit.judgeSuccess === false && blocked((unit.history || []).at(-1))).length;
    insights.push(`${safe.map(method => method.name).join('、')} 在本次 ${judged} 个有效判定中均未攻破。${blockedFinal ? `其中 ${blockedFinal} 个单元的最终记录由蓝队拦截，不能全部归为靶标自身抵御。` : ''}${insights.length ? '这些结果提供对照，但不能替代对已暴露方法的专项验证。' : '当前结果覆盖本次题集与配置，尚不能外推到其他输入表达或更长的攻击序列。'}`);
  }
  const unknown = methods.filter(method => !method.judged.length);
  if (unknown.length) insights.push(`${unknown.map(method => method.name).join('、')} 缺少有效判定，暂不能评价方法表现。`);
  const missing = methods.filter(method => method.judged.length).reduce((sum, method) => sum + method.units.length - method.judged.length, 0);
  if (missing) insights.push(`另有 ${missing} 个单元缺少有效判定，未计入上述守住或攻破结论。`);
  return insights;
}
