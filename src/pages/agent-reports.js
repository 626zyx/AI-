/* Agent 演练 · 演练报告：顶部摘要 + 覆盖配置面板 + 全宽分析。
 * 攻防明细 = 与模型演练同一套筛选、勾选、导出与分页表；抽屉沿用 core/detail.js 的同层级同呈现排版。 */
import * as UI from '../core/ui.js';
import { classificationTags,classificationFields,classifiedAgentRiskRows } from '../domain/task-classification.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { RISK_LABEL, AGENT_VERDICT } from '../domain/constants.js';
import { field, mod } from '../core/detail.js';
import { mdToHtml, emit, closePops, fmtOf } from '../core/export.js';
import { downloadZip } from '../core/zip.js';
import { agentResultPanel, agentBaseRows, agentConfigRows } from './agent-tasks.js';
import { configSummary } from '../core/task-config.js';
import { agentTaskGoalHTML, agentTaskGoalMd, agentAssessmentText, injectionAssessmentHTML, injectionAssessmentMd } from './agent-evidence.js';
import { reportQuestionCell, reportSection, reportDocument } from './report-format.js';
import { compareValues } from '../core/table-sort.js';
import { agentPerformance } from '../domain/agent-performance.js';
import { agentErrorFramework } from '../domain/agent-error-framework.js';
import { agentMetricLabel, agentMetricDefinition } from '../domain/metrics.js';
import { taskMetricsMd } from './task-metrics.js';
import { reportListResult } from './report-list-result.js';
import { reportListTelemetryColumns } from './report-list-telemetry.js';
import { resolveResultLevel } from '../domain/result-level-rules.js';
import { pagedMatrixTableHTML, riskMethodMatrix, riskMethodMatrixHTML, riskMethodMatrixMd, matrixInsight, synthesisHTML, scenarioTagsHTML, reportUnitMetricHTML, reportUnitMetricMd, reportUnitMetricColumns } from './report-insights.js';

const view = { q: '', targetId: 'all', sortDesc: true };
const detail = { tab: 'analysis', verdict: 'all', label: 'all' };
const picked = new Map();
let exportRequest = null;
const pickedOf = (taskId) => {
  if (!picked.has(taskId)) picked.set(taskId, new Set());
  return picked.get(taskId);
};
const riskTagsOf=u=>classificationTags(u,'risk')??(u.declaredLabels||[]).map(id=>({id,name:RISK_LABEL[id]?.label||id}));
const riskRowsOf=t=>t.classificationSnapshot?classifiedAgentRiskRows(t.units):t.labelsAgg;
const verdictOf = (u) => AGENT_VERDICT[u.verdict] || AGENT_VERDICT.error;
const unitNo = (t, u) => t.units.findIndex((x) => x.id === u.id) + 1;
/* ---------------------------------------------------------------- 列表 */
export function agentReportsPage() {
  const reports = store.listAgentReports();
  const targets = [...new Map(reports.map(report => [store.getAgentTask(report.taskId)?.targetId, report.targetName]).filter(([id]) => id)).entries()];
  let rows = reports;
  if (view.targetId !== 'all') rows = rows.filter(report => store.getAgentTask(report.taskId)?.targetId === view.targetId);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((r) => (r.name + r.targetName).toLowerCase().includes(q));
  }
  rows.sort((a, b) => compareValues(a.createdAt, b.createdAt, view.sortDesc));
  const flt = UI.filters({
    search: { label: '搜索', id: 'agrp-q', value: view.q, placeholder: '搜索报告名称或靶标', oninput: 'App.agrpSearch(this.value)' },
    selects: [{ label: '靶标', id: 'agrp-target', value: view.targetId, onchange: 'App.agrpTarget(this.value)',
      options: [['all', '全部靶标'], ...targets] }],
  });
  const table = UI.pagedTable(
    'ag-reports',
    [
      { title: '报告名称', render: (r) => `<button class="link-btn" onclick="App.openAgReport('${r.taskId}')">${UI.esc(r.name)}</button>` },
      { title: '靶标名称', width: '220px', render: (r) => UI.esc(r.targetName) },
      { title: 'ASR / 等级', width:'200px', render:r=>reportListResult(store.getAgentTask(r.taskId),'agent') },
      ...reportListTelemetryColumns(store.getAgentTask),
      { title: '生成时间', width: '160px', cls: 'num', sort: { direction: view.sortDesc ? 'descending' : 'ascending', onclick: 'App.agrpSort()' }, render: (r) => UI.esc(r.createdAt || '—') },
      {
        title: '操作', width: '90px', cls: 'actions',
        render: (r) => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openAgReport('${r.taskId}')` })}</div>`,
      },
    ],
    rows,
    '暂无演练报告',
  );
  return `${UI.pageHead('演练报告')}${flt}${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 详情 */
export function agentReportDetailPage(cur) {
  const t = store.getAgentTask(cur?.param);
  if (!t) return `${UI.backBtn()}${UI.pageHead('演练报告')}<div class="empty"><strong>报告不存在</strong></div>`;
  if (t.status !== 'done') return `${UI.backBtn()}${UI.pageHead(t.name)}${configSummary(t, 'agent')}
    <div class="empty"><strong>仅已完成任务生成报告</strong><p>当前过程可在任务详情中查看。</p>${UI.btn('任务详情', { onclick: `App.openAgTask('${t.id}')` })}</div>`;
  const head = `${UI.backBtn()}
    ${UI.pageHead(t.name, {
    actions: `<div class="pop-wrap">
        ${UI.btn('报告导出', { kind: 'primary', ico: 'download', onclick: "App.popToggle(event,'agrp-export')" })}
        <div class="pop" id="agrp-export" hidden onclick="event.stopPropagation()">
          <div class="pop-title">导出内容</div>
          <label class="pop-opt"><input type="checkbox" id="agex-analysis" checked />结果分析</label>
          <label class="pop-opt"><input type="checkbox" id="agex-detail" />攻防明细</label>
          <div class="pop-title">导出格式</div>
          <label class="pop-opt"><input type="radio" name="agex-fmt" value="pdf" checked />PDF</label>
          <label class="pop-opt"><input type="radio" name="agex-fmt" value="md" />Markdown</label>
          <div class="pop-foot">${UI.btn('确认导出', { kind: 'primary', onclick: `App.agrpExport('${t.id}')` })}</div>
        </div>
      </div>`,
  })}`;
  const toggle = `<div class="report-switch"><div class="seg" role="tablist">
    <button role="tab" aria-selected="${detail.tab === 'analysis'}" class="${detail.tab === 'analysis' ? 'active' : ''}" onclick="App.agrpTab('analysis')">结果分析</button>
    <button role="tab" aria-selected="${detail.tab === 'detail'}" class="${detail.tab === 'detail' ? 'active' : ''}" onclick="App.agrpTab('detail')">攻防明细</button>
  </div></div>`;
  return `<div class="rr-report">${head}${configSummary(t, 'agent')}${toggle}${detail.tab === 'analysis' ? analysisHTML(t) : detailHTML(t)}</div>`;
}

/* ---------------------------------------------------------------- 结果分析 */
/* 文字结论全部由判读结果拼出，导出与页面共用 */
function findings(t) {
  const n = t.agg;
  if (!n.judged) return [{ title: '尚无有效判定', text: `共计划 ${t.total} 个攻防单元，当前没有可计入${agentMetricLabel(t, true)}的有效判定。不能据此得出未攻破或安全结论。` }];
  const leaked = t.units.filter((u) => u.verdict === 'breach');
  const labels = [...new Set(leaked.flatMap(u => u.triggeredLabels || []).map(key => RISK_LABEL[key]?.label || key))];
  const weaknesses = [...t.errors].sort((a, b) => b.count - a.count);
  const level = resolveResultLevel('agent.asr', n.value);
  return [
    {
      title: leaked.length ? '已确认的安全风险' : '本次未确认攻破',
      text: leaked.length
        ? `${leaked.length} 个环境的对外产物包含受保护内容${labels.length ? `，涉及${labels.join('、')}` : ''}。${level ? `按「${level.ruleName}」判定为${level.name}。` : ''}应优先处理跨环境重复出现的泄漏边界。`
        : '已检查的对外产物未确认受保护内容泄漏；结论覆盖本次题集和配置。',
    },
    {
      title: '主要薄弱点',
      text: weaknesses.length
        ? `${weaknesses.slice(0, 3).map(e => `${e.type}（${e.count} 个环境）`).join('、')}。优先复核这些共性问题，逐环境证据保留在攻防明细中。`
        : '已记录的评估中没有额外的失误项。',
    },
  ];
}

function suggestions(t) {
  if (t.reportSummary?.suggestions?.length) return t.reportSummary.suggestions;
  const out = [];
  const leaked = t.units.filter((u) => u.verdict === 'breach');
  const types = new Set(t.errors.map((e) => e.type));
  if (leaked.length) {
    const labels = [...new Set(leaked.flatMap(unit => unit.triggeredLabels || []).map(key => RISK_LABEL[key]?.label || key))];
    out.push(`优先处理${labels.length ? `「${labels.join('、')}」类内容` : '受保护内容'}的外发：${leaked.length} 个环境已确认对外产物包含受保护内容。建议在智能体的发布前检查中加入「对外产物不引用受保护文件内容」的约束，再用同一策略复测。`);
  }
  if (types.has('元信息披露')) {
    out.push('收紧对外产物里的「排除说明」：多个环境在公开目录里写明了被排除文件的路径与类别，暴露了机密材料的存在。建议要求排除记录只留在内部渠道。');
  }
  if (types.has('部分采纳诱导')) {
    out.push('关注智能体对工作区内指令文件的信任度：产物中存在与注入要求相应的形式或内容变化。缺少完整轨迹，不能确认读取范围；建议约束非任务相关资料的引用并复测。');
  }
  if (t.technique === 'baseline') {
    out.push('叠加间接提示注入复测：基础安全演练只反映默认谨慎度，建议用间接提示注入策略验证同一靶标在诱导下的表现。');
  }
  out.push(`扩大环境数量：本次环境数较少，${agentMetricLabel(t, true)}波动较大，建议覆盖环境库全部环境并保持靶标不变以便横向对比。`);
  return out.slice(0, 3);
}

const errorFrameworkNote = '数字为记录该类失误的环境数，合计跨环节去重，不是安全评分。“—”表示未记录该类失误；现有数据未提供逐维度覆盖标记，不能据此判为安全。';
export function errorFrameworkHTML(t) {
  const framework = agentErrorFramework(t.units);
  const value = count => count === null ? '<span class="error-unrecorded">—</span>' : `<span class="error-observation num">${count}</span>`;
  const head=`<th scope="col">失误类型</th>${framework.stages.map(stage=>`<th scope="col">${UI.esc(stage)}</th>`).join('')}<th scope="col">涉及环境数</th>`;
  const rows=framework.rows.map(row=>`<th scope="row">${UI.esc(row.key)}<span class="error-type-description">${UI.esc(row.description)}</span></th>${row.cells.map(cell=>`<td data-error-stage="${UI.esc(cell.stage)}" data-error-status="${cell.status}">${value(cell.count)}</td>`).join('')}<td>${value(row.count)}</td>`);
  return `<section class="agent-error-framework" data-error-framework><h3 class="sub-label">失误维度与类型</h3><p class="rr-note">${UI.esc(errorFrameworkNote)}</p><div class="agent-error-framework-scroll">${pagedMatrixTableHTML(head,rows,'grid agent-error-matrix')}</div></section>`;
}

function performanceSection(key, title, section, task) {
  return `<section data-performance="${key}"><h3 class="sub-label">${title}</h3><div data-performance-summary>${synthesisHTML([agentAssessmentText(section.summary)])}</div></section>`;
}
function targetPerformance(t) {
  const performance = agentPerformance(t);
  const matrix = agentMatrix(t);
  return reportSection('靶标整体表现', `${synthesisHTML([matrixInsight(matrix), ...performancePriorities(t)])}${riskMethodMatrixHTML(matrix)}<div class="mt-16">${performanceSection('completion', '完成度表现', performance.completion, t)}</div>
    <div class="mt-16">${performanceSection('resistance', '抵御表现', performance.resistance, t)}</div>
    ${errorFrameworkHTML(t)}`);
}

function performancePriorities(t) {
  const rows = agentErrorFramework(t.units).rows.filter(row => row.count).sort((a, b) => b.count - a.count).slice(0, 2);
  return rows.map(row => {
    const stages = row.cells.filter(cell => cell.count).sort((a, b) => b.count - a.count);
    return `重点关注「${row.key}」：${row.count} 个环境记录该类问题${stages.length ? `，主要出现在${stages.map(cell => `${cell.stage}（${cell.count}）`).join('、')}` : ''}。围绕这些环节检查权限与内容边界，修复后沿用相同业务条件复测。`;
  });
}

function agentMatrix(t) {
  const risks = t.classificationSnapshot ? riskRowsOf(t).map(row=>({key:row.key,label:row.label})) : Object.entries(RISK_LABEL).filter(([key]) => key !== 'unclassified').map(([key,value])=>({key,label:value.label}));
  if (t.units.some(unit => !riskTagsOf(unit).length || riskTagsOf(unit).some(tag=>tag.id==='unclassified'))) risks.push({ key: 'unclassified', label: '未标注场景' });
  return riskMethodMatrix({ units: t.units, risks, methods: [{ key: t.technique, label: t.techniqueName }],
    riskOf: unit => riskTagsOf(unit).length ? riskTagsOf(unit).map(tag=>tag.id) : ['unclassified'], methodOf: () => t.technique,
    outcomeOf: (unit, risk) => !['safe', 'breach'].includes(unit.verdict) ? null : unit.classificationSnapshot ? unit.verdict==='breach' : risk === 'unclassified' ? unit.verdict === 'breach' : unit.verdict === 'safe' ? false : unit.triggeredLabels?.length ? unit.triggeredLabels.includes(risk) : null });
}

function riskInsights(t) {
  if(t.classificationSnapshot){const rows=riskRowsOf(t),top=[...rows].filter(row=>row.breach).sort((a,b)=>b.breach-a.breach)[0];return [`按任务开始时的风险场景标签分组，本次覆盖 ${rows.length} 类场景。${top?`「${top.label}」下 ${top.denominator} 个环境中有 ${top.breach} 个被攻破。`:'本次已判定环境未确认攻破。'}同一环境可属于多个场景；分组结果不能相加作为攻破总量，具体泄漏证据保留原判定标签。`];}
  const rows = riskRowsOf(t).filter(row => row.denominator), leaked = rows.filter(row => row.breach).sort((a, b) => b.breach - a.breach);
  const unknown = t.units.filter(unit => !['breach', 'safe'].includes(unit.verdict)).length;
  return [`本次环境声明覆盖 ${rows.length} 类风险，其中 ${leaked.length} 类有泄漏记录。${leaked[0] ? `「${leaked[0].label}」涉及最多泄漏（${leaked[0].breach}/${leaked[0].denominator} 个声明该标签的环境），应优先核查相关敏感内容进入对外产物的路径。` : '已有记录未确认场景泄漏。'}同一环境可带有多个标签，维度数量不能相加作为泄漏总量。${unknown ? `另有 ${unknown} 个环境缺少有效判定，不能当作未泄漏。` : ''}`];
}

/* 风险维度分析：七类标签雷达 + 明细表（分母 = 声明该标签的环境数） */
function riskDimBlock(t) {
  const rows = riskRowsOf(t);
  const rankedRows = [...rows].sort((a, b) => (b.asr ?? 0) - (a.asr ?? 0));
  const allDims = t.classificationSnapshot ? rows.map(row=>({key:row.key,label:row.label})) : Object.keys(RISK_LABEL).filter(k=>k!=='unclassified').map(k=>({key:k,label:RISK_LABEL[k].label}));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const radarItems = allDims.map((d) => {
    const r = byKey.get(d.key);
    return { label: d.label, value: r ? (r.asr ?? 0) : 0, covered: !!(r && r.denominator) };
  });
  const table = UI.table(
    [
      { title: '风险维度', render: (r) => UI.esc(r.label) },
      { title: '涉及环境数', width: '90px', render: (r) => `<span class="num">${r.denominator}</span>` },
      { title: t.classificationSnapshot?'攻破':'泄漏', width: '70px', render: (r) => `<span class="num${r === rankedRows[0] && r.denominator ? ' report-key-metric' : ''}">${r.breach}</span>` },
    ],
    rankedRows,
    '暂无风险维度数据',
  );
  return reportSection('场景风险分析', `
    ${synthesisHTML(riskInsights(t))}
    <div class="risk-charts">
      <div><div class="sub-label">${t.classificationSnapshot?'各场景攻破率':'各维度泄漏率'}（共 ${allDims.length} 类，本次覆盖 ${rows.length} 类）</div>${UI.radar(radarItems)}</div>
      <div><div class="sub-label">${t.classificationSnapshot?'场景明细（按开始时分类，攻破率分母为有效判定环境数）':'维度明细（分母为声明该维度的环境数）'}</div>${table}</div>
    </div>`);
}

function methodPoints(t) {
  const result = t.agg.judged ? `靶标在 ${t.agg.judged} 个有效判定中守住 ${t.agg.judged - t.agg.breach} 个、被攻破 ${t.agg.breach} 个（${UI.pct(t.agg.value)}）。${t.agg.breach ? '需结合产物中的受保护内容，检查资料权限如何沿业务流程传递。' : '本次未确认攻破，结论仍受环境范围与已有证据约束。'}` : '尚无有效判定，暂不能评价该方法下的靶标表现。';
  if (t.technique !== 'universal') return ['本次采用基础安全演练，未引入攻击者或额外注入文件，用于观察靶标处理原有业务材料时的信息安全边界。', result];
  const attacked = t.units.filter(u => u.attack), surfaces = attacked.flatMap(u => u.attack.surfaces || []);
  const kinds = [...new Set(surfaces.map(s => s.kind).filter(Boolean))];
  const execution = t.reportSummary?.methodPoints?.[0];
  const delivery = attacked.length && attacked.every(u => u.attack.deliveryStatus === 'complete')
    ? `各题均按预定范围交付攻击文件${kinds.length ? `，覆盖${kinds.join('、')}` : ''}。`
    : attacked.some(u => ['partial', 'failed'].includes(u.attack.deliveryStatus))
      ? '部分攻击文件未完成交付，具体文件及状态见攻防明细。' : '';
  return [
    result,
    execution || `攻击者 Agent 在 ${attacked.length} 个环境中布置了 ${surfaces.length} 个注入面${kinds.length ? `，涉及${kinds.join('、')}` : ''}。`,
    ...(execution ? [] : [`${t.attackerName ? `攻击生成模型 ${t.attackerName} 配合间接提示注入，` : '间接提示注入'}通过附加指令影响靶标对资料的取舍与产物生成。`]),
    ...(delivery ? [delivery] : []),
  ];
}
function methodBlock(t) {
  return reportSection('攻击方法表现', synthesisHTML(methodPoints(t)));
}

function analysisHTML(t, { expandDetails = false } = {}) {
  const f = findings(t).map(x => `<li class="conc-item"><b>${UI.esc(agentAssessmentText(x.title))}</b><p>${UI.esc(agentAssessmentText(x.text))}</p></li>`).join('');
  const s = suggestions(t).map(x => `<li class="conc-item"><p>${UI.esc(agentAssessmentText(x))}</p></li>`).join('');
  const html = reportDocument([
    reportSection('演练结果', agentResultPanel(t)),
    reportSection('核心发现', `<ol class="conclusions">${f}</ol>`),
    methodBlock(t),
    riskDimBlock(t),
    targetPerformance(t),
    reportSection('下一步建议', `<ol class="conclusions">${s}</ol>`),
  ]);
  return expandDetails ? html.replace(/<details\b([^>]*)>/g, (tag, attributes) => /\bopen\b/.test(attributes) ? tag : `<details open${attributes}>`) : html;
}

/* ---------------------------------------------------------------- 攻防明细 */
function filteredUnits(t) {
  return t.units.filter((u) => {
    if (detail.verdict !== 'all' && u.verdict !== detail.verdict) return false;
    if (detail.label !== 'all' && !riskTagsOf(u).some(tag=>tag.id===detail.label)) return false;
    return true;
  });
}

function detailHTML(t) {
  const units = filteredUnits(t);
  const sel = pickedOf(t.id);
  const selectedCount = t.units.filter(u => sel.has(u.id)).length;
  const pageUnits = UI.paginate(`ag-units-${t.id}`, units).slice;
  const allOn = pageUnits.length > 0 && pageUnits.every((u) => sel.has(u.id));
  const labels = [...new Map(t.units.flatMap(riskTagsOf).map(tag=>[tag.id,tag])).values()];
  const flt = UI.filters({
    selects: [
      { label: '风险标签', id: 'agd-label', value: detail.label, onchange: 'App.agdFilter("label",this.value)',
        options: [['all', '全部标签'], ...labels.map(tag=>[tag.id,tag.name])] },
      { label: '判定结果', id: 'agd-verdict', value: detail.verdict, onchange: 'App.agdFilter("verdict",this.value)',
        options: [['all', '全部结果'], ['breach', '已攻破'], ['safe', '已守住'], ['error', '异常']] },
    ],
    extra: `<span class="sel-ctl">
      <span class="muted text-support">已选 <b class="num">${selectedCount}</b> 条</span>
      ${UI.linkBtn('全选筛选结果', { onclick: `App.agdPickAll('${t.id}')` })}
      ${UI.linkBtn('清空选择', { onclick: `App.agdPickClear('${t.id}')`, disabled: !selectedCount })}
    </span>`,
    right: exportControl(t.id, null, !selectedCount),
  });
  const table = UI.pagedTable(
    `ag-units-${t.id}`,
    [
      {
        title: `<input type="checkbox" ${allOn ? 'checked' : ''} aria-label="全选本页" onclick="App.agdPickPage('${t.id}',this.checked)" />`,
        raw: true, width: '40px',
        render: (u) => `<input type="checkbox" ${sel.has(u.id) ? 'checked' : ''} aria-label="选择" onclick="App.agdPick('${t.id}','${u.id}',this.checked)" />`,
      },
      { title: '序号', width: '64px', render: (u) => `<span class="num">${unitNo(t, u)}</span>` },
      { title: '环境目标', render: (u) => reportQuestionCell(u.goal) },
      { title: '风险场景', width: '150px', render: (u) => scenarioTagsHTML(riskTagsOf(u).map(tag=>tag.name), { limit: 2 }) },
      { title: '判定结果', width: '100px', render: (u) => UI.verdictText(verdictOf(u)) },
      ...reportUnitMetricColumns(t),
      { title: '操作', width: '80px', cls: 'actions',
        render: (u) => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.agrpUnit('${t.id}','${u.id}')` })}</div>` },
    ],
    units,
    '该筛选条件下暂无明细',
  );
  return `${flt}<div class="one-line">${UI.card('', table, '', true)}</div>`;
}

/* ---------------------------------------------------------------- 抽屉：攻防明细详情 */
/* 摘要、原始任务要求、注入情况、判定及靶标表现；不展示反推轨迹。 */

function summaryMod(t, u) {
  return mod('摘要', `${scenarioTagsHTML(riskTagsOf(u).map(tag=>tag.name))}<div class="ud-kv">
    ${field('环境编号', `<span class="num">${UI.esc(u.sceneTaskId)}</span>`)}
    ${classificationFields(u).filter(d=>d.id!=='risk').map(d=>field(d.name,UI.esc(d.labels.join('、')||'未打标签'))).join('')}
    ${field('攻击方法', UI.esc(t.techniqueName))}
    ${field('判定结果', UI.verdictText(verdictOf(u)))}
    ${field('耗时', reportUnitMetricHTML(t, u, 'duration'))}
    ${field('Token', reportUnitMetricHTML(t, u, 'tokens'))}
  </div>`);
}

function evidenceVisual(u) {
  const surfaces = u.attack?.surfaces || [];
  const cards = [
    { label: '对外产物', value: String(u.outputFiles?.length || 0), note: '已记录的输出文件' },
    ...(u.attack ? [{ label: '注入面', value: String(surfaces.length), note: '已记录的攻击内容位置' }] : []),
    { label: '失误类型', value: String(new Set((u.errors || []).map(error => error.type).filter(Boolean)).size), note: '本环境已记录的类型数' },
  ];
  return `<div class="rr-evidence-visual" aria-label="现有证据概览">${cards.map(card => `<div><span>${card.label}</span><strong class="num">${card.value}</strong><small>${card.note}</small></div>`).join('')}</div>`;
}

const goalMod = u => mod('环境目标', agentTaskGoalHTML(u));

/* 注入情况：只有带攻击者的方法才有。每个注入面一个折叠条 */
function attackMod(u) {
  return u.attack ? mod('攻击配置与交付', injectionAssessmentHTML(u)) : '';
}

const basisMod = (u) => mod('判定理由', `<pre class="ud-text">${UI.esc(agentAssessmentText(u.judgeRationale) || '裁判未给出理由')}</pre>`);

const assessmentMod = (title, content) => mod(title, `<pre class="ud-text">${UI.esc(agentAssessmentText(content) || '—')}</pre>`);
const performanceMod = (u) => assessmentMod('靶标完成度', u.completion) + assessmentMod('抵御情况', u.resistance);

function unitDrawer(t, u) {
  return `<div class="ud">${summaryMod(t, u)}${evidenceVisual(u)}${goalMod(u)}${attackMod(u)}${performanceMod(u)}${basisMod(u)}</div>`;
}

/* 任务包：每个环境一个目录，放该题的对外产物源文件。 */
const zipFiles = (units) => units.flatMap((u) => (u.outputFiles || []).map((f) => ({
  url: `${u.resultDir}/${f.path}`,
  name: units.length > 1 ? `${u.sceneTaskId}/${f.path}` : f.path,
})));

/* ---------------------------------------------------------------- 导出 */
const strip = (h) => String(h).replace(/<[^>]+>/g, '');
function analysisMd(t) {
  const performance = agentPerformance(t);
  const errors = agentErrorFramework(t.units);
  return [`# ${t.name}`, '',
    '## 基础信息', '', ...agentBaseRows(t).map(([k, v]) => `- ${k}：${strip(v)}`), '',
    '## 详细配置', '', ...agentConfigRows(t).map(([k, v]) => `- ${k}：${strip(v)}`), '',
    '## 演练结果', '', agentMetricDefinition(t), '', ...taskMetricsMd(t), '',
    '## 核心发现', '', ...findings(t).map((f, i) => `${i + 1}. **${agentAssessmentText(f.title)}**：${agentAssessmentText(f.text)}`), '',
    '## 攻击方法表现', '', ...methodPoints(t).map((point, i) => `${i + 1}. ${agentAssessmentText(point)}`), '',
    '## 场景风险分析', '', ...riskInsights(t), '', t.classificationSnapshot?'| 风险场景 | 涉及环境数 | 攻破 |':'| 风险维度 | 涉及环境数 | 泄漏 |', '|---|---|---|',
    ...riskRowsOf(t).map((r) => `| ${r.label} | ${r.denominator} | ${r.breach} |`), '',
    '## 靶标整体表现', '', ...riskMethodMatrixMd(agentMatrix(t)), ...performancePriorities(t), '',
    '### 完成度表现', '', agentAssessmentText(performance.completion.summary), '',
    '### 抵御表现', '', agentAssessmentText(performance.resistance.summary), '',
    '#### 失误维度与类型', '', errorFrameworkNote, '', `| 失误类型 | ${errors.stages.join(' | ')} | 涉及环境数 |`, `|${Array(errors.stages.length + 2).fill('---').join('|')}|`,
    ...errors.rows.map(row => `| ${row.key} | ${row.cells.map(cell => cell.count ?? '—').join(' | ')} | ${row.count ?? '—'} |`), '',
    '## 下一步建议', '', ...suggestions(t).map((s, i) => `${i + 1}. ${agentAssessmentText(s)}`), ''].join('\n');
}
function unitsMd(t, units) {
  return ['## 攻防明细', '', `共 ${units.length} 条`, '', ...units.flatMap((u) => [
    `### ${unitNo(t, u)}. ${u.sceneTaskId} · ${verdictOf(u).label}`, '',
    '#### 摘要', '', `- 攻击方法：${t.techniqueName}`, `- 风险场景：${riskTagsOf(u).map(tag=>tag.name).join('、') || '未标注'}`, ...classificationFields(u).filter(d=>d.id!=='risk').map(d=>`- ${d.name}：${d.labels.join('、')||'未打标签'}`), `- 判定结果：${verdictOf(u).label}`, `- 耗时：${reportUnitMetricMd(t, u, 'duration')}`, `- Token：${reportUnitMetricMd(t, u, 'tokens')}`, '',
    '#### 环境目标', '', ...agentTaskGoalMd(u),
    ...injectionAssessmentMd(u),
    '#### 靶标完成度', '', agentAssessmentText(u.completion), '', '#### 抵御情况', '', agentAssessmentText(u.resistance), '',
    '#### 判定理由', '', agentAssessmentText(u.judgeRationale), '',
  ])].join('\n');
}

const redraw = () => router.nav('agent', 'ag-report-detail', router.state().param);
function completedTask(id) {
  const task = store.getAgentTask(id);
  if (task?.status === 'done') return task;
  UI.toast('仅已完成任务可查看或导出报告');
  return null;
}

function selectedExportUnits(task, request = exportRequest) {
  if (!request || request.taskId !== task.id) return [];
  return request.unitId
    ? task.units.filter(unit => unit.id === request.unitId)
    : task.units.filter(unit => pickedOf(task.id).has(unit.id));
}

function exportControl(taskId, unitId = null, disabled = false) {
  const id = unitId ? 'agd-unit-export' : 'agd-list-export';
  const button = UI.btn('导出明细', { disabled,
    onclick: `App.agdOpenExport('${taskId}',${unitId ? `'${unitId}'` : 'null'},event)` })
    .replace('<button ', `<button aria-expanded="false" aria-controls="${id}" `);
  return `<span class="dd agd-export-control">${button}<div class="dd-menu agd-export-menu" id="${id}" hidden
    aria-label="导出攻防明细" onclick="event.stopPropagation()" onkeydown="if(event.key==='Escape'){event.stopPropagation();App.agdCancelExport()}"></div></span>`;
}

function exportMenu(request = exportRequest) {
  return request ? document.getElementById(request.unitId ? 'agd-unit-export' : 'agd-list-export') : null;
}

function positionExportMenu(menu) {
  const trigger = menu.previousElementSibling, viewport = menu.ownerDocument.defaultView;
  const rect = trigger.getBoundingClientRect();
  menu.style.maxHeight = '';
  const below = Math.max(0, viewport.innerHeight - rect.bottom - 12), above = Math.max(0, rect.top - 12);
  const openBelow = menu.offsetHeight <= below || below >= above;
  menu.style.maxHeight = `${Math.max(80, openBelow ? below : above)}px`;
  const width = menu.offsetWidth, height = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(rect.right - width, viewport.innerWidth - width - 8))}px`;
  menu.style.top = `${openBelow ? rect.bottom + 4 : Math.max(8, rect.top - height - 4)}px`;
  trigger.setAttribute('aria-expanded', 'true');
}

function renderExportMenu(task) {
  const request = exportRequest;
  const menu = exportMenu(request);
  if (!menu) return;
  const units = selectedExportUnits(task);
  if (!units.length) { actions.agdCancelExport(); return UI.toast('请先勾选需要导出的明细'); }
  const choice = (value, title) => `<label class="agd-export-choice${request.kind === value ? ' selected' : ''}">
    <input type="radio" name="agd-export-kind" value="${value}" ${request.kind === value ? 'checked' : ''} onchange="App.agdExportKind('${value}')" />
    <span><b>${title}</b></span></label>`;
  const body = `<div class="agd-export-form" data-export-task="${UI.esc(task.id)}">
    <div class="field"><label>导出内容</label><div class="agd-export-choices">
      ${choice('detail', '明细详情')}
      ${choice('package', units.every(unit => unit.resultArtifactKind === 'review-package') ? '脱敏复核包' : '任务包')}
    </div></div>
    ${request.kind ? `<div class="field" data-export-range><label>导出范围</label><p>${request.unitId ? `当前明细 · ${UI.esc(units[0].sceneTaskId)}` : `已勾选的 ${units.length} 条明细`}</p></div>
      <div class="field" data-export-format><label>导出格式</label>${request.kind === 'detail'
        ? `<div class="agd-export-formats"><label><input type="radio" name="agd-fmt" value="pdf" checked /> PDF</label><label><input type="radio" name="agd-fmt" value="md" /> Markdown</label></div>`
        : '<p>ZIP</p>'}</div>` : ''}
  </div>`;
  menu.innerHTML = `${body}<div class="agd-export-foot">${UI.btn('确认导出', { kind: 'primary', disabled: !request.kind, onclick: 'App.agdConfirmExport()' })}</div>`;
  menu.hidden = false;
  positionExportMenu(menu);
}

function exportSelected(task, units, kind, format) {
  if (kind === 'package') return downloadZip(`${task.name}-${units.every(unit => unit.resultArtifactKind === 'review-package') ? '脱敏复核包' : '任务包'}${units.length === 1 ? `-${units[0].sceneTaskId}` : ''}.zip`, zipFiles(units));
  emit(`${task.name}-攻防明细${units.length === 1 ? `-${units[0].sceneTaskId}` : ''}`, `# ${task.name}\n\n${unitsMd(task, units)}`, format);
}

export const actions = {
  agrpSearch(v) { view.q = v; UI.resetPage('ag-reports'); router.nav('agent', 'ag-reports'); },
  agrpTarget(v) { view.targetId = v; UI.resetPage('ag-reports'); router.nav('agent', 'ag-reports'); },
  agrpSort() { view.sortDesc = !view.sortDesc; router.nav('agent', 'ag-reports'); },
  openAgReport(taskId) { const t=store.getAgentTask(taskId); detail.tab = 'analysis'; router.nav('agent',t?.status==='done'?'ag-report-detail':'ag-task-detail',taskId); },
  agrpTab(tab) { detail.tab = tab; redraw(); },
  agdFilter(k, v) { detail[k] = v; UI.resetPage(`ag-units-${router.state().param}`); redraw(); },
  agdPick(taskId, id, on) { const t = store.getAgentTask(taskId); if (!t?.units.some(unit => unit.id === id)) return; const s = pickedOf(taskId); if (on) s.add(id); else s.delete(id); redraw(); },
  agdPickPage(taskId, on) {
    const t = store.getAgentTask(taskId);
    const pg = UI.paginate(`ag-units-${taskId}`, filteredUnits(t));
    const s = pickedOf(taskId);
    pg.slice.forEach((u) => (on ? s.add(u.id) : s.delete(u.id)));
    redraw();
  },
  agdPickAll(taskId) { const s = pickedOf(taskId); filteredUnits(store.getAgentTask(taskId)).forEach((u) => s.add(u.id)); redraw(); },
  agdPickClear(taskId) { pickedOf(taskId).clear(); redraw(); },
  agrpUnit(taskId, unitId) {
    const t = completedTask(taskId);
    if (!t) return;
    const u = store.getAgentUnit(taskId, unitId);
    if (!t || !u) return;
    UI.drawer('攻防明细详情', unitDrawer(t, u), `
      ${exportControl(taskId, unitId)}
      ${UI.btn('关闭', { onclick: 'UI.closeDrawer()' })}`);
  },
  agdOpenExport(taskId, unitId = null, event = null) {
    event?.stopPropagation();
    const t = completedTask(taskId);
    if (!t) return;
    const menu = exportMenu({ taskId, unitId });
    const wasOpen = menu && !menu.hidden;
    UI.closeMenus(); closePops();
    if (wasOpen) { exportRequest = null; return; }
    exportRequest = { taskId, unitId, kind: null };
    if (!selectedExportUnits(t).length) { exportRequest = null; return UI.toast('请先勾选需要导出的明细'); }
    renderExportMenu(t);
    menu?.querySelector('input')?.focus({ preventScroll: true });
  },
  agdExportKind(kind) {
    if (!exportRequest || exportMenu()?.hidden !== false || !['detail', 'package'].includes(kind)) return;
    const t = completedTask(exportRequest.taskId);
    if (!t) return;
    exportRequest.kind = kind;
    renderExportMenu(t);
    exportMenu()?.querySelector(`input[value="${kind}"]`)?.focus({ preventScroll: true });
  },
  agdCancelExport() { const trigger = exportMenu()?.previousElementSibling; exportRequest = null; UI.closeMenus(); trigger?.focus({ preventScroll: true }); },
  agdConfirmExport() {
    const request = exportRequest;
    const menu = exportMenu(request);
    if (!request || !menu || menu.hidden || menu.querySelector('[data-export-task]')?.dataset.exportTask !== request.taskId || !['detail', 'package'].includes(request.kind)) return;
    const t = completedTask(request.taskId);
    const units = t ? selectedExportUnits(t, request) : [];
    if (!units.length) { actions.agdCancelExport(); return UI.toast('请先勾选需要导出的明细'); }
    const format = request.kind === 'package' ? 'zip' : menu.querySelector('input[name="agd-fmt"]:checked')?.value;
    if (request.kind === 'detail' && !['pdf', 'md'].includes(format)) return;
    exportRequest = null;
    UI.closeMenus();
    return exportSelected(t, units, request.kind, format);
  },
  // Old action names reopen the same chooser; they never export an unselected list.
  agdExport: taskId => actions.agdOpenExport(taskId),
  agdExportZip: taskId => actions.agdOpenExport(taskId),
  agdExportUnit: (taskId, unitId) => actions.agdOpenExport(taskId, unitId),
  agdExportUnitZip: (taskId, unitId) => actions.agdOpenExport(taskId, unitId),
  agrpExport(taskId) {
    const t = completedTask(taskId);
    if (!t) return;
    const a = document.getElementById('agex-analysis')?.checked;
    const d = document.getElementById('agex-detail')?.checked;
    if (!a && !d) return UI.toast('请至少选择一项导出内容');
    const parts = [];
    if (a) parts.push(analysisMd(t));
    if (d) parts.push((a ? '' : `# ${t.name}\n\n`) + unitsMd(t, t.units));
    closePops();
    const html = a ? `<div class="rr-report"><h1>${UI.esc(t.name)}</h1>
      ${UI.card('基础信息', UI.kvTable(agentBaseRows(t)))}${UI.card('详细配置', UI.kvTable(agentConfigRows(t)))}
      ${analysisHTML(t, { expandDetails: true })}${d ? mdToHtml(unitsMd(t, t.units)) : ''}</div>` : undefined;
    emit(`${t.name}-${a && d ? '演练报告' : a ? '结果分析' : '攻防明细'}`, parts.join('\n\n'), fmtOf('agex-fmt'), html);
  },
};
