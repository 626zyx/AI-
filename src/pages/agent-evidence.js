/* Agent task requirements and final assessments; no reconstructed execution trace. */
import * as UI from '../core/ui.js';

export const agentTaskDescription = unit => unit.taskDescription || unit.goal || '—';
// Presentation cleanup only: retain the recorded assessment and its confidence.
export const agentAssessmentText = value => String(value || '').replace(/[，,、；;]?\s*需醒目标注/g, '').trim();
export function agentTaskStepsHTML(unit) {
  const steps = unit.taskSteps || [];
  return steps.length ? `<div class="ud-field"><span class="ud-label">环境要求</span><ol class="agent-task-steps">${steps.map(step => `<li>${UI.esc(step)}</li>`).join('')}</ol></div>` : '';
}
export function agentTaskGoalHTML(unit) {
  return `<div class="ud-field"><span class="ud-label">环境描述</span><pre class="ud-text">${UI.esc(agentTaskDescription(unit))}</pre></div>${agentTaskStepsHTML(unit)}`;
}
export function agentTaskGoalMd(unit) {
  return ['**环境描述**', '', agentTaskDescription(unit), '', ...(unit.taskSteps?.length ? ['**环境要求**', '', ...unit.taskSteps.map((step, i) => `${i + 1}. ${step.replace(/\n/g, '\n   ')}`), ''] : [])];
}

const adoption = { rejected: '拒绝', partial: '部分采纳', adopted: '采纳', unseen: '未触及', unknown: '响应不明' };
const confidence = { high: '高', medium: '中', low: '低' };
const field = (label, content) => `<div class="ud-field"><span class="ud-label">${UI.esc(label)}</span><div class="ud-val">${content}</div></div>`;
const paragraph = (label, content) => content ? field(label, `<pre class="ud-text">${UI.esc(agentAssessmentText(content))}</pre>`) : '';
const referenceText = ref => typeof ref === 'string' ? ref : `${ref.path || ref.source || '证据'}${ref.line ? `:${ref.line}` : ''}${ref.summary ? ` — ${ref.summary}` : ''}`;
const plannedPaths = attack => (attack.allowedPaths?.length ? attack.allowedPaths : attack.plannedSurfaces || []).map(item => typeof item === 'string' ? item : item.path || item.name || item.kind).filter(Boolean);
export function injectionDeliveryText(unit) {
  const attack = unit.attack;
  if (!attack) return '';
  const files = [...new Set((attack.surfaces || []).map(surface => surface.path).filter(Boolean))];
  const fileNames = files.join('、');
  if (attack.deliveryStatus === 'complete') return fileNames ? `已按规定范围交付攻击文件：${fileNames}。` : '已按规定范围完成攻击文件交付。';
  if (attack.deliveryStatus === 'partial') return `仅完成部分规定范围的交付${fileNames ? `，已交付：${fileNames}` : ''}。`;
  if (attack.deliveryStatus === 'failed') return '未能完成规定范围的攻击文件交付。';
  return fileNames ? `已记录交付文件：${fileNames}；是否符合规定范围未记录。` : '尚无攻击文件交付记录。';
}

export const highlySuspectedSurface = surface => surface.inferred === true && surface.confidence === 'high' && ['partial', 'adopted'].includes(surface.adopted);
/* 疑似响应分级：high 高度疑似 / medium 疑似 / low 弱疑似 / null 非疑似。
 * 让 medium、low 置信的疑似响应也能在详情和报告里显示，避免同批不同靶标前后表现不一致。 */
export const suspicionLevel = surface => (surface.inferred === true && ['partial', 'adopted'].includes(surface.adopted)) ? (surface.confidence || 'low') : null;
const SUSPECT_LABEL = { high: '高度疑似响应', medium: '疑似响应', low: '弱疑似响应' };
export function surfaceResponseLabel(surface) {
  const label = adoption[surface.adopted] || '响应不明';
  return surface.inferred === true ? `疑似${label}` : ({ rejected: '已拒绝', adopted: '已采纳', partial: '部分采纳', unseen: '未触及' }[surface.adopted] || label);
}
export function surfaceResponseTag(surface) {
  const lvl = suspicionLevel(surface);
  const cls = lvl === 'high' ? 'agent-suspected-badge' : lvl ? `mtag suspect-${lvl}` : 'mtag';
  return `<span class="${cls}">${UI.esc(surfaceResponseLabel(surface))}${surface.inferred && surface.confidence ? ` · ${UI.esc(confidence[surface.confidence] || surface.confidence)}置信` : ''}</span>`;
}
export function injectionAlertHTML(unit) {
  const surfaces = (unit.attack?.surfaces || []).filter(highlySuspectedSurface);
  if (!surfaces.length) return '';
  return `<aside class="agent-injection-alert" data-suspected-response="high"><strong>高度疑似响应 · ${UI.esc(surfaces.map(s => s.path).join('、'))}</strong><p>${UI.esc(surfaces.map(s => agentAssessmentText(s.reaction || surfaceResponseLabel(s))).join('\n'))}</p><small>${unit.verdict === 'breach' ? '当前环境已由产物确认受保护内容泄漏；注入因果归因为疑似。' : '结构或内容响应不等于泄漏；是否泄漏以独立语义判定为准。'}缺少完整轨迹，不据此确认加载或执行顺序。</small></aside>`;
}
export function injectionAssessmentHTML(unit) {
  const attack = unit.attack;
  if (!attack) return '';
  const paths = plannedPaths(attack);
  return `${injectionAlertHTML(unit)}${paragraph('攻击概述', attack.summary)}
    ${paragraph('预定注入范围', paths.length ? paths.join('\n') : '旧记录未单独保存预定范围；下方仅列实际落地位置。')}
    ${paragraph('注入交付合规', injectionDeliveryText(unit))}
    <div class="ud-field"><span class="ud-label">${attack.surfaces?.some(s => s.inferred) ? '疑似靶标响应' : '靶标响应记录'}</span><div class="ud-rounds">${(attack.surfaces || []).map(surface => { const lvl = suspicionLevel(surface); const hot = lvl === 'high' || lvl === 'medium'; return `<details class="ud-round${hot ? ' agent-surface-highlight' : ''}${lvl ? ` suspect-${lvl}` : ''}"${hot ? ' open' : ''}><summary><span class="ud-round-no">${UI.esc(surface.path)}</span>${surfaceResponseTag(surface)}</summary><div class="ud-round-body"><div class="ud-field"><span class="ud-label">注入意图</span><pre class="ud-text">${UI.esc(agentAssessmentText(surface.intent) || '—')}</pre></div><div class="ud-field"><span class="ud-label">对应表现</span><pre class="ud-text">${UI.esc(agentAssessmentText(surface.reaction) || '—')}</pre></div>${(surface.evidenceRefs || []).map(ref => `<div class="ud-ref">${UI.esc(referenceText(ref))}</div>`).join('')}</div></details>`; }).join('')}</div></div>`;
}
export function injectionAssessmentMd(unit) {
  const attack = unit.attack;
  if (!attack) return [];
  const paths = plannedPaths(attack);
  return ['#### 攻击配置与交付', '', agentAssessmentText(attack.summary), '', `**预定注入范围**：${paths.length ? paths.join('、') : '旧记录未单独保存'}`, '', `**注入交付合规**：${injectionDeliveryText(unit)}`, '', '##### 疑似靶标响应 / 既有响应记录', '', ...(attack.surfaces || []).flatMap(surface => [
    `- **${highlySuspectedSurface(surface) ? '【高度疑似响应】' : ''}${surface.path}**（${surface.kind} · ${surface.scope}）：${surfaceResponseLabel(surface)}${surface.confidence ? `，置信度${confidence[surface.confidence] || surface.confidence}` : ''}。`,
    `  - 注入意图：${agentAssessmentText(surface.intent) || '—'}`, `  - 对应表现：${agentAssessmentText(surface.reaction) || '—'}`,
    ...(surface.evidenceRefs || []).map(ref => `  - 证据：${referenceText(ref)}`),
    ...(surface.inferred ? ['  - 归因边界：依据产物反推，缺少完整轨迹；响应与实质泄漏分别判定，高置信仍为疑似。'] : []), '',
  ])];
}

