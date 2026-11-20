/* Initial homepage with onboarding; the populated posture dashboard is a separate entry. */
import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';
import { icon } from '../core/icons.js';
import { exerciseArena } from '../core/exercise-arena.js';
import { mountPosture } from './posture.js';
import { INITIAL_METRICS, initialResources, welcomeSequences } from '../domain/welcome.js';

function metricsBand() {
  return `<section class="ps-band wh-band"><div class="ps-band-title"><span class="ps-mark"></span><div><h1>安全态势</h1><span class="wh-status">待首次演练</span></div></div>
    <div class="ps-metrics">${INITIAL_METRICS.map(metric => `<div class="ps-metric"><div class="ps-metric-v" aria-label="尚无演练数据">—</div><div class="ps-metric-l">${UI.esc(metric.label)}<span>${UI.esc(metric.description)}</span></div></div>`).join('')}</div>
    <button class="link-btn wh-posture-link" onclick="App.go('posture','home')">查看安全态势 ${icon('chevronRight',12)}</button></section>`;
}

function onboarding(type) {
  const agent = type === 'agent';
  return `<nav class="wh-onboarding" aria-label="首次演练引导">
    <button onclick="App.go('assets','${agent ? 'agents' : 'models'}')"><span class="wh-step-num">01</span><span><b>接入${agent ? '智能体' : '模型'}</b><small>${agent ? '准备镜像与基座模型' : '配置靶标与辅助模型'}</small></span>${icon('chevronRight',14)}</button>
    <button onclick="App.go('strategy','${agent ? 'ag-strategy' : 'attack'}')"><span class="wh-step-num">02</span><span><b>准备演练策略</b><small>选择题库与攻击方法</small></span>${icon('chevronRight',14)}</button>
    <button class="wh-start" onclick="App.go('${agent ? 'agent' : 'exercise'}','${agent ? 'ag-task-create' : 'task-create'}')"><span class="wh-step-num">03</span><span><b>新建演练任务</b><small>核对配置后开始演练</small></span>${icon('chevronRight',14)}</button>
  </nav>`;
}

export const welcomeArena = type => exerciseArena(type, { footer: onboarding(type) });

function riskCard() {
  return `<section class="ps-card wh-risk"><div class="ps-card-h">风险提醒<span class="wh-state-tag">尚未评估</span></div><div class="wh-risk-empty"><span class="wh-empty-icon">${icon('shield',28)}</span><div><h3>从一次演练开始，了解风险</h3><p>首个任务完成后，根据有效判定和风险规则生成提醒。尚未演练时，不判断资产是否安全。</p><button class="link-btn" onclick="App.go('platform','riskrule')">查看风险规则 ${icon('chevronRight',12)}</button></div></div></section>`;
}

function assetsCard() {
  const resources = initialResources(store);
  return `<section class="ps-card wh-assets"><div class="ps-card-h">资产态势<button class="link-btn ps-more" onclick="App.go('assets','models')">资产中心</button></div><div class="wh-assets-body">
    <div class="wh-user-assets"><div class="wh-subtitle">我的资产</div><div class="wh-asset-symbol">${icon('box',34)}</div><strong>等待接入</strong><p>接入后展示资产分布<br>演练后补充评估结果</p><div class="wh-asset-links"><button onclick="App.go('assets','models')"><i></i>接入模型 ${icon('chevronRight',12)}</button><button onclick="App.go('assets','agents')"><i></i>接入智能体 ${icon('chevronRight',12)}</button></div></div>
    <div class="wh-resources"><div class="wh-subtitle">系统内置资源<span>可先了解</span></div><div class="wh-resource-list">${resources.map(resource => `<button class="wh-resource" onclick="App.go('${resource.page}','${resource.sub}')"><span>${icon('book',16)}</span><span><b>${UI.esc(resource.name)}</b><small>${UI.esc(resource.kind)}</small></span>${icon('chevronRight',12)}</button>`).join('') || '<p class="wh-resource-empty">暂无可用题库，可前往策略中心准备。</p>'}</div><button class="link-btn wh-guide-link" onclick="App.openUserGuide()">${icon('book',14)} 阅读平台使用指南</button></div>
    </div></section>`;
}

export function welcomePage() {
  return `<div id="welcome-root" class="ps wh">${metricsBand()}<div class="ps-workspace"><section class="ps-arena" id="ps-arena" data-view="model" aria-label="演练流程示意">${welcomeArena('model')}</section><aside class="ps-overview">${riskCard()}${assetsCard()}</aside></div></div>`;
}

export function mountWelcome(host = document, options = {}) {
  return mountPosture(host, { ...options, rootSelector: '#welcome-root', renderArena: welcomeArena, getSequences: welcomeSequences });
}
