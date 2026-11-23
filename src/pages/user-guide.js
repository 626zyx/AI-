/* The in-app guide and downloaded document share one content source. */
import * as UI from '../core/ui.js';
import { mdToHtml } from '../core/export.js';
import { openConfigDetail } from '../core/config-detail.js';

const INTRO = '连接企业资产平台，准备业务策略，完成演练，并在靶标状态中持续跟踪评估与版本变化。';
export const GUIDE_SECTIONS = [
  { id: 'overview', title: '导航与开始使用', markdown: `| 入口 | 用途 |
|---|---|
| 首页 | 查看企业平台连接与当前靶标，按时间查看报告和消息概况 |
| 靶标状态 | 查看企业靶标、平台连接、评估结果和版本对比 |
| 模型演练 | 创建模型任务、查看过程与报告 |
| 智能体演练 | 创建智能体任务、分析任务完成与抵御表现 |
| 演练策略 | 维护业务策略、方法目录、场景题库及防护方法 |
| 设置 | 接入功能模型、配置数据等级规则 |

首次使用依次完成：连接企业平台 → 同步资产 → 配置功能模型 → 发布演练策略 → 创建并发起任务。

首页顶部可选近3天、近7天、近1个月。五项概况依次为同步资产、当前版本评估覆盖、进行中任务、待演练/待复测、已生成报告，仅展示数据。当前库存与状态不随时间范围变化，本期完成、异常、报告和消息按时间筛选。

左侧将企业平台连接与已同步靶标列表合并展示：连接信息下方列出靶标名称、企业版本、上线状态和企业更新时间；有多个平台时可切换连接，列表始终展示所选平台的当前库存。右侧上方为靶标评估结果及消息，下方通过“策略与规则”中的“演练资源”等分类入口查看配置。` },
  { id: 'assets', title: '连接平台与同步资产', markdown: `1. 在首页或靶标状态中点击“连接资产平台”，填写平台名称、API 地址和鉴权信息，测试连接。
2. 映射企业资产 ID、名称、类型、状态、版本、地址及更新时间，预览识别结果。
3. 选择同步范围，设置同步频率和变更提醒，核对新增、更新及异常项后导入。
4. 后续可手动同步、查看批次和变更记录；字段不完整时修正连接配置后重试。

资产的企业状态与平台状态分别展示。企业负责上线、停用和版本；平台负责连通检查、演练进度及评估。关键版本或调用配置变化后显示“待复测”，旧报告仍可查阅。同步失败不会把企业资产自动标为停用。

靶标状态顶部集成企业平台连接信息和同步、配置、记录入口，下方列表支持筛选、批量检查连通及结果对比。开始演练从单个靶标行或详情进入；行内“更多”保留详情与重新检查。资产详情的“评估结果”中可按业务策略查看结果和发起对比；跨版本对比先核对题库、裁判、方法和防护条件，条件不同会显示差异提示。` },
  { id: 'models', title: '功能模型与数据等级', markdown: `功能模型位于设置中，用于攻击生成、裁判、场景生成及防护审核。它们不属于企业同步靶标。

单条接入：填写名称、协议、服务地址、模型标识和凭据 → 保存并测试 → 配置用途。批量接入可新增行、粘贴或导入模板，逐行校验与测试，只重试失败项。

数据等级规则将指标区间映射为安全、低危、中危、高危、致命。选择对象类型、指标和适用范围，配置区间与最低样本量，预览影响后启用。缺少有效判定或样本不足不自动判为安全。等级变化可同步到靶标状态和消息。` },
  { id: 'resources', title: '题库、方法与策略', markdown: `演练方法来源统一为“系统”，只支持查看类别、依赖模型与适用能力，不提供自建与版本。

模型场景题库通过导入创建。智能体场景题库支持导入和生成，两者都进入编辑器。左侧选择题目序号，查看当前题目的内容与文件，完成校验后保存草稿、发布版本。可以继续追加题目；自建题库已发布的版本保留，修改时创建新版本。系统题库无版本，显示“—”。

业务策略组合题库、方法参数、攻击生成等功能模型和判定标准；裁判模型在新建任务时选择。模型策略可选择防护方法，核对输入/输出审核位置与维度。保存草稿后发布；策略升级时创建下一版本，旧任务保留其引用版本。

防护方法由系统维护，仅支持查看；在模型演练策略中选择方法，并配置输入、输出审核位置。` },
  { id: 'tasks', title: '创建与执行演练', markdown: `1. 在模型演练或智能体演练中点击新建，填写任务名称并选择企业靶标。
2. 选择已发布的演练策略，核对题库版本、方法、功能模型和防护配置。
3. 配置裁判、并发和执行限制，检查适用能力后保存或发起。

任务支持草稿、待开始、进行中、已完成、已终止和异常状态。草稿可继续配置；进行中可查看进度、记录和日志，也可终止。复制任务只复制配置，并创建新草稿。

任务详情顶部保留任务信息和一条紧凑指标带。模型显示 ASR、成功执行率、总/平均耗时、总/平均 Token，以及方法和场景 TOP 1。智能体显示相同执行基础数据，以及攻破率、任务完成率、注入响应率、任务失误率。

选择单元可查看题目、响应和裁判结果。智能体的任务要求与实际执行记录分开展示；未知结果保持未评估。` },
  { id: 'reports', title: '阅读报告与结果口径', markdown: `已完成任务可打开报告并导出 PDF 或 Markdown。模型报告包含核心发现、方法、场景与防护表现；智能体报告以任务完成情况、抵御情况为主，包含整体结论、重点案例、图表及共性失误分析。

| 指标 | 含义 |
|---|---|
| 攻破率 ASR | 攻破数 ÷ 有效安全判定数 |
| 成功执行率 | 成功结束的单元数 ÷ 已结束执行的单元数 |
| 任务完成率 | 满足全部业务验收条件的题数 ÷ 有效完成判定题数 |
| 注入响应率 | 对已触达注入作出可观察反应的题数 ÷ 可判定响应题数 |
| 任务失误率 | 出现至少一项已定义失误的题数 ÷ 已完成失误检查题数 |

拒绝、隔离、部分采纳和采纳都属于注入响应，响应率高不直接代表更容易被攻破。业务完成和安全分别判断，因此可出现安全完成、不安全完成、安全未完成和不安全未完成。

报告与任务共用指标口径。智能体报告可切换“结果分析 / 攻防明细”：分析保留总体结论与重点案例，明细列出全部题目，可查看完成、抵御、疑似响应、失误、裁判结论及交付产物。导出时可选择分析、明细或两者。

评估结果同步到靶标状态；启用防护的链路结果与资产本体结果分别识别。` },
  { id: 'notices', title: '消息与持续评估', markdown: `首页和右上角消息入口展示同一份提醒：资产变化、同步异常、任务完成、报告生成和等级变化。点击消息进入对应资产、连接或任务，可按类型筛选、标记已读。

建议从待复测资产开始，使用相同业务策略评估当前企业版本，查看报告后在靶标状态中对比历史结果。` },
];

export function guideMarkdown() {
  const contents = GUIDE_SECTIONS.map((section, index) => `${index + 1}. ${section.title}`).join('\n');
  return `# AI Range 使用指南\n\n${INTRO}\n\n## 目录\n\n${contents}\n\n${GUIDE_SECTIONS.map((section, index) => `## ${index + 1}. ${section.title}\n\n${section.markdown}`).join('\n\n')}\n`;
}

function guideBody() {
  return `<article class="user-guide" aria-label="AI Range 使用指南文档">
    <header id="guide-contents" class="guide-document-head" tabindex="-1"><span class="guide-eyebrow">AI RANGE · USER GUIDE</span><h1>平台使用指南</h1><p>${UI.esc(INTRO)}</p></header>
    <nav class="guide-toc" aria-label="使用指南目录"><h2>目录</h2><ol>${GUIDE_SECTIONS.map((section, index) => `<li><button onclick="App.guideSection('${section.id}')"><span>${String(index + 1).padStart(2,'0')}</span>${UI.esc(section.title)}</button></li>`).join('')}</ol></nav>
    ${GUIDE_SECTIONS.map((section, index) => `<section class="guide-section" id="guide-${section.id}" tabindex="-1"><h2><span>${String(index + 1).padStart(2,'0')}</span>${UI.esc(section.title)}</h2>${mdToHtml(section.markdown)}<button class="guide-to-contents" onclick="App.guideSection('contents')">返回目录 ↑</button></section>`).join('')}
  </article>`;
}

export const actions = {
  openUserGuide() {
    const panel = openConfigDetail('使用指南', guideBody(), `${UI.btn('下载文档', { ico:'download', onclick:'App.downloadUserGuide()' })}${UI.btn('关闭', { onclick:'UI.closeDrawer()' })}`);
    panel.classList.add('guide-drawer');
  },
  guideSection(id) {
    if (id !== 'contents' && !GUIDE_SECTIONS.some(section => section.id === id)) return;
    const target = document.getElementById(`guide-${id}`);
    if (!target) return;
    target.scrollIntoView({ block:'start', behavior:'auto' });
    target.focus({ preventScroll:true });
  },
  downloadUserGuide() { UI.download('AI Range 使用指南.md', guideMarkdown()); },
};
