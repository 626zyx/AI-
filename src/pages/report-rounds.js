/* 报告轮数字段：与领域统计共用证据口径，嵌入方法表现和单元详情。 */
import * as UI from '../core/ui.js';
import { roundInfo, roundAnalysis } from '../domain/task-rounds.js';

const numberText = (n, digits = 0) => n === null || n === undefined ? '—' : Number(n).toFixed(digits);
export const roundCountText = (t, u) => {
  const r = roundInfo(t, u);
  return `${numberText(r.completedRounds)} / ${numberText(r.maxRounds)}`;
};
export const breachRoundText = (t, u) => {
  const r = roundInfo(t, u);
  return r.breachRound != null ? `第 ${r.breachRound} 轮` : '—';
};

export function methodRoundMetrics(t) {
  return new Map(roundAnalysis(t).methods.map(m => {
    const configured = t.objectType === 'agent' ? t.maxRounds : t.methods?.find(x => x.name === m.name)?.maxRounds;
    const maxRounds = m.budgets.length ? m.maxRounds : Number.isInteger(configured) && configured > 0 ? configured : null;
    return [m.name, { ...m, maxRounds }];
  }));
}

export const methodRoundNote = (t) => '总轮数为每个单元配置的攻击轮数；平均攻破轮次为已攻破单元攻破轮次的算术均值。无攻破或轮次证据不完整时显示“—”。'
  + (t.objectType === 'agent' ? 'Agent 工具调用和过程步骤不计作攻击轮。' : '');

export const methodRoundColumns = [
  { title: '总轮数', width: '96px', render: r => `<span class="num">${numberText(r.maxRounds)}</span>` },
  { title: '平均攻破轮次', width: '144px', render: r => `<span class="num${r.averageBreachRound != null ? ' report-key-metric' : ''}"${r.unknownBreachRound ? ` title="${r.unknownBreachRound} 个已攻破单元缺少攻破轮次"` : ''}>${numberText(r.averageBreachRound, 1)}</span>` },
];

export function methodPerformanceMd(t, rows) {
  return ['## 攻击方法表现', '', methodRoundNote(t), '',
    '| 攻击方法 | 有效数量 | 守住 | 攻破 | 总轮数 | 平均攻破轮次 | 攻破率 |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.label} | ${r.judged} | ${r.judged - r.breach} | ${r.breach} | ${numberText(r.maxRounds)} | ${numberText(r.averageBreachRound, 1)} | ${UI.pct(r.value)} |`), ''];
}
