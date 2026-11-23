/* The overview projects shared facts; changing the period never changes current inventory. */
import * as store from './store.js';
import { listAssetStates } from './asset-assessments.js';
import { listConnections, listSyncRuns } from './asset-sync.js';
import { listGradeRules } from './grading-rules.js';
import { latestStrategyRows, releaseLabel } from './strategy-service.js';
import { selectableModelBanks, selectableAgentBanks } from './resource-authoring.js';

export const HOME_PERIODS = [{ id: '3d', label: '近3天', days: 3 }, { id: '7d', label: '近7天', days: 7 }, { id: '1m', label: '近1个月', days: 30 }];
export function activityTime(value) {
  if (!value) return NaN;
  const text = String(value).replace(' ', 'T');
  return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : `${text}+08:00`);
}
export function homePeriod(id = '7d', now = new Date()) {
  const period = HOME_PERIODS.find(item => item.id === id) || HOME_PERIODS[1];
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const start = Date.parse(`${today}T00:00:00+08:00`) - (period.days - 1) * 86400000;
  return { ...period, start, end: now.getTime(), includes: at => activityTime(at) >= start && activityTime(at) <= now.getTime() };
}
export function homeResources() {
  const model = latestStrategyRows(store.strategies), agent = latestStrategyRows(store.agentStrategies);
  const newest = rows => [...rows].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
  const strategyCard = (rows, title, sub) => {
    const recent = newest(rows);
    return { title, value: rows.length, unit: '项策略', detail: recent ? recent.name : '尚未建立策略', tag: recent ? releaseLabel(recent.version) : '—', go: `App.go('strategy','${sub}')` };
  };
  const models = store.platformModels(), rules = listGradeRules(), enabled = rules.filter(rule => rule.enabled);
  return [
    { id: 'strategies', label: '演练策略', icon: 'layers', count: model.length + agent.length, cards: [strategyCard(model, '模型演练', 'attack'), strategyCard(agent, '智能体演练', 'ag-strategy')] },
    { id: 'resources', label: '底层资源', icon: 'book', count: selectableModelBanks().length + selectableAgentBanks().length + store.methods.length + store.agentMethods.length + store.guards.length, cards: [
      { title: '模型场景与方法', value: selectableModelBanks().length, unit: '个场景题库', detail: `${store.methods.length} 种演练方法 · ${store.guards.length} 种防护方法`, tag: '查看', go: "App.go('strategy','banks')" },
      { title: '智能体场景与方法', value: selectableAgentBanks().length, unit: '个场景题库', detail: `${store.agentMethods.length} 种演练方法`, tag: '查看', go: "App.go('strategy','scenebanks')" },
    ] },
    { id: 'models', label: '功能模型', icon: 'cpu', count: models.length, cards: [
      { title: '已连通模型', value: models.filter(m => m.status === 'connected').length, unit: '个模型', detail: `共 ${models.length} 个功能模型`, tag: '管理', go: "App.go('platform','roles')" },
      { title: '模型用途', value: new Set(models.flatMap(m => m.roles || [])).size, unit: '类用途', detail: '攻击生成 · 裁判 · 防护 · 题库生成', tag: '配置', go: "App.go('platform','roles')" },
    ] },
    { id: 'rules', label: '等级规则', icon: 'settings', count: enabled.length, cards: ['model', 'agent'].map(kind => ({ title: `${kind === 'model' ? '模型' : '智能体'}数据等级`, value: enabled.filter(rule => rule.kind === kind).length, unit: '条启用规则', detail: `${enabled.filter(rule => rule.kind === kind && rule.notify).length} 条开启消息提醒`, tag: '配置', go: "App.go('platform','grading')" })) },
  ];
}
export function homeView(periodId = '7d', now = new Date()) {
  const period = homePeriod(periodId, now), assets = listAssetStates(), allTasks = [...store.listTasks(), ...store.listAgentTasks()];
  const tasks = allTasks.filter(t => period.includes(t.finishedAt || t.startedAt || t.createdAt));
  const running = allTasks.filter(t => t.status === 'running');
  const reports = allTasks.filter(t => t.status === 'done' && period.includes(t.finishedAt));
  const graded = assets.filter(a => a.latest), pending = assets.filter(a => ['untested', 'retest'].includes(a.exercise));
  const grades = [['critical', '致命', '#c44b63'], ['high', '高危', '#dc8b50'], ['medium', '中危', '#d9b04f'], ['low', '低危', '#7198d3'], ['safe', '安全', '#4ea58e'], ['unassessed', '未评估', '#b8c3d3']].map(([key, label, color]) => ({ key, label, color, count: assets.filter(a => key === 'unassessed' ? !a.latest || a.grade.key === 'unassessed' : a.latest && a.grade.key === key).length }));
  const attention = assets.map(asset => ({ ...asset, activityAt: [asset.updatedAt, asset.syncedAt, asset.latest?.at].filter(Boolean).sort((a, b) => activityTime(b) - activityTime(a))[0] })).filter(a => period.includes(a.activityAt)).sort((a, b) => activityTime(b.activityAt) - activityTime(a.activityAt));
  const connections = listConnections().map(c => ({ ...c, assetCount: assets.filter(a => a.sourceConnectionId === c.id).length, lastBatch: listSyncRuns(c.id)[0] || null }));
  // Report notifications already carry the assessment grade and open its frozen report.
  const notices = store.notifications().filter(n => period.includes(n.at)).map(n => ({ ...n, assessment: ['grade', 'report'].includes(n.type), urgent: ['grade', 'report'].includes(n.type) && /致命|高危/.test(`${n.title} ${n.meta}`) })).sort((a, b) => Number(b.assessment) - Number(a.assessment) || Number(b.urgent) - Number(a.urgent) || activityTime(b.at) - activityTime(a.at)).slice(0, 40);
  return { period, assets, tasks, running, reports, graded, pending, grades, attention, connections, notices, resources: homeResources(), coverage: assets.length ? graded.length / assets.length : 0, errorTasks: tasks.filter(t => t.status === 'error') };
}
export function initialResources({ banks = [], sceneBanks = [] } = {}) { return [...banks.filter(b => b.source === 'system').map(b => ({ name: b.name, kind: '模型场景题库', page: 'strategy', sub: 'banks' })), ...sceneBanks.filter(b => b.source === 'system' && b.items?.length).map(b => ({ name: b.name, kind: '智能体场景题库', page: 'strategy', sub: 'scenebanks' }))]; }
export { exerciseDemoSequences as welcomeSequences } from './exercise-demo.js';
export const INITIAL_METRICS = [];
