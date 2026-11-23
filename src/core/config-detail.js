/* Shared detail layout used by task configuration and strategy-center drawers. */
import * as UI from './ui.js';

export const detailValue = value => UI.esc(value === undefined || value === null || value === '' ? '—' : value);
export const detailFields = pairs => `<dl class="tc-fields">${pairs.map(([label, value]) => `<div><dt>${UI.esc(label)}</dt><dd>${detailValue(value)}</dd></div>`).join('')}</dl>`;
export const detailBlock = (title, body) => `<section class="tc-detail-block"><h3>${UI.esc(title)}</h3>${body}</section>`;
export const detailContent = body => `<div class="tc-drawer-content">${body}</div>`;
export const detailTableField = (title, body) => `<dl class="tc-fields tc-methods"><div><dt>${UI.esc(title)}</dt><dd>${body}</dd></div></dl>`;
export const auxiliaryRole = role => /^(?:过程|最终)?裁判(?:模型)?$/.test(role || '') ? '裁判模型' : role === '攻击者模型' ? '攻击生成模型' : role || '攻击生成模型';

export function methodConfigurationTable(methods) {
  return UI.table([
    { title: '名称', render: m => detailValue(m.name) },
    { title: '参数', render: m => m.params.length ? m.params.map(([key, value]) => `<div>${detailValue(key)}：${detailValue(value)}</div>`).join('') : '无' },
    { title: '辅助模型', render: m => m.auxiliary.length ? m.auxiliary.map(model => `${detailValue(auxiliaryRole(model.role))}：${detailValue(model.name)}`).join('、') : '无需' },
  ], methods.map(m => {
    const params = m.params || [];
    const auxiliary = [...new Map([...params.filter(([name]) => name.includes('模型')).map(([role, name]) => ({ role, name })), ...(m.auxiliary || m.auxiliaryModels || [])].map(model => [auxiliaryRole(model.role), model])).values()];
    return { ...m, params: params.filter(([name]) => !name.includes('模型')),
      auxiliary };
  }));
}

export function parameterTable(params, valueTitle = '默认值') {
  return UI.table([
    { title: '参数', render: row => detailValue(auxiliaryRole(row[0])) },
    { title: valueTitle, render: row => detailValue(row[1] === true ? '开启' : row[1] === false ? '关闭' : row[1]) },
  ], params, '无可配置参数');
}

export function openConfigDetail(title, body, footer = UI.btn('关闭', { onclick: 'UI.closeDrawer()' })) {
  UI.drawer(title, body, footer);
  const panel = document.querySelector('#drawer .drawer');
  panel.classList.add('tc-config-drawer');
  panel.setAttribute('aria-label', title);
  return panel;
}
