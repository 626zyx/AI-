/* 策略中心 · Agent 攻击方法：平台内置方法目录，列表 + 详情抽屉。
 * 与模型演练的攻击方法页同一形态：名称 / 说明、依赖模型、操作。 */
import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';
import { SURFACE_GROUPS, SURFACE_TYPES } from '../domain/attack-surfaces.js';
import { detailFields, detailBlock, detailContent, detailTableField, parameterTable, openConfigDetail } from '../core/config-detail.js';

const fileExamples = () => SURFACE_GROUPS.map(group => SURFACE_TYPES.find(type => type.group === group.id)?.examples[0]).filter(Boolean);

function surfaceCatalogHTML() {
  const groups = SURFACE_GROUPS.map(group => `<section class="agm-surface-group" data-surface-group="${UI.esc(group.id)}"><h4>${UI.esc(group.label)}</h4><p class="agm-surface-description">${UI.esc(group.description)}</p>${UI.table([
    { title: '类型', width: '24%', render: type => `<span data-surface-type="${UI.esc(type.id)}">${UI.esc(type.label)}</span>` },
    { title: '文件示例', width: '34%', render: type => type.examples.map(path => `<div class="agm-file-example">${UI.esc(path)}</div>`).join('') },
    { title: '加载说明', render: type => `${UI.esc(type.loading)}<span class="agm-surface-detail">${UI.esc(type.description)}</span>` },
  ], SURFACE_TYPES.filter(type => type.group === group.id))}</section>`).join('');
  return `<div class="agm-surface-catalog"><p class="agm-surface-note">以下为方法能力目录。可用文件、作用范围和加载方式须由具体靶标核验，不代表每个靶标支持全部类型。</p>${groups}<p class="agm-surface-note">技能被发现不等于正文被调用；运行配置不包含平台管理的模型凭据。接入和创建演练沿用靶标已核验的注入文件。</p></div>`;
}

export function agentMethodsPage() {
  const table = UI.pagedTable('ag-methods', [
    { title: '名称 / 说明', render: m => `<button class="link-btn" onclick="App.openAgMethod('${m.id}')">${UI.esc(m.name)}</button><div class="faint text-support">${UI.esc(m.desc || '')}</div>` },
    { title: '来源', width: '90px', render: () => UI.badge('系统', 'gray') },
    { title: '类别', width: '150px', render: m => m.id === 'baseline' ? '基线验证' : '环境注入' },
    { title: '依赖模型', width: '240px', render: m => m.id === 'baseline' ? '裁判模型' : '攻击生成模型、裁判模型' },
    { title: '操作', width: '90px', cls: 'actions', render: m => UI.linkBtn('详情', { onclick: `App.openAgMethod('${m.id}')` }) },
  ], store.agentMethods.filter(m => !m.authoringId), '暂无演练方法');
  return `${UI.pageHead('演练方法')}${UI.card('', table, '', true)}`;
}

export const actions = {
  openAgMethod(id) {
    const m = store.agentMethodOf(id);
    if (!m) return;
    openConfigDetail('演练方法详情', detailContent(
      detailBlock('方法基础信息', detailFields([['方法名称', m.name], ['说明', m.desc], ['来源', '系统'], ['类别', m.id === 'baseline' ? '基线验证' : '环境注入']]))
      + detailBlock('详细配置信息', detailFields([
        ['依赖模型', m.id === 'baseline' ? '裁判模型' : '攻击生成模型、裁判模型'],
        ...(m.defaultModelId ? [['推荐模型', `攻击生成模型：${store.modelName(m.defaultModelId)}`]] : []),
      ]) + detailTableField('方法参数', parameterTable(m.params, '说明'))
      + (m.id === 'universal' ? detailTableField('攻击面分类与文件示例', surfaceCatalogHTML()) : ''))));
  },
};
