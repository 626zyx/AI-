import * as UI from '../core/ui.js';
import { listAgentAttackTemplates, getAgentAttackTemplate, AGENT_ATTACK_PROMPT_SECTIONS } from '../domain/agent-attack-library.js';
import { SURFACE_GROUPS, SURFACE_TYPES, ATTACK_SURFACE_CATALOG } from '../domain/attack-surfaces.js';
import { detailBlock, detailContent, openConfigDetail } from '../core/config-detail.js';
const e = UI.esc;
function surfaceCatalog() {
  const groups = SURFACE_GROUPS.map(group => `<section class="agm-surface-group" data-surface-group="${e(group.id)}"><h4>${e(group.label)}</h4>${UI.table([
    { title: '文件类型', width: '24%', render: type => `<span data-surface-type="${e(type.id)}">${e(type.label)}</span>` },
    { title: '文件示例', render: type => type.examples.map(path => `<div class="agm-file-example">${e(path)}</div>`).join('') },
  ], SURFACE_TYPES.filter(type => type.group === group.id))}</section>`).join('');
  const workspace = ATTACK_SURFACE_CATALOG.find(type => type.kind === 'workspace');
  return `<div class="agm-surface-catalog">${groups}<section class="agm-surface-group" data-workspace-surface><h4>工作区材料 · workspace</h4>${UI.table([
    { title: '文件类型', width: '24%', render: () => '业务文档、代码与数据' },
    { title: '文件示例', render: () => workspace.examples.map(path => `<div class="agm-file-example">${e(path)}</div>`).join('') },
  ], [workspace])}</section><p class="agm-surface-note">实际范围以环境与靶标配置为准；workspace 仅在该运行明确开放时生效。</p></div>`;
}
function promptContent() {
  return `<div class="agm-prompt"><p class="agm-prompt-source">通用攻击提示词 · 中文整理</p>${AGENT_ATTACK_PROMPT_SECTIONS.map(section => `<section class="agm-prompt-section"><h4>${e(section.title)}</h4><ul>${section.items.map(item => `<li>${e(item)}</li>`).join('')}</ul></section>`).join('')}<p class="agm-surface-note">运行时补入环境正文、允许路径、靶标工具与反馈；目录占位符包括 <code>{{target_instruction_file}}</code>、<code>{{input_workspace_dir}}</code>、<code>{{output_target_control_dir}}</code>、<code>{{attack_iteration}}</code>。</p></div>`;
}
export function agentMethodsPage() {
  return UI.pageHead('攻击库') + UI.card('', UI.table([
    { title: '模板名称', render: row => `<button class="link-btn" onclick="App.openAgMethod('${row.id}')">${e(row.name)}</button>` },
    { title: '来源', width: '90px', render: () => UI.badge('系统', 'blue') },
    { title: '覆盖攻击面', render: () => UI.tagList([...SURFACE_GROUPS.map(group => group.label), '工作区材料']) },
    { title: '更新时间', width: '130px', render: row => e(row.updatedAt) },
    { title: '操作', width: '100px', cls: 'actions', render: row => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openAgMethod('${row.id}')` })}</div>` },
  ], listAgentAttackTemplates()), '', true);
}
export const actions = {
  openAgMethod(id) {
    const row = getAgentAttackTemplate(id); if (!row) return;
    openConfigDetail(row.name, detailContent(
      detailBlock('描述', `<p class="agm-description">${e(row.desc)}</p>`)
      + detailBlock('覆盖攻击面', surfaceCatalog())
      + detailBlock('攻击提示词', promptContent()),
    ));
  },
};
