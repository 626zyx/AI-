/* Shared process-demonstration canvas for the initial and populated dashboards. */
import { icon } from './icons.js';
import { BUSINESS_ICONS } from '../domain/constants.js';
import { arenaBackground } from './arena-background.js';

export function exerciseArena(type, { footer = '' } = {}) {
  const label = type === 'model' ? '模型演练' : 'Agent 演练';
  const next = type === 'model' ? 'Agent 演练' : '模型演练';
  return `<div class="ps-arena-h"><h2>演练场</h2><span class="ps-view-label">${label}</span><button class="icon-btn ps-switch" title="切换到${next}" aria-label="切换到${next}" onclick="App.psToggle()">${icon('swapHorizontal',16)}</button><span class="ps-demo-label">流程示意</span><span id="ps-current-task" class="ps-current-task"></span></div>
    <div class="ps-arena-body">${arenaBackground()}<div class="ps-scene" id="ps-scene" aria-label="${label}流程示意"><div class="ps-scene-fallback" data-ps-fallback>${icon(BUSINESS_ICONS.attacker,24)}<span>红队</span><i>→</i>${icon(BUSINESS_ICONS[type === 'agent' ? 'agent' : 'model'],24)}<span>靶标</span><i>→</i>${icon(BUSINESS_ICONS.evaluator,24)}<span>裁判</span></div></div>
      <div class="ps-process" aria-label="演练流程说明"><div class="ps-flow-ambience" aria-hidden="true"><span class="ps-flow-track"></span>${Array.from({ length: 12 }, (_, i) => `<i style="--particle:${i}"></i>`).join('')}</div><div id="ps-process-lines" class="ps-process-lines ps-flow-${type}" aria-live="off"></div></div></div>${footer}`;
}

