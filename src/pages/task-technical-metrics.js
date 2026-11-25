import * as UI from '../core/ui.js';
import { taskOperationalMetrics } from '../domain/task-technical-metrics.js';

const number = value => value==null?'—':Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const seconds = value => value==null?'—':`${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`;
const demo = value => value ? '<span class="tm-demo" title="当前缺少完整遥测，使用演示数据">演示</span>' : '';
function range(key, values, format, simulated) {
  return `<details class="tm-metric-range" data-metric-range="${key}"><summary>每单元统计${simulated ? ' · 演示' : ''}</summary><dl>${[['平均', values[0]], ['最大', values[1]], ['最小', values[2]]].map(([label, value]) => `<div><dt>${label}</dt><dd class="num">${format(value)}</dd></div>`).join('')}</dl></details>`;
}

export function renderTaskTechnicalMetrics(task,options={}) {
  const { execution, timing, tokens } = taskOperationalMetrics(task,options);
  return `<div class="task-technical-metrics" data-task-technical-metrics>
    <article class="tm-operational" data-task-metric="executionRate" title="正常执行结束的单元数 ÷ 预期单元数。安全或不安全的判定不影响执行成功。">
      <div class="task-metric-label">执行成功率</div><div class="task-metric-value"><strong class="num">${UI.pct(execution.value)}</strong></div><p class="num">${execution.executed} / ${execution.expected} 个单元</p>
    </article>
    <article class="tm-operational" data-task-metric="duration" title="${UI.esc(timing.note)}">
      <div class="task-metric-label">任务总耗时${demo(timing.totalDemo)}</div><div class="task-metric-value"><strong class="num">${seconds(timing.totalSeconds)}</strong></div>${range('duration', [timing.unitAverageSeconds, timing.unitMaxSeconds, timing.unitMinSeconds], seconds, timing.rangeDemo)}
    </article>
    <article class="tm-operational" data-task-metric="tokens" title="${UI.esc(tokens.note)}">
      <div class="task-metric-label">Token 总用量${demo(tokens.totalDemo)}</div><div class="task-metric-value"><strong class="num">${number(tokens.total)}</strong></div>${range('tokens', [tokens.unitAverage, tokens.unitMax, tokens.unitMin], number, tokens.rangeDemo)}
    </article>
  </div>`;
}

export function taskTechnicalMetricsMd(task, options = {}) {
  const { execution, timing, tokens } = taskOperationalMetrics(task, options);
  const mark = value => value ? '（演示数据）' : '';
  return [
    `- 执行成功率：${UI.pct(execution.value)}（${execution.executed} / ${execution.expected} 个单元）`,
    `- 任务总耗时：${seconds(timing.totalSeconds)}${mark(timing.totalDemo)}`,
    `  - 每单元耗时${mark(timing.rangeDemo)}：平均 ${seconds(timing.unitAverageSeconds)}；最大 ${seconds(timing.unitMaxSeconds)}；最小 ${seconds(timing.unitMinSeconds)}`,
    `- Token 总用量：${number(tokens.total)}${mark(tokens.totalDemo)}`,
    `  - 每单元 Token${mark(tokens.rangeDemo)}：平均 ${number(tokens.unitAverage)}；最大 ${number(tokens.unitMax)}；最小 ${number(tokens.unitMin)}`,
  ];
}
