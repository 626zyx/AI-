/* 任务信息共用组件：摘要保持精简，详情复用全站右侧抽屉。
 * 每次打开重新读取任务，配置优先使用保存时的快照。 */
import * as UI from './ui.js';
import * as store from '../domain/store.js';
import { TASK_STATUS, SURFACE_KIND } from '../domain/constants.js';
import { detailValue as value, detailFields as fields, detailBlock, detailTableField, methodConfigurationTable, openConfigDetail } from './config-detail.js';
import { modelEvaluatorSnapshot } from '../domain/model-evaluators.js';

const configuration = task => ({ ...task, ...task.configSnapshot });
const guardText = config => config.guardId ? `${config.guardName || '已启用'}${config.guardStages?.length ? ` · ${config.guardStages.join(' + ')}` : ''}` : '未启用';
const agentMode = config => (config.exerciseMode || (config.technique === 'baseline' ? 'baseline' : 'attack')) === 'baseline' ? '基础安全演练' : '注入攻击演练';
const agentBaseModel = config => config.targetModelName || config.targetModelSnapshot?.name || config.targetModelApi
  || config.targetSnapshot?.baseModelSnapshot?.name || config.targetSnapshot?.model || config.targetModelId;
const agentEvaluation = config => `LLM 评估${config.judgeName ? ` · ${config.judgeName}` : ''}`;

export function configSummary(task, type = task.objectType || 'model') {
  const config = configuration(task);
  const overview = type === 'agent'
    ? [['靶标', config.targetName], ['所选基模', agentBaseModel(config)], ['演练方式', agentMode(config)], ['评估方式', agentEvaluation(config)]]
    : [['靶标', config.targetName], ['红队', config.strategyName], ['蓝队', guardText(config)], ['裁判', config.judgeName]];
  return `<section class="tc-summary" data-task-config data-config-task="${UI.esc(task.id)}" data-config-type="${type}" aria-label="任务信息">
    <header class="tc-summary-heading"><h2>任务信息</h2><button class="link-btn tc-trigger" data-config-toggle aria-expanded="false" aria-haspopup="dialog">完整配置</button></header>
    <dl class="tc-overview${type === 'agent' ? ' tc-overview-agent' : ''}">
      ${overview.map(([label, content]) => `<div><dt>${UI.esc(label)}</dt><dd>${value(content)}</dd></div>`).join('')}
    </dl>
  </section>`;
}

function methodRows(config) {
  // Published strategy parameters fill older snapshots that only recorded method names and budgets.
  const strategy = store.recordedModelStrategy(config.strategyId);
  return (config.methods || []).map(method => {
    const recorded = method.params;
    const params = recorded || strategy?.methods.find(m => m.name === method.name)?.params || [];
    const auxiliary = method.auxiliaryModels || params.filter(([name]) => name.includes('模型')).map(([role, name]) => ({ role, name }));
    return { ...method, params: params.filter(([name]) => !name.includes('模型')), auxiliary };
  });
}
function bankScope(config, type) {
  if (type === 'agent') return `${config.sceneBankName || '环境库'} · ${config.total || 0} 个环境`;
  if (config.banks?.length) return config.banks.map(bank => `${bank.name || '场景题库'} · ${bank.count} 题`).join('；');
  return config.bankName ? `${config.bankName} · ${config.bankCount ?? '—'} 题` : '—';
}
function agentQuestionScope(config) {
  const snapshots = config.questionSnapshots?.length ? config.questionSnapshots : (config.taskIdSnapshot || config.questionIds || []).map(id => {
    const unit = config.units?.find(row => row.sceneTaskId === id);
    return { id, title: unit?.goal, source: 'historical' };
  });
  return detailTableField('已选环境', UI.table([
    { title: '环境', render: row => `${value(row.title || row.id || row.taskId)}${row.title ? `<div class="faint text-support">${value(row.id || row.taskId)}</div>` : ''}` },
    { title: '版本', render: row => value(row.version || '归档版本') },
    { title: '来源', render: row => value(({ system: '系统', custom: '自建', historical: '历史归档' })[row.source] || row.source) },
  ], snapshots, '尚未选择环境'));
}
function agentDetailedConfiguration(config) {
  const attack = agentMode(config) !== '基础安全演练';
  return `<section class="tc-config-group tc-config-object"><h4>被测对象</h4>${fields([
    ['靶标名称', config.targetName], ['所选基模', agentBaseModel(config)],
    ...(config.targetAssetVersion ? [['靶标版本', config.targetAssetVersion]] : []),
    ...(config.targetModelSnapshot?.version ? [['基模版本', config.targetModelSnapshot.version]] : []),
    ['运行镜像', config.targetImage || config.targetSnapshot?.image],
  ])}</section>
    <section class="tc-config-group" data-config-red><h4>演练配置</h4>${fields([['演练方式', agentMode(config)], ['环境范围', bankScope(config, 'agent')]])}${agentQuestionScope(config)}
    ${attack ? fields([
      ['攻击模板', config.attackTemplateName || config.techniqueName], ['攻击模型', config.attackerName],
      ['注入范围', config.requestedSurfaces?.map(surface => `${SURFACE_KIND[surface.kind] || surface.kind} · ${surface.path}`).join('；') || '未选择'],
    ]) : ''}</section>
    <section class="tc-config-group"><h4>评估配置</h4>${fields([
      ['评估方式', 'LLM 评估'],
      ['裁判模型', config.judgeName || '尚未选择'],
    ])}</section>`;
}
function detailedConfiguration(config, type) {
  if (type === 'agent') return agentDetailedConfiguration(config);
  const red = fields([['策略名称', config.strategyName], ['题库范围', bankScope(config, type)]]);
  const methods = type === 'agent'
    ? fields([['攻击方法', config.techniqueName], ...(config.attackerName ? [['辅助模型', `攻击生成模型：${config.attackerName}`]] : [])])
    : detailTableField('攻击方法', methodConfigurationTable(methodRows(config)));
  return `<section class="tc-config-group tc-config-object"><h4>被测对象</h4>${fields([['靶标名称', config.targetName]])}</section>
    <section class="tc-config-group" data-config-red><h4>红队配置</h4>${red}${methods}${type === 'agent' ? fields([['注入面范围', config.technique === 'baseline' ? '不注入' : config.requestedSurfaces?.map(surface => `${SURFACE_KIND[surface.kind] || surface.kind} · ${surface.path}`).join('；') || '—']]) : ''}</section>
    ${type === 'agent' ? '' : `<section class="tc-config-group" data-config-blue><h4>蓝队配置</h4>${fields([
      ['是否启用', config.guardId ? '已启用' : '未启用'],
      ...(config.guardId ? [['防护策略', config.guardName], ['防护位置', (config.guardStages || []).join(' + ') || '未选择']] : []),
    ])}</section>`}
    <section class="tc-config-group"><h4>评估配置</h4>${fields([['裁判', config.judgeName], ['评估器', config.evaluatorName || '模型安全语义评估'], ['评估指标', '攻击成功率（ASR）']])}<details class="tc-evaluator-prompt"><summary>评估提示词</summary><pre>${UI.esc((config.evaluatorSnapshot || modelEvaluatorSnapshot()).prompt)}</pre></details></section>
    ${type === 'model' ? `<section class="tc-config-group"><h4>执行配置</h4>${fields([['并发数', config.concurrency ?? '—'], ['Token 限制', config.maxTokens ? `${config.maxTokens} tokens / 次` : '—']])}</section>` : ''}`;
}
function agentExecutionSource(task) {
  const execution = task.executionSnapshot || (!task.configSnapshot && !['draft', 'ready'].includes(task.status) ? task : null);
  if (!execution) return '';
  return `<section class="tc-config-group" data-config-execution-source><h4>证据执行来源</h4>${fields([
    ['证据记录', task.replaySourceName || task.name],
    ['实际评估', 'Codex 离线语义复核'],
    ['执行说明', '读取归档离线复核，未调用本次所选裁判模型或执行当前环境包。'],
    ...(task.sourceStartedAt ? [['原运行时间', task.sourceStartedAt]] : []),
  ])}</section>`;
}
function drawerBody(task, type) {
  const base = [
    ['任务名称', task.name], ['任务描述', task.description || task.desc || '—'],
    ['任务状态', TASK_STATUS[task.status]?.label || (task.status === 'starting' ? '进行中' : '—')],
    ['创建时间', task.createdAt || task.startedAt],
    ...(task.startedAt ? [['开始时间', task.startedAt]] : []),
    ...(task.finishedAt ? [['结束时间', task.finishedAt]] : []),
  ];
  return `<div class="tc-drawer-content" data-config-drawer="${UI.esc(task.id)}">
    ${detailBlock('任务基础信息', fields(base))}
    ${detailBlock('详细配置信息', detailedConfiguration(configuration(task), type) + (type === 'agent' ? agentExecutionSource(task) : ''))}
  </div>`;
}

export function mountTaskConfig(host = document) {
  const cleanups = [];
  host.querySelectorAll('[data-task-config]').forEach(root => {
    const trigger = root.querySelector('[data-config-toggle]');
    const id = root.dataset.configTask, type = root.dataset.configType;
    let releaseDrawer = () => {};
    const open = () => {
      releaseDrawer();
      const task = type === 'agent' ? store.getAgentTask(id) : store.getTask(id);
      if (!task) return UI.toast('任务不存在');
      openConfigDetail('完整配置', drawerBody(task, type), '<button class="btn" type="button" data-config-close>关闭</button>');
      const overlay = document.getElementById('drawer'), panel = overlay.querySelector('.drawer');
      panel.id = `config-${id}`;
      panel.setAttribute('aria-label', '完整配置');
      const closeButton = panel.querySelector('.modal-head button');
      closeButton.setAttribute('data-config-close', '');
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-controls', panel.id);
      const ownsDrawer = () => overlay.contains(panel);
      let observer;
      const release = () => {
        observer?.disconnect();
        overlay.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKey);
        trigger.setAttribute('aria-expanded', 'false');
        releaseDrawer = () => {};
      };
      const close = (restoreFocus = true) => {
        if (ownsDrawer()) UI.closeDrawer();
        release();
        if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
      };
      const onClick = event => {
        if (event.target === overlay || event.target.closest('[data-config-close]')) close();
      };
      const onKey = event => {
        if (!ownsDrawer() || !overlay.classList.contains('open')) return;
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key !== 'Tab') return;
        const controls = [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]')].filter(el => !el.disabled && el.tabIndex >= 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      };
      overlay.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
      observer = new window.MutationObserver(() => { if (!ownsDrawer() || !overlay.classList.contains('open')) release(); });
      observer.observe(overlay, { attributes: true, attributeFilter: ['class'], childList: true });
      releaseDrawer = () => close(false);
      closeButton.focus({ preventScroll: true });
    };
    trigger.addEventListener('click', open);
    cleanups.push(() => { releaseDrawer(); trigger.removeEventListener('click', open); });
  });
  return () => cleanups.forEach(cleanup => cleanup());
}
