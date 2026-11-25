/* 数据态势页：汇总已有演练指标、风险与资产，画板使用共用流程示意。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { icon } from '../core/icons.js';
import { BUSINESS_ICONS } from '../domain/constants.js';
import { exerciseArena } from '../core/exercise-arena.js';
import { exerciseDemoSequences } from '../domain/exercise-demo.js';

const RANGES = [[7, '近 7 天'], [30, '近 30 天'], [null, '全部']];
const ROWS = 3;
const state = { range: 30 };
let active = null;
const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clip = (text, count = 240) => String(text || '—').length > count ? `${String(text).slice(0, count)}...` : String(text || '—');
const verdictLabel = value => ({ breach: '已攻破', safe: '未攻破', error: '异常' })[value] || '—';

/* ---------------------------------------------------------------- 态势数字条 */
function metricCell(m) {
  const tone = m.tone ? ` tone-${m.tone}` : '';
  return `<div class="ps-metric${tone}">
    <div class="ps-metric-v">${UI.esc(String(m.value))}</div>
    <div class="ps-metric-l">${UI.esc(m.label)}<span>${UI.esc(m.sub)}</span></div>
  </div>`;
}

function metricsBand(b) {
  const seg = RANGES.map(([d, l]) => `<button class="${state.range === d ? 'active' : ''}" onclick="App.psRange(${d === null ? 'null' : d})">${l}</button>`).join('');
  return `<section class="ps-band">
    <div class="ps-band-title"><span class="ps-mark"></span><h1>安全态势</h1><button class="link-btn ps-home-link" onclick="App.go('home','home')">返回工作台</button></div>
    <div class="ps-metrics" id="ps-metrics">${b.metrics.map(metricCell).join('')}</div>
    <div class="seg ps-seg">${seg}</div>
  </section>`;
}

/* ---------------------------------------------------------------- 资产态势 / 风险与消息 */
function assetDistribution(assets) {
  const total = assets.length;
  const modelCount = assets.filter(asset => asset.kind === 'model').length;
  const agentCount = total - modelCount;
  const modelShare = total ? modelCount / total * 100 : 0;
  return `<figure class="ps-asset-distribution" aria-label="已演练资产分布：模型 ${modelCount} 个，智能体 ${agentCount} 个">
    <figcaption>演练资产分布</figcaption>
    <div class="ps-asset-donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ps-donut-track" cx="60" cy="60" r="48"/>${total ? `<circle class="ps-donut-agent" cx="60" cy="60" r="48"/><circle class="ps-donut-model" cx="60" cy="60" r="48" pathLength="100" stroke-dasharray="${modelShare} ${100 - modelShare}"/>` : ''}</svg><div><strong>${total}</strong><span>已演练资产</span></div></div>
    <div class="ps-asset-legend"><span><i class="model"></i>模型<b>${modelCount}</b></span><span><i class="agent"></i>智能体<b>${agentCount}</b></span></div>
  </figure>`;
}

function assetsCard(b) {
  const pg=UI.paginate('posture-assets',b.assets);
  const rows = b.assets.length ? pg.slice.map((a) => `<div class="ps-row" title="${UI.esc(a.name)}">
    <span class="ps-asset-dot ${a.kind}"></span>
    <span class="ps-row-main"><b>${UI.esc(a.name)}</b><span>${a.kind === 'agent' ? '智能体' : '模型'} · 演练 ${a.runs} 次</span></span>
    <span class="ps-asset-asr num" title="任务平均 ASR：所选时间范围内各已完成任务 ASR 的算术平均；无有效判定的任务不参与">${a.asr === null ? '—' : UI.pct(a.asr)}</span>
  </div>`).join('') : '<div class="ps-empty">范围内暂无演练资产</div>';
  return `<section class="ps-card" id="ps-assets-card"><div class="ps-card-h">资产态势<span class="ps-card-n num">${b.assets.length}</span>
    ${b.assets.length > ROWS ? `<button class="link-btn ps-more" onclick="App.go('assets','models')">全部</button>` : ''}</div><div class="ps-assets-body">${assetDistribution(b.assets)}<div class="ps-asset-details"><div class="ps-asset-list-head"><span>资产明细</span><span>任务平均ASR</span></div><div class="ps-list">${rows}</div>${pg.count>1?UI.pager(pg,'App.psAssetsPage({p})'):''}</div></div></section>`;
}

function riskCard(b) {
  const rows = b.risks.length ? b.risks.slice(0, ROWS).map((e) => `<button class="ps-row ps-risk ${e.risk.key}" onclick="App.${e.source === 'agent' ? 'openAgTask' : 'openTask'}('${e.id}')">
    <span class="ps-risk-sev">${UI.esc(e.risk.label)}</span>
    <span class="ps-row-main"><b>${UI.esc(e.targetName)}</b><span>${UI.esc(e.typeName)} · ${UI.esc(String(e.at || '').slice(5, 16))}</span></span>
    <span class="ps-risk-asr num">${UI.pct(e.asr)}</span>
  </button>`).join('') : '<div class="ps-empty">范围内暂无风险事件</div>';
  return `<section class="ps-card" id="ps-risk-card"><div class="ps-card-h">风险提醒<span class="ps-count">${b.risks.length}</span>
    ${b.risks.length > ROWS ? `<button class="link-btn ps-more" onclick="App.go('exercise','tasks')">全部</button>` : ''}</div><div class="ps-list">${rows}</div></section>`;
}

export function posturePage() {
  const board = store.postureBoard(state.range);
  return `<div id="ps-root" class="ps">${metricsBand(board)}<div class="ps-workspace"><section class="ps-arena" id="ps-arena" data-view="model" aria-label="演练场">${exerciseArena('model')}</section><aside class="ps-overview">${riskCard(board)}${assetsCard(board)}</aside></div></div>`;
}

export const postureSequences = exerciseDemoSequences;

/* One mounted runtime owns its scene, timer and hover listener. Switching type
 * disposes that runtime before mounting the next scene. */
export function mountPosture(host = document, { sceneLoader = () => import('../core/scene3d.js'), rootSelector = '#ps-root', renderArena = exerciseArena, getSequences = exerciseDemoSequences } = {}) {
  const root = host.querySelector(rootSelector);
  if (!root) return () => {};
  active?.dispose();
  const arena = root.querySelector('#ps-arena');
  let type = 'model', scene = null, timer = null, disposed = false, generation = 0;
  let sequences = [], sequenceIndex = 0, eventIndex = 0;
  const schedule = (fn, delay) => {
    const current = generation;
    timer = setTimeout(() => { timer = null; if (!disposed && current === generation && root.isConnected) fn(); }, delay);
  };
  const resetRuntime = () => { generation += 1; clearTimeout(timer); timer = null; scene?.dispose(); scene = null; };
  const lines = () => root.querySelector('#ps-process-lines');
  function append(event) {
    const box = lines();
    if (!box) return;
    const oldPositions = new Map([...box.children].map(child => [child, child.getBoundingClientRect().top]));
    const row = document.createElement('section');
    const roleStyle = event.role.endsWith('_guard') ? 'gate' : event.role;
    row.className = `ps-output ${roleStyle}`;
    row.dataset.role = event.role;
    row.innerHTML = `<span class="ps-packet-node" aria-hidden="true"></span><span class="ps-packet-grain" aria-hidden="true"><i></i><i></i><i></i><i></i></span><h3><span class="ps-packet-role">${icon(BUSINESS_ICONS[roleStyle === 'src' ? 'attacker' : roleStyle === 'gate' ? 'guard' : roleStyle === 'judge' ? 'evaluator' : type === 'agent' ? 'agent' : 'model'],13)}</span>${UI.esc(event.label)}${event.verdict ? `<span class="ps-verdict ${event.verdict}">${verdictLabel(event.verdict)}</span>` : ''}</h3><p>${UI.esc(clip(event.text, 160))}</p>`;
    box.appendChild(row);
    while (box.children.length > 3) box.firstElementChild.remove();
    [...box.children].forEach((child, i, all) => {
      child.classList.toggle('ps-packet-current', i === all.length - 1);
      child.classList.toggle('ps-packet-previous', i === all.length - 2);
      child.classList.toggle('ps-packet-old', i < all.length - 2);
      if (!reduce() && oldPositions.has(child) && child.animate) {
        const shift = oldPositions.get(child) - child.getBoundingClientRect().top;
        if (Math.abs(shift) > 1) child.animate([{ translate: `0 ${shift}px` }, { translate: '0 0' }], { duration: 620, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
    });
  }
  function stageProgress(sequence, index) {
    const box = lines();
    const event = sequence.events[index];
    const isAssessment = event.phase === 'assessment';
    box.dataset.phase = event.phase;
    box.innerHTML = `<div class="ps-stage-heading"><span>任务流程</span><small>${UI.esc(sequence.taskLabel || '')}</small></div>
      <ol class="ps-stage-list">${sequence.events.map((step, i) => `<li class="ps-stage ${i < index ? 'done' : i === index ? 'current' : 'pending'}"${i === index ? ' aria-current="step"' : ''}><span class="ps-stage-node" aria-hidden="true">${i < index ? icon('check',12) : String(i + 1).padStart(2,'0')}</span><span>${UI.esc(step.label)}</span></li>`).join('')}</ol>
      <div class="ps-stage-current" data-role="${event.role}"><span class="ps-stage-pulse" aria-hidden="true"></span><p>${UI.esc(clip(event.text, 160))}</p><small>${index + 1} / ${sequence.events.length}</small></div>
      <div class="ps-agent-content${isAssessment ? ' ps-agent-assessments' : ' ps-agent-evidence'} is-entering" aria-label="${isAssessment ? 'Agent 表现评价' : event.label}">${event.content.map((item, i) => `<section class="ps-agent-card${isAssessment ? ' ps-agent-assessment' : ''} ${item.key}" style="--assessment-order:${i}" data-role="${event.role}"><h3>${UI.esc(item.label)}${item.verdict ? `<span class="ps-verdict ${item.verdict}">${verdictLabel(item.verdict)}</span>` : ''}</h3><p>${UI.esc(clip(item.text, isAssessment ? 260 : 400))}</p></section>`).join('')}</div>`;
    box.scrollTop = 0;
  }
  function animate(event) {
    if (!scene || reduce()) return;
    if (type === 'model') {
      scene.focus(event.role);
      if (event.action === 'attack') scene.attack(event.blocked);
      if (event.action === 'reply') scene.reply(event.blocked);
      if (event.action === 'judge' && ['breach', 'safe'].includes(event.verdict)) scene.judge(event.verdict);
    } else {
      scene.focus('agent', { callout: false });
      if (event.action === 'inject') scene.inject();
      if (event.action === 'outputs') scene.outputs();
      if (['breach', 'safe'].includes(event.verdict)) scene.verdict(event.verdict);
    }
  }
  function startSequence() {
    if (!sequences.length) { lines().innerHTML = '<div class="ps-empty">暂无演练记录</div>'; return; }
    const current = sequences[sequenceIndex % sequences.length];
    root.querySelector('#ps-current-task').textContent = current.title;
    lines().innerHTML = '';
    eventIndex = 0;
    if (type === 'model') scene?.reset({ target: current.target, guard: current.guardStages });
    else scene?.load(current.scene);
    if (reduce()) { if (type === 'agent') stageProgress(current, current.events.length - 1); else current.events.forEach(append); return; }
    const next = () => {
      const event = current.events[eventIndex++];
      if (type === 'agent') stageProgress(current, eventIndex - 1); else append(event);
      animate(event);
      if (eventIndex < current.events.length) schedule(next, type === 'agent' ? 4000 : 2600);
      else schedule(() => { sequenceIndex += 1; startSequence(); }, type === 'agent' && event.phase === 'assessment' ? 10000 : 4200);
    };
    next();
  }
  async function select(nextType) {
    resetRuntime();
    type = nextType;
    sequenceIndex = 0;
    arena.dataset.view = type;
    arena.innerHTML = renderArena(type);
    sequences = getSequences(type);
    const current = generation;
    if (typeof WebGLRenderingContext !== 'undefined') {
      try {
        const mod = await sceneLoader();
        if (disposed || current !== generation || !root.isConnected) return;
        // The scene occupies the entire arena. CSS describes only its initial
        // framing, leaving zoomed geometry free to extend behind the bubbles.
        const options = { appearance: 'light', compact: true, autoRotate: false, frameFromCSS: true, transparentBackground: true };
        scene = type === 'model' ? mod.createModelScene(root.querySelector('#ps-scene'), options) : mod.createAgentScene(root.querySelector('#ps-scene'), options);
        root.querySelector('[data-ps-fallback]').hidden = true;
      } catch { /* The evidence stream remains available without WebGL. */ }
    }
    if (!disposed && current === generation && root.isConnected) startSequence();
  }
  const hover = event => {
    const row = event.target.closest('[data-role]');
    if (row) {
      if (type === 'model') scene?.focus(row.dataset.role);
      else scene?.focus('agent', { callout: false });
    }
  };
  root.addEventListener('mouseover', hover);
  const runtime = {
    toggle: () => select(type === 'model' ? 'agent' : 'model'),
    dispose: () => { if (disposed) return; disposed = true; resetRuntime(); root.removeEventListener('mouseover', hover); if (active === runtime) active = null; },
  };
  active = runtime;
  select('model');
  return runtime.dispose;
}

export const actions = {
  psToggle() { active?.toggle(); },
  psAssetsPage(page) { UI.setPage('posture-assets',page,{rerender:false}); const host=document.getElementById('ps-assets-card'); if(host)host.outerHTML=assetsCard(store.postureBoard(state.range)); },
  psRange(days) {
    state.range = days; UI.resetPage('posture-assets');
    const board = store.postureBoard(days);
    const metrics = document.getElementById('ps-metrics'); if (metrics) metrics.innerHTML = board.metrics.map(metricCell).join('');
    const assets = document.getElementById('ps-assets-card'); if (assets) assets.outerHTML = assetsCard(board);
    const risks = document.getElementById('ps-risk-card'); if (risks) risks.outerHTML = riskCard(board);
    document.querySelectorAll('.ps-seg button').forEach((button, i) => button.classList.toggle('active', RANGES[i][0] === days));
  },
  openTask(id) { router.nav('exercise', 'task-detail', id); },
  openAgTask(id) { router.nav('agent', 'ag-task-detail', id); },
};
