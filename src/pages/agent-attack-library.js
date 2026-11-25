import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import {
  listAgentAttackTemplates, getAgentAttackTemplate, saveAgentAttackTemplate,
  copyAgentAttackTemplate, deleteAgentAttackTemplate, agentAttackTemplateDeleteError,
} from '../domain/agent-attack-library.js';

const e = UI.esc;
const call = (name, ...args) => e(`App.${name}(${args.map(value => JSON.stringify(value)).join(',')})`);
const view = { query: '', status: 'all' };
let editing = null;
const refresh = () => router.nav('strategy', 'ag-methods', null, { replace: true });
const badge = row => UI.badge(row.status === 'published' ? '已发布' : '草稿', row.status === 'published' ? 'green' : 'gray');
const validationNote = '发布仅校验名称、提示词必填项及长度，不代表攻击有效。效果需结合攻击模型、环境、靶标及注入面在演练中验证；当前 Demo 不运行真实攻击者。';
const publishError = row => row.status !== 'draft' ? '已发布' : !row.name?.trim() ? '请填写攻击者名称' : !row.prompt?.trim() ? '请填写攻击提示词后发布' : '';

export function agentMethodsPage() {
  const query = view.query.trim().toLowerCase();
  const rows = listAgentAttackTemplates().reverse().sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)).filter(row => (view.status === 'all' || row.status === view.status)
    && (!query || [row.name, row.desc].join(' ').toLowerCase().includes(query)));
  const filters = UI.filters({
    search: { label: '搜索', id: 'aat-search', value: view.query, placeholder: '攻击者名称、说明', oninput: "App.aatFilter('query',this.value)" },
    selects: [{ label: '状态', id: 'aat-status', value: view.status, options: [['all', '全部状态'], ['draft', '草稿'], ['published', '已发布']], onchange: "App.aatFilter('status',this.value)" }],
    right: UI.btn('新建攻击者', { kind: 'primary', ico: 'plus', onclick: 'App.newAgentAttacker()' }),
  });
  return UI.pageHead('攻击者') + `<section class="aat-library">${filters}${UI.card('', UI.pagedTable('agent-attackers', [
    { title: '攻击者名称', render: row => UI.linkBtn(row.name, { onclick: call(row.status === 'draft' ? 'editAgentAttacker' : 'openAgMethod', row.id) }) },
    { title: '来源', width: '90px', render: row => row.source === 'system' ? '系统' : '自建' },
    { title: '状态', width: '90px', render: badge },
    { title: '更新时间', width: '160px', render: row => e(new Date(row.updatedAt).toLocaleString('zh-CN', { hour12: false })) },
    { title: '操作', width: '310px', cls: 'actions', render: row => `<div class="row-actions aat-actions">
      ${UI.linkBtn('发布', { onclick: call('aatPublish', row.id), disabled: Boolean(publishError(row)), title: publishError(row) })}
      ${UI.linkBtn('详情', { onclick: call('openAgMethod', row.id) })}
      ${UI.linkBtn('编辑', { onclick: call('editAgentAttacker', row.id), disabled: row.source === 'system' || row.status !== 'draft', title: row.status !== 'draft' ? '已发布配置只读' : '' })}
      ${UI.linkBtn('复制', { onclick: call('aatCopy', row.id) })}
      ${UI.linkBtn('删除', { danger: true, onclick: call('aatDelete', row.id), disabled: Boolean(agentAttackTemplateDeleteError(row.id)), title: agentAttackTemplateDeleteError(row.id) })}
    </div>` },
  ], rows, '暂无匹配的攻击者'), '', true)}</section>`;
}
function openEditor(row) {
  editing = row ? { id: row.id, name: row.name, desc: row.desc, prompt: row.prompt } : { name: '', desc: '', prompt: '' };
  drawEditor();
}
function drawEditor(error = '') {
  UI.drawer(editing.id ? '编辑攻击者' : '新建攻击者', `<form class="aat-editor" onsubmit="return false">
    <label class="field" for="aat-name"><span>攻击者名称 *</span><input id="aat-name" maxlength="100" value="${e(editing.name)}" placeholder="请输入攻击者名称" oninput="App.aatField('name',this.value)"></label>
    <label class="field" for="aat-desc"><span>说明</span><textarea id="aat-desc" rows="3" maxlength="2000" placeholder="描述攻击者的用途" oninput="App.aatField('desc',this.value)">${e(editing.desc)}</textarea></label>
    <div class="field"><div class="aat-prompt-heading"><label for="aat-prompt">攻击提示词 *</label>${UI.linkBtn('填入模板', { onclick: 'App.aatTemplate()' })}</div><textarea id="aat-prompt" class="aat-prompt" rows="17" maxlength="100000" placeholder="填写攻击者使用的提示词" oninput="App.aatField('prompt',this.value)">${e(editing.prompt)}</textarea></div>
    <p class="aat-validation-note">${e(validationNote)}</p>
    ${error ? `<p class="ai-error" role="alert">${e(error)}</p>` : ''}
  </form>`, UI.btn('取消', { onclick: 'UI.closeDrawer()' }) + UI.btn('保存草稿', { onclick: 'App.aatSave(false)' }) + UI.btn('发布', { kind: 'primary', onclick: 'App.aatSave(true)' }));
  document.querySelector('#drawer .drawer')?.classList.add('aat-drawer');
}
export const actions = {
  aatPublish(id,confirmed=false) { const row=getAgentAttackTemplate(id);if(!row)return UI.toast('攻击者不存在');const error=publishError(row);if(error)return UI.toast(error);if(!confirmed)return UI.confirmPublication({kind:'攻击者',name:row.name,message:validationNote+' 发布后不可编辑，需要修改时请复制。',onConfirm:()=>actions.aatPublish(id,true)});try{saveAgentAttackTemplate(row,{publish:true});refresh();UI.toast('攻击者已发布');}catch(error){UI.toast(error.message);} },
  aatFilter(key, value) { if (!['query', 'status'].includes(key)) return; view[key] = value; UI.resetPage('agent-attackers'); refresh(); },
  newAgentAttacker() { openEditor(); },
  editAgentAttacker(id) {
    const row = getAgentAttackTemplate(id);
    if (!row) return UI.toast('攻击者不存在');
    if (row.source === 'system' || row.status !== 'draft') return UI.toast('已发布配置只读，请复制后编辑');
    openEditor(row);
  },
  openAgMethod(id) {
    const row = getAgentAttackTemplate(id); if (!row) return UI.toast('攻击者不存在');
    editing = null;
    UI.drawer(row.name, `<div class="aat-detail"><div class="aat-meta"><span>${row.source === 'system' ? '系统' : '自建'}</span>${badge(row)}</div>
      <div><h3>说明</h3><p>${e(row.desc || '—')}</p></div><label class="field" for="aat-detail-prompt"><span>攻击提示词</span><textarea id="aat-detail-prompt" class="aat-prompt" rows="20" readonly>${e(row.prompt)}</textarea></label></div>`,
    UI.btn('复制', { onclick: call('aatCopy', row.id) }) + UI.btn('关闭', { onclick: 'UI.closeDrawer()' }));
    document.querySelector('#drawer .drawer')?.classList.add('aat-drawer');
  },
  aatField(key, value) { if (editing && ['name', 'desc', 'prompt'].includes(key)) editing[key] = value; },
  aatTemplate() { if (!editing) return; editing.prompt = getAgentAttackTemplate('universal').prompt; drawEditor(); },
  aatSave(publish = false,confirmed=false) {
    if (!editing) return;
    if(publish&&!confirmed){const error=publishError({...editing,status:'draft'});if(error)return drawEditor(error);return UI.confirmPublication({kind:'攻击者',name:editing.name,message:validationNote+' 发布后不可编辑，需要修改时请复制。',onConfirm:()=>actions.aatSave(true,true)});}
    try {
      const saved = saveAgentAttackTemplate(editing, { publish });
      editing = null; UI.closeDrawer(); view.query = ''; view.status = 'all'; UI.resetPage('agent-attackers'); refresh();
      UI.toast(publish ? '攻击者已发布' : '攻击者草稿已保存'); return saved.id;
    } catch (error) { drawEditor(error.message); }
  },
  aatCopy(id) {
    try { const copied = copyAgentAttackTemplate(id); editing=null; UI.closeDrawer(); view.query = ''; view.status = 'all'; UI.resetPage('agent-attackers'); refresh(); UI.toast('配置已复制为独立草稿'); return copied.id; }
    catch (error) { UI.toast(error.message); }
  },
  aatDelete(id) {
    const error = agentAttackTemplateDeleteError(id); if (error) return UI.toast(error);
    const row = getAgentAttackTemplate(id);
    UI.modal('删除攻击者', `<p>确定删除「${e(row.name)}」？</p>`, UI.btn('取消', { onclick: 'UI.closeModal()' }) + UI.btn('删除', { kind: 'danger', onclick: call('aatDeleteConfirm', id) }));
  },
  aatDeleteConfirm(id) {
    try { deleteAgentAttackTemplate(id); UI.closeModal(); UI.closeDrawer(); refresh(); UI.toast('攻击者已删除'); }
    catch (error) { UI.toast(error.message); }
  },
};
