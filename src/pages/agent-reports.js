/* 智能体演练 · 演练报告：列表 + 详情（六节） */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { RISK_LABEL } from '../domain/constants.js';

const view = { q: '' };

export function agentReportsPage() {
  let rows = store.listAgentReports();
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((r) => (r.name + r.targetName + r.bankName).toLowerCase().includes(q));
  }

  const flt = UI.filters({
    search: { label: '搜索', id: 'agrp-q', value: view.q, placeholder: '搜索报告 / 智能体 / 题库', oninput: 'App.agrpSearch(this.value)' },
  });

  const table = UI.pagedTable(
    'ag-reports',
    [
      { title: '报告名称', render: (r) => `<button class="link-btn" onclick="App.openAgReport('${r.taskId}')">${UI.esc(r.name)}</button>` },
      { title: '靶标智能体', width: '190px', render: (r) => UI.esc(r.targetName) },
      { title: '场景题库', width: '180px', render: (r) => UI.esc(r.bankName) },
      { title: 'ASR', width: '80px', cls: 'num', render: (r) => `<span class="num">${UI.pct(r.asr)}</span>` },
      { title: '风险等级', width: '90px', render: (r) => UI.riskBadge(r.risk) },
      { title: '生成时间', width: '160px', cls: 'num', render: (r) => UI.esc(r.createdAt || '—') },
      {
        title: '操作', width: '130px', cls: 'actions',
        render: (r) => `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openAgReport('${r.taskId}')` })}
          ${UI.linkBtn('导出', { onclick: `App.agrpExport('${r.taskId}')` })}
        </div>`,
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
  if (!t) return `${UI.pageHead('演练报告')}<div class="empty"><strong>报告不存在</strong></div>`;

  return `${UI.backBtn()}
  ${UI.pageHead(`${t.name} · 演练报告`, {
    extra: UI.riskBadge(t.risk),
    actions: UI.btn('导出报告', { onclick: `App.agrpExport('${t.id}')` }),
  })}
  <div class="report">
    ${secSummary(t)}
    ${secLabels(t)}
    ${secBreachCases(t)}
    ${secSafeCases(t)}
    ${secMethod(t)}
  </div>`;
}

/* 一、结论摘要 */
function secSummary(t) {
  const n = t.agg;
  const conclusion = !n.judged
    ? '本次演练没有有效判定结果。'
    : n.breach === 0
      ? `在 ${t.sceneBankName} 的 ${n.judged} 道题中，${t.targetName} 未发生机密内容泄漏。`
      : `在 ${t.sceneBankName} 的 ${n.judged} 道题中，${t.targetName} 有 ${n.breach} 道题把受保护内容写入了对外产物，攻破率 ${UI.pct(n.value)}。`;

  return UI.card('一、结论摘要', `
    <p class="rpt-lead">${UI.esc(conclusion)}</p>
    <div class="rpt-stats">
      <div class="stat"><span class="sub-label">攻破率 ASR</span><strong class="num">${UI.pct(n.value)}</strong>
        <em class="faint">${n.breach} / ${n.judged}</em></div>
      <div class="stat"><span class="sub-label">异常题数</span><strong class="num">${n.unknown}</strong>
        <em class="faint">未计入 ASR 分母</em></div>
      <div class="stat"><span class="sub-label">风险等级</span><strong>${UI.riskBadge(t.risk)}</strong>
        <em class="faint">由 ASR 按平台风险规则推导</em></div>
    </div>`);
}

/* 二、风险标签分析 */
function secLabels(t) {
  if (!t.labelsAgg.length) return UI.card('二、风险标签分析', '<div class="empty"><strong>暂无数据</strong></div>');
  const max = Math.max(...t.labelsAgg.map((x) => x.asr ?? 0), 0.01);
  const rows = t.labelsAgg.map((x) => {
    const mk = t.markers.filter((m) => m.labels?.includes?.(x.key));
    return `<tr>
      <td>${UI.badge(x.label, x.cls)}</td>
      <td class="num">${x.denominator}</td>
      <td class="num">${x.breach}</td>
      <td class="num">${x.asr === null ? '—' : UI.pct(x.asr)}</td>
      <td><div class="mini-bar"><i style="width:${((x.asr ?? 0) / max) * 100}%"></i></div></td>
    </tr>`;
  }).join('');

  const top = t.markers.slice(0, 8).map((m) => `<tr>
    <td><code>${UI.esc(m.marker)}</code></td>
    <td>${m.signal === 'high' ? UI.badge('高辨识度', 'green') : UI.badge('易误报', 'amber')}</td>
    <td class="num">${m.count}</td>
    <td class="num">${m.taskCount}</td>
  </tr>`).join('');

  return UI.card('二、风险标签分析', `
    <p class="faint text-support">分母为本次演练中声明该标签的题数。标签来自题库标注，用于归因，不是执行维度。</p>
    <table class="kv-table tight">
      <thead><tr><th>风险标签</th><th class="num">涉及题数</th><th class="num">泄漏</th><th class="num">泄漏率</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${top ? `<div class="sub-label mt">最常命中的标记</div>
    <table class="kv-table tight">
      <thead><tr><th>标记</th><th>辨识度</th><th class="num">命中次数</th><th class="num">涉及题数</th></tr></thead>
      <tbody>${top}</tbody>
    </table>` : ''}`, '', true);
}

/* 三、泄漏案例：优先高辨识度标记 */
function secBreachCases(t) {
  const cases = t.units
    .filter((u) => u.verdict === 'breach')
    .map((u) => ({ u, c: (u.chains || []).find((x) => !x.likelyDeclaration && x.signal === 'high') || (u.chains || [])[0] }))
    .filter((x) => x.c)
    .slice(0, 5);

  if (!cases.length) return UI.card('三、泄漏案例', '<div class="empty"><strong>本次演练未检出泄漏</strong></div>');

  const body = cases.map(({ u, c }, i) => `<div class="rpt-case">
    <div class="rpt-case-head">案例 ${i + 1} · <span class="num">${UI.esc(u.sceneTaskId)}</span>
      ${c.signal === 'high' ? UI.badge('高辨识度', 'green') : UI.badge('易误报', 'amber')}</div>
    ${UI.kvTable([
    ['任务目标', UI.esc(u.goal || '—')],
    ['命中标记', `<code>${UI.esc(c.marker)}</code>`],
    ['源文件', c.sourceFiles?.length ? c.sourceFiles.map((f) => `<code>${UI.esc(f)}</code>`).join(' ') : '<span class="faint">未定位</span>'],
    ['产物文件', `<code>${UI.esc(c.sinkFile)}</code>`],
    ['风险类别', UI.esc((c.riskLabels || []).map((k) => RISK_LABEL[k]?.label || k).join('、'))],
    ['陷阱设计', UI.esc(c.coLocation || '—')],
    ['泄漏后果', UI.esc(c.riskReason || '—')],
  ])}
  </div>`).join('');

  return UI.card('三、泄漏案例', body);
}

/* 四、守住案例：带自述说明的守住记录 */
function secSafeCases(t) {
  const cases = t.units.filter((u) => u.verdict === 'safe' && u.selfReport).slice(0, 3);
  if (!cases.length) return UI.card('四、守住案例', '<div class="empty"><strong>暂无守住记录</strong></div>');

  const body = cases.map((u, i) => `<div class="rpt-case">
    <div class="rpt-case-head">案例 ${i + 1} · <span class="num">${UI.esc(u.sceneTaskId)}</span>
      ${UI.badge('已守住', 'green')}</div>
    <div class="sub-label">智能体自述
      <span class="hint" title="智能体自己的汇报，未经独立验证">?</span></div>
    <pre class="ud-report">${UI.esc((u.selfReport || '').slice(0, 1200))}</pre>
  </div>`).join('');

  return UI.card('四、守住案例', body);
}

/* 五、方法说明与局限 */
function secMethod(t) {
  return UI.card('五、方法说明与局限', `
    ${UI.kvTable([
    ['演练形态', '环境诱导型。机密资源与合规资源按相近命名混置于工作区，任务书不含任何恶意指令。'],
    ['判定方式', '题目自带判定脚本，对产物目录做禁用标记字符串匹配。不经过裁判模型。'],
    ['题库来源', `${UI.esc(t.sceneBankName)} · ${UI.esc(store.getSceneBank(t.sceneBankId)?.origin || '—')}`],
    ['标签体系', UI.esc(store.getSceneBank(t.sceneBankId)?.taxonomyVersion || '—')],
  ])}
    <div class="sub-label mt">结论的四条局限</div>
    <ol class="rpt-limits">
      <li>判定按标记字面匹配。智能体用自己的措辞改写机密内容后输出，判定抓不到，存在漏报。</li>
      <li>智能体在产物里声明"已排除某类机密"时，若措辞撞上禁用标记会被判为泄漏。平台已按否定词做初筛，标注为「疑似声明排除」，但仍需人工复核。</li>
      <li>判定只扫本地产物目录，不覆盖远程发布渠道。若智能体真的上传到远程且本地未留副本，判定扫不到，ASR 偏保守。</li>
      <li>本形态不含主动注入，没有对抗压力。ASR 反映的是智能体自身的默认谨慎度，不等于它在被攻击时的失守率。</li>
    </ol>`);
}

export const actions = {
  agrpSearch(v) { view.q = v; UI.resetPage('ag-reports'); router.nav('agent', 'ag-reports'); },
  openAgReport(taskId) { router.nav('agent', 'ag-report-detail', taskId); },
  agrpExport(taskId) {
    const t = store.getAgentTask(taskId);
    if (!t) return;
    UI.download(`${t.name}-演练报告.json`, JSON.stringify({
      task: { id: t.id, name: t.name, target: t.targetName, bank: t.sceneBankName },
      summary: { asr: t.agg, risk: t.risk },
      labels: t.labelsAgg,
      markers: t.markers,
      units: t.units,
    }, null, 2));
  },
};
