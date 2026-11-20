/* 轮数口径：已执行轮次、配置上限、判定攻破轮次彼此独立。
 * 历史累计率仍需要较早各轮的证据；不把最终判定向前补齐。
 * Agent 工具 trace 不代表攻击轮数。 */
const positive = (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const knownVerdict = (u) => typeof u.judgeSuccess === 'boolean' ? u.judgeSuccess : u.verdict === 'breach' ? true : u.verdict === 'safe' ? false : null;
const roundVerdict = (h) => typeof h?.judgeSuccess === 'boolean' ? h.judgeSuccess : typeof h?.judge?.success === 'boolean' ? h.judge.success : null;

export function roundInfo(task, unit) {
  if (unit.roundInfo) return { ...unit.roundInfo };
  const agent = task.objectType === 'agent';
  const method = (task.methods || []).find((m) => m.name === unit.method);
  const maxRounds = positive(unit.maxRounds ?? method?.maxRounds ?? task.maxRounds);
  const history = unit.history || [];
  const completedRounds = positive(unit.completedRounds ?? unit.rounds) ?? (agent ? null : history.length || null);
  let firstBreachRound = positive(unit.firstBreachRound);
  if (!firstBreachRound) {
    const evidence = history.filter((h) => h.judgeSuccess === true || h.judge?.success === true);
    if (evidence.length) {
      const first = Math.min(...evidence.map((h) => positive(h.round)).filter(Boolean));
      // A positive judgment is only the *first* if every earlier round is known.
      if (Number.isFinite(first)) {
        const earlier = Array.from({ length: Math.max(0, first - 1) }, (_, i) => history.find((h) => positive(h.round) === i + 1));
        if (earlier.every((h) => h && (h.judgeSuccess === false || h.judge?.success === false))) firstBreachRound = first;
      }
    }
    // A single completed and judged round cannot hide an earlier successful round.
    else if (!agent && knownVerdict(unit) === true && completedRounds === 1 && history.length === 1 && positive(history[0].round) === 1) firstBreachRound = 1;
  }
  const result = knownVerdict(unit);
  const judgedRound = positive(unit.judgedRound);
  const roundWithSuccess = history.find(h => roundVerdict(h) === true);
  const breachRound = result === false ? null : positive(unit.breachRound)
    || (result === true && judgedRound && history.some(h => positive(h.round) === judgedRound) ? judgedRound : null)
    || positive(roundWithSuccess?.round) || firstBreachRound || null;
  const endReason = unit.endReason || (result === null ? '判定缺失或执行异常' : firstBreachRound && maxRounds && completedRounds < maxRounds ? '攻破后结束' : maxRounds && completedRounds >= maxRounds ? '达到轮数上限' : '源记录已结束');
  return { maxRounds, completedRounds, currentRound: null, breachRound, firstBreachRound: firstBreachRound || null, endReason };
}

const median = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* Whether a unit had already been breached by N is a separate claim from its
 * final selected-response verdict. Missing earlier judgments stay unknown.
 * Never shrink the denominator to only the units whose outcomes are convenient
 * to locate: that could turn a method with breaches into an apparent 0% curve. */
function cumulativeVerdict(task, unit, info, round) {
  if (info.firstBreachRound !== null) return info.firstBreachRound <= round;
  if (task.objectType === 'agent' || !info.completedRounds) return null;
  const history = unit.history || [];
  const end = Math.min(round, info.completedRounds);
  const values = Array.from({ length: end }, (_, index) => {
    const number = index + 1;
    const h = history.find((entry) => positive(entry.round) === number);
    const judged = roundVerdict(h);
    if (judged !== null) return judged;
    // Only a genuinely single-round unit can inherit its final verdict here.
    if (info.completedRounds === 1 && history.length === 1 && positive(h?.round) === 1) return knownVerdict(unit);
    return null;
  });
  if (values.includes(true)) return true;
  return values.length && values.every((value) => value === false) ? false : null;
}

function analyze(task, units) {
  const entries = units.map((u) => ({ ...roundInfo(task, u), success: knownVerdict(u), unit: u }));
  const rounds = entries.map((e) => e.completedRounds).filter((n) => n !== null);
  const breaches = entries.filter((e) => e.success === true && e.breachRound != null).map((e) => e.breachRound);
  const unknownBreachRound = entries.filter((e) => e.success === true && e.breachRound == null).length;
  const budgets = [...new Set(entries.map((e) => e.maxRounds).filter((n) => n !== null))];
  const maxRounds = budgets.length === 1 ? budgets[0] : null;
  const comparable = entries.filter((e) => e.maxRounds !== null && e.completedRounds !== null && e.success !== null);
  const limit = Math.max(0, ...budgets);
  const curve = Array.from({ length: limit }, (_, i) => {
    const round = i + 1;
    // A shorter-budget method is not silently treated as a longer-budget failure.
    const eligible = comparable.filter((e) => e.maxRounds >= round);
    const outcomes = eligible.map((e) => cumulativeVerdict(task, e.unit, e, round));
    const known = outcomes.filter((v) => v !== null).length;
    const breach = outcomes.filter((v) => v === true).length;
    const missing = eligible.length - known;
    return { round, breach, judged: eligible.length, known, missing,
      value: eligible.length && missing === 0 ? breach / eligible.length : null };
  });
  return { sampleCount: units.length, roundSamples: rounds.length, maxRounds, budgets, averageCompleted: rounds.length ? rounds.reduce((a, b) => a + b, 0) / rounds.length : null,
    breachRoundMedian: median(breaches), breachRoundSamples: breaches.length,
    // A mean over only the known successes would misrepresent all successful units.
    averageBreachRound: breaches.length && !unknownBreachRound ? breaches.reduce((a, b) => a + b, 0) / breaches.length : null,
    unknownBreachRound, curve };
}

export function roundAnalysis(task) {
  const units = task.units || [];
  const methodNames = task.objectType === 'agent' ? [task.techniqueName || 'Agent 演练'] : (task.methods || []).map((m) => m.name);
  const methods = methodNames.map((name) => ({ name, ...analyze(task, task.objectType === 'agent' ? units : units.filter((u) => u.method === name)) }));
  return { ...analyze(task, units), methods };
}
