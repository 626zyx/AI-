import * as UI from './ui.js';
import { createSandboxValidation } from '../domain/sandbox-validation.js';

export function sandboxValidationPanel(value, { kind = value?.kind || 'target', title = '沙箱验证', onRun = '', onRetry = onRun, stale = false } = {}) {
  const report = value || createSandboxValidation(kind), running = report.state === 'running';
  const status = stale ? '配置已变更，需重新验证' : ({ idle: '尚未验证', running: '模拟验证中', passed: '演示验证通过', failed: '验证未通过' })[report.state];
  const groups = [...new Set(report.steps.map(step => step.phase))];
  return `<section class="sv-panel" aria-label="${UI.esc(title)}"><header><div><h3>${UI.esc(title)}</h3><span class="sv-demo">演示验证 · 模拟过程</span></div><span class="sv-status ${stale ? 'stale' : report.state}" role="status">${UI.esc(status)}</span></header>
    <p class="sv-disclosure">静态检查依据当前配置；运行步骤为演示模拟，未实际启动容器或调用模型。</p>
    <details class="sv-step-details" ${report.state === 'passed' && !stale ? '' : 'open'}><summary>验证步骤 · ${report.steps.filter(step => step.state === 'passed').length} / ${report.steps.length} 已通过</summary><div class="sv-phases">${groups.map(phase => `<section>${groups.length > 1 ? `<h4>${UI.esc(phase)}</h4>` : ''}<ol>${report.steps.filter(step => step.phase === phase).map(step => `<li class="${stale ? 'stale' : step.state}"><span class="sv-step-icon" aria-hidden="true">${({ pending: '·', running: '…', passed: '✓', failed: '!', skipped: '–' })[step.state]}</span><div><strong>${UI.esc(step.name)}</strong>${step.state === 'pending' ? '' : `<p>${UI.esc(step.detail)}</p>`}${step.remedy ? `<p class="sv-remedy">修复建议：${UI.esc(step.remedy)}</p>` : ''}</div></li>`).join('')}</ol></section>`).join('')}</div></details>
    ${report.logs.length ? `<details class="sv-logs" ${report.state === 'failed' ? 'open' : ''}><summary>验证日志（${report.logs.length}）</summary><ol>${report.logs.map(log => `<li>${UI.esc(log.message)}</li>`).join('')}</ol></details>` : ''}
    <footer>${onRun ? `<button type="button" class="btn${report.state === 'passed' && !stale ? '' : ' primary'}" onclick="${UI.esc(report.state === 'idle' ? onRun : onRetry)}" ${running ? 'disabled' : ''}>${running ? '验证中…' : report.state === 'idle' ? '开始演示验证' : '重新验证'}</button>` : ''}</footer></section>`;
}
