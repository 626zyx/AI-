/* 报告的交叉分析只汇总单元证据；无样本、无判定与零攻破保持不同。 */
import * as UI from '../core/ui.js';
import { asrLevel } from '../domain/metrics.js';
import { unitTechnicalMetrics } from '../domain/unit-technical-metrics.js';

export function riskMethodMatrix({ units = [], risks = [], methods = [], riskOf, methodOf, outcomeOf }) {
  return {
    methods,
    rows: risks.map(risk => ({ ...risk, cells: methods.map(method => {
      const selected = units.filter(unit => methodOf(unit) === method.key && riskOf(unit).includes(risk.key));
      const outcomes = selected.map(unit => outcomeOf(unit, risk.key));
      const judged = outcomes.filter(value => typeof value === 'boolean').length;
      const breach = outcomes.filter(value => value === true).length;
      return { risk: risk.label, method: method.label, total: selected.length, judged, breach,
        unknown: selected.length - judged, value: judged ? breach / judged : null,
        status: !selected.length ? 'uncovered' : !judged ? 'unknown' : breach ? 'breach' : 'safe' };
    }) })),
  };
}

export function matrixInsight(matrix) {
  const cells = matrix.rows.flatMap(row => row.cells), covered = cells.filter(cell => cell.total);
  const judged = cells.filter(cell => cell.judged), breached = judged.filter(cell => cell.breach);
  const unknown = covered.filter(cell => !cell.judged).length, uncovered = cells.length - covered.length;
  const top = [...breached].sort((a, b) => b.value - a.value || b.breach - a.breach)[0];
  const lead = top
    ? `「${top.risk} × ${top.method}」是攻破率最高的组合${breached.filter(cell => cell.value === top.value).length > 1 ? '之一' : ''}：${top.breach}/${top.judged} 个有效判定被攻破（${UI.pct(top.value)}）。优先围绕该组合复核靶标响应${matrix.methods.length > 1 ? '，并检查同一风险在其他方法下是否重复出现' : ''}。`
    : judged.length ? '已有有效判定的组合未记录攻破，结论仅适用于本次覆盖范围。' : '当前缺少有效判定，暂不能评价靶标的整体抵御表现。';
  return `${lead}共 ${covered.length} 个组合有执行记录，其中 ${breached.length} 个组合记录攻破。${unknown ? `${unknown} 个组合无有效判定；` : ''}${uncovered ? `${uncovered} 个组合未覆盖。` : ''}矩阵中的空缺不代表安全。`;
}

const matrixValue = cell => cell.status === 'uncovered' ? '未覆盖' : cell.status === 'unknown' ? '未知' : UI.pct(cell.value);
// Keep matrix row headings and evidence attributes while using the common pager.
export function pagedMatrixTableHTML(head, cells, className = 'grid') {
  const paged=cells.length>UI.PAGE_SIZE;
  const rows=cells.map((html,index)=>`<tr${paged?` data-table-row-index="${index}"`:''}>${html}</tr>`);
  const table=`<div class="table-wrap"><table class="${UI.esc(className)}"><thead><tr>${head}</tr></thead><tbody>${rows.slice(0,UI.PAGE_SIZE).join('')}</tbody></table></div>`;
  if(!paged)return table;
  return `<div class="auto-paged-table" data-table-total="${rows.length}" data-table-page="1">${table}<template data-table-rest><table><tbody>${rows.slice(UI.PAGE_SIZE).join('')}</tbody></table></template>${UI.pager({page:1,count:Math.ceil(rows.length/UI.PAGE_SIZE),total:rows.length},'UI.tablePage(this,{p})')}</div>`;
}
export function riskMethodMatrixHTML(matrix) {
  const head=`<th scope="col">风险场景</th>${matrix.methods.map(method=>`<th scope="col">${UI.esc(method.label)}</th>`).join('')}`;
  const rows=matrix.rows.map(row=>`<th scope="row">${UI.esc(row.label)}</th>${row.cells.map(cell=>`<td data-matrix-state="${cell.status}"><div class="rr-matrix-cell ${cell.status}${cell.value != null ? ` intensity-${asrLevel(cell.value).key}` : ''}"><strong${cell.value != null ? ' class="metric-asr"' : ''}>${matrixValue(cell)}</strong><span>${cell.judged ? `${cell.breach} / ${cell.judged}${cell.unknown ? ` · ${cell.unknown} 未判定` : ''}` : cell.total ? `${cell.total} 条未判定` : '—'}</span></div></td>`).join('')}`);
  return `<div class="rr-risk-matrix" data-risk-method-matrix><div class="rr-matrix-heading"><h3 class="sub-label">风险场景 × 攻击方法</h3><div class="rr-matrix-legend"><span class="safe">未攻破</span><span class="breach">存在攻破</span><span class="unknown">未知</span><span class="uncovered">未覆盖</span></div></div><p class="rr-note">每格显示攻破率及「攻破 / 有效判定」；未知表示已有执行但缺少有效判定，未覆盖表示没有该组合的执行记录。场景可重复归属，格间数量不相加。</p><div class="rr-matrix-scroll">${pagedMatrixTableHTML(head,rows)}</div></div>`;
}

export function riskMethodMatrixMd(matrix) {
  return [matrixInsight(matrix), '', '### 风险场景 × 攻击方法', '',
    '每格为攻破率（攻破 / 有效判定）。未知与未覆盖不代表安全；多标签场景数量不相加。', '',
    `| 风险场景 | ${matrix.methods.map(method => method.label).join(' | ')} |`, `|${Array(matrix.methods.length + 1).fill('---').join('|')}|`,
    ...matrix.rows.map(row => `| ${row.label} | ${row.cells.map(cell => `${matrixValue(cell)}${cell.judged ? `（${cell.breach}/${cell.judged}）` : ''}${cell.unknown ? ` · ${cell.unknown} 未判定` : ''}`).join(' | ')} |`), ''];
}

export const synthesisHTML = points => `<div class="rr-synthesis" data-report-synthesis>${points.filter(Boolean).map(point => `<p>${UI.esc(point)}</p>`).join('')}</div>`;
export function scenarioTagsHTML(labels, { limit = Infinity } = {}) {
  const unique = [...new Set(labels.filter(Boolean))], visible = unique.slice(0, limit), remaining = unique.slice(limit);
  return `<div class="rr-scenario-tags" aria-label="风险场景">${visible.map(label => `<span>${UI.esc(label)}</span>`).join('、') || '<span class="muted">场景未标注</span>'}${remaining.length ? `<span class="rr-scenario-more" title="${UI.esc(remaining.join('、'))}" aria-label="其余 ${remaining.length} 项：${UI.esc(remaining.join('、'))}">+${remaining.length}</span>` : ''}</div>`;
}

export function reportUnitTelemetry(task, unit) {
  const metrics = unitTechnicalMetrics(task, unit);
  return {
    duration: metrics.durationSeconds === null ? '—' : `${Number(metrics.durationSeconds.toFixed(2))} 秒`,
    tokens: metrics.totalTokens === null ? '—' : metrics.totalTokens.toLocaleString('en-US'),
    durationSource: metrics.durationSource || (metrics.durationSeconds === null ? 'missing' : 'recorded'),
    tokenSource: metrics.tokenSource || (metrics.totalTokens === null ? 'missing' : 'recorded'),
  };
}
export function reportUnitMetricHTML(task, unit, key) {
  const metrics = reportUnitTelemetry(task, unit), source = key === 'duration' ? metrics.durationSource : metrics.tokenSource;
  return `<span class="num" title="${source === 'demo' ? '演示数据' : source === 'recorded' ? '已有运行记录' : '尚未记录'}">${metrics[key]}</span>`;
}
export function reportUnitMetricMd(task, unit, key) {
  const metrics = reportUnitTelemetry(task, unit), source = key === 'duration' ? metrics.durationSource : metrics.tokenSource;
  return `${metrics[key]}${source === 'demo' ? '（演示数据）' : ''}`;
}
export const reportUnitMetricColumns = task => [
  { title: '耗时', width: '110px', render: unit => reportUnitMetricHTML(task, unit, 'duration') },
  { title: 'Token', width: '100px', render: unit => reportUnitMetricHTML(task, unit, 'tokens') },
];
