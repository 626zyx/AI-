import { esc } from './ui.js';
import { icon } from './icons.js';
import { resolveResultLevel, resultLevelRange } from '../domain/result-level-rules.js';

export function renderLevelDefinition(level, title = '') {
  return `<span class="result-level-badge" style="--result-level-color:${level.color}" title="${esc(title || resultLevelRange(level))}"><span class="result-level-icon">${icon('shield', 14)}</span><span>${esc(level.name)}</span></span>`;
}
export function renderResultLevelBadge(metricId, value) {
  const level = resolveResultLevel(metricId, value);
  return level ? renderLevelDefinition(level, `${level.ruleName} · ${resultLevelRange(level)}`) : '';
}
export function renderLevelText(level, title = '') {
  return `<span class="metadata-text" title="${esc(title || resultLevelRange(level))}">${esc(level.name)}</span>`;
}
export function renderResultLevelText(metricId, value) {
  const level = resolveResultLevel(metricId, value);
  return level ? renderLevelText(level, `${level.ruleName} · ${resultLevelRange(level)}`) : '';
}
