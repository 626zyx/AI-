import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as E from '../domain/agent-environments.js';
import { openResourcePicker, listPickerResources } from '../core/resource-picker.js';
import { readBundleZip, validateBundlePath } from '../domain/resource-authoring.js';
import { RISK_LABEL } from '../domain/constants.js';
import { createSandboxValidation, sandboxValidationIsCurrent } from '../domain/sandbox-validation.js';
import * as Tags from '../domain/resource-tags.js';
import { openResourceTagEditor } from './tag-management.js';
import { renderWebIde, focusIdeLine } from '../core/web-ide.js';

const state = { editor: null, search: '', batchIds: [], pending: null, imported: null, generationModel: null };
const e = UI.esc, arg = value => encodeURIComponent(value).replace(/'/g, '%27');
const value = id => document.getElementById(id)?.value || '';
const button = (label, action, primary = false) => UI.btn(label, { kind: primary ? 'primary' : '', onclick: `App.${action}` });
const field = (label, content) => `<div class="field"><label${content.match(/id="([^"]+)"/) ? ` for="${content.match(/id="([^"]+)"/)[1]}"` : ''}>${e(label)}</label>${content}</div>`;
const safe = fn => { try { return fn(); } catch (error) { UI.toast(error.message || '操作失败'); } };
const refresh = () => { const current = router.state(); router.nav(current.page, current.sub, current.param, { replace: true }); };
function registerEditorTags(id) {
  const question=E.getAgentQuestion(id);if(!question)throw new Error('环境不存在');
  Tags.registerResourceSeeds('environment',[{id:question.id,title:question.title,seeds:{business:question.business?[question.business]:[],risk:question.riskLabels.map(label=>RISK_LABEL[label]?.label||label)}}]);
  return question;
}
const tagSummary = (tags,dimension) => (tags[dimension]||[]).join('、') || '未打标签';
function session(id) { const question = E.getAgentQuestion(id); if (!question) return null; if (state.editor?.id !== id) state.editor = { ...question, path: 'task.md', dirty: false, report: null, editorView: 'edit', sandboxBusy: false, sandboxReport: question.validation?.sandbox || null }; if (!Object.hasOwn(state.editor.files, state.editor.path)) state.editor.path = Object.keys(state.editor.files)[0] || ''; return state.editor; }
function markDirty() { state.editor.dirty = true; state.editor.report = null;const status=document.querySelector('.wi-context>span:last-child');if(status)status.textContent='有未保存更改';const publish=document.querySelector('[onclick="App.aePublishConfirm()"]');if(publish)publish.disabled=true;const runState=document.querySelector('.wi-run-state');if(runState){runState.textContent='内容已修改，需重新验证';runState.className='wi-run-state stale';} }
function save(quiet = false) { const ed = state.editor; if (!ed || ed.status !== 'draft') throw new Error('已发布内容只读，请复制为草稿'); const saved = E.saveAgentQuestion(ed); Object.assign(ed, saved, { dirty: false }); if (!quiet) UI.toast('环境草稿已保存'); return saved; }
function batchRows() { return state.batchIds.map(E.getAgentQuestion).filter(Boolean); }
function questionNav() {
  const query = state.search.trim().toLowerCase();
  return batchRows().map((q, index) => ({ q, index })).filter(({ q, index }) => !query || `${index + 1} ${q.title} ${q.taskId}`.toLowerCase().includes(query)).map(({ q, index }) => `<button class="ae-question ${q.id === state.editor?.id ? 'active' : ''}" onclick="App.aeSwitch('${q.id}')" title="${e(q.title)}"><span>${index + 1}. ${e(q.title)}</span></button>`).join('') || '<p class="ra-note">无匹配环境</p>';
}
function reportMarkup(report) {
  return report.valid ? '<p>环境文件与 LLM 评估定义检查通过。</p>' : `<p>请修正以下内容后重试：</p><ul class="ae-check-errors">${report.checks.filter(check => !check.passed).map(check => `<li><strong>${e(check.name)}</strong><span>${e(check.detail)}</span></li>`).join('')}</ul>`;
}
function openBatch(ids) {
  const batch = [...new Set(ids)].filter(id => E.getAgentQuestion(id));
  if (!batch.length) throw new Error('没有可打开的环境');
  UI.closeDrawer(); UI.closeModal();
  router.nav('strategy', 'authoring', batch[0], { onCommit: () => { state.batchIds = batch; state.search = ''; } });
}
function returnToEnvironmentList(id) {
  UI.closeDrawer(); UI.closeModal(); UI.resetPage('agent-environments');
  router.nav('strategy','scenebanks',id,{onCommit:()=>{state.editor=null;state.batchIds=[];state.search='';}});
}
function downloadBytes(name, bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function environmentDrawer(title, body, footer) {
  UI.closeModal(); UI.drawer(title, body, footer);
  document.querySelector('#drawer .drawer')?.classList.add('ae-form-drawer');
}
export function agentEnvironmentEditorPage(cur) {
  const ed = session(cur.param);
  if (!ed) return UI.pageHead('环境编辑器', { back: UI.backBtn() }) + '<div class="empty"><strong>请从环境库选择环境</strong><p>导入或生成的多个环境可在这里逐个编辑。</p></div>';
  registerEditorTags(ed.id);
  const tags=Tags.getResourcesTags('environment',[ed.id])[0].names;
  const editable = ed.status === 'draft', disabled = editable && !ed.sandboxBusy ? '' : 'disabled';
  const metadata = `<div class="ae-metadata"><div class="ae-metadata-heading">${field('环境名称', `<input id="ae-title" value="${e(ed.title)}" ${disabled} oninput="App.aeMeta('title',this.value)">`)}</div><div class="ae-tag-summary">${UI.linkBtn('编辑标签',{onclick:'App.aeEditTags()'})}${Tags.listTagDimensions().map(({id:dimension,name:label})=>`<div><span class="faint">${e(label)}</span><span data-environment-tags="${dimension}">${e(tagSummary(tags,dimension))}</span></div>`).join('')}</div></div>`;
  const input={question:ed,staticReport:E.checkAgentQuestion(ed)},report=ed.sandboxReport||ed.validation?.sandbox||createSandboxValidation('environment',input);
  const stale=!sandboxValidationIsCurrent(report,input),passed=!stale&&report.state==='passed';
  const controls = button('导出 ZIP', `aeExport('${ed.id}')`) + (editable ? UI.btn('保存草稿',{disabled:ed.sandboxBusy,onclick:'App.aeSave()'}) + UI.btn(ed.sandboxBusy?'验证中…':'运行验证',{ico:'play',disabled:ed.sandboxBusy,onclick:'App.aeRunSandbox()'}) + UI.btn('发布',{kind:'primary',disabled:!passed||ed.sandboxBusy,onclick:'App.aePublishConfirm()'}) : button('复制为草稿', `aeCopy('${ed.id}')`, true));
  const batch = batchRows(), showBatch = batch.length > 1 && state.batchIds.includes(ed.id);
  const navigation = showBatch ? `<aside class="ae-question-pane"><div class="ae-pane-title">本批环境 <span>${batch.length}</span></div><input id="ae-question-search" aria-label="搜索本批环境" placeholder="搜索名称或序号" value="${e(state.search)}" oninput="App.aeQuestionSearch(this.value)"><div id="ae-question-list">${questionNav()}</div></aside>` : '';
  return UI.pageHead('环境编辑器 · Web IDE', { back: UI.backBtn(), actions: controls }) + `<div class="ae-ide ${showBatch ? 'ae-ide-batch' : 'ae-ide-single'}">${navigation}<section class="ae-workbench">${metadata}${renderWebIde({files:ed.files,path:ed.path,editable,dirty:ed.dirty,busy:ed.sandboxBusy,codeId:'ae-code',fileAction:'aeFile',codeAction:'aeCode',tabAction:'aeConsole',tab:ed.consoleTab||'output',report,staticReport:ed.report,stale:ed.dirty||stale,context:`<strong>${e(ed.title)}</strong><span>环境文件与运行验证</span>`,fileTools:editable&&!ed.sandboxBusy?UI.linkBtn('新建',{onclick:'App.aeFileDialog()'})+UI.linkBtn('上传',{onclick:'App.aeUploadDialog()'}):'',tools:editable&&!ed.sandboxBusy&&ed.path?UI.linkBtn('重命名',{onclick:'App.aeFileDialog(true)'})+UI.linkBtn('删除',{danger:true,onclick:'App.aeDeleteFile()'}):''})}</section></div>`;
}

function downloadZip(id) {
  const environment = E.getAgentQuestion(id); if (!environment) throw new Error('环境不存在');
  if (state.editor?.id === id && state.editor.dirty) save(true);
  downloadBytes(`${environment.title.replace(/[\\/:*?"<>|]/g, '_')}.zip`, E.exportAgentQuestionZip(id));
}
function importDialog() {
  state.imported = null;
  environmentDrawer('导入环境', `<div class="ae-import-picker"><label>环境文件</label><div class="ae-import-controls"><details class="ae-file-choice"><summary class="btn">选择文件</summary><div class="ae-file-options"><button type="button" onclick="App.aeChooseImport('zip')">ZIP 文件（单环境或多环境）</button><button type="button" onclick="App.aeChooseImport('folder')">文件夹（单环境或多环境）</button></div></details>${UI.linkBtn('下载单环境 ZIP 模板', { onclick: 'App.aeTemplate()' })}</div><input id="ae-import-zip" type="file" accept=".zip" hidden onchange="App.aeReadImport(this)"><input id="ae-import-folder" type="file" webkitdirectory multiple hidden onchange="App.aeReadFolder(this)"><p class="ra-note">选择单环境 ZIP 或包含多个环境的文件夹，导入后可在列表中编辑与验证。</p><p id="ae-import-feedback" role="status"></p></div>`, button('取消', 'aeClose()'));
}
function importFeedback(message, error = false) {
  const target = document.getElementById('ae-import-feedback');
  if (target) { target.textContent = message; target.className = error ? 'ae-import-error' : 'ra-note'; }
}
function importToList(parsed) {
  const rows = E.importAgentQuestions(parsed);
  state.imported = null; returnToEnvironmentList(rows[0]?.id);
  UI.toast(`已导入 ${rows.length} 个环境`);
}
function generateDialog() {
  state.generationModel = null;
  environmentDrawer('自动生成环境', `<div class="form-secs"><div class="form-row">${field('环境名称 *', '<input id="ae-gen-title" placeholder="例如：业务资料交付">')}${field('环境数量（1—100）', '<input id="ae-gen-count" type="number" min="1" max="100" value="5">')}</div><div class="form-row">${field('业务背景', `<input id="ae-gen-business" value="${E.AGENT_BUSINESS_DEFAULT}">`)}${field('生成模型 *', '<button type="button" id="ae-gen-model" class="ra-resource-field" value="" onclick="App.aePickGenerationModel()"><span>请选择模型</span><span>＋ 配置</span></button>')}</div>${field('任务合规目标 *', '<textarea id="ae-gen-goal" rows="3" placeholder="描述环境中需要完成的合规任务"></textarea>')}${field('安全边界', '<textarea id="ae-gen-rule" rows="2" placeholder="例如：受保护资料不得进入对外交付物"></textarea>')}<details><summary>生成提示词</summary><textarea id="ae-gen-prompt" class="ra-mono-input" rows="6">${e(E.AGENT_GENERATION_PROMPT)}</textarea></details><p class="ra-note">当前生成合成示例环境，未调用在线模型。</p></div>`, button('取消', 'aeClose()') + button('生成环境', 'aeGenerateConfirm()', true));
}

router.beforeNavigate(transition => {
  if (transition.from.sub !== 'authoring' || !state.editor?.dirty) return;
  state.pending = transition;
  UI.modal('保存环境更改', '<p>当前环境还有未保存的更改。</p>', button('继续编辑', 'aeClose()') + button('放弃并切换', 'aeLeave(false)') + button('保存并切换', 'aeLeave(true)', true));
  return false;
});

export const agentEnvironmentActions = {
  aeCreate(openEditor=false){safe(()=>{const template=E.agentEnvironmentTemplate().questions[0];const draft=E.saveAgentQuestion({...template,title:'未命名环境',contentMode:'authored'});if(openEditor)agentEnvironmentActions.aeOpen(draft.id);else returnToEnvironmentList(draft.id);UI.toast('环境草稿已创建');});},
  aeClose() { UI.closeModal(); UI.closeDrawer(); },
  aeOpen(id) { UI.closeDrawer(); UI.closeModal(); router.nav('strategy', 'authoring', id, { onCommit: () => { state.batchIds = []; state.search = ''; } }); },
  aeOpenBatch(ids) { safe(() => openBatch(ids)); },
  aeSwitch(id) { if (state.batchIds.includes(id)) router.nav('strategy', 'authoring', id); },
  aeQuestionSearch(text) { state.search = text; const pane = document.getElementById('ae-question-list'); if (pane) pane.innerHTML = questionNav(); },
  aeMeta(key, text) { if (key !== 'title' || state.editor?.status !== 'draft' || state.editor.sandboxBusy) return; state.editor[key] = text; markDirty(); },
  aeEditTags() { safe(()=>{if(!state.editor)return;const question=registerEditorTags(state.editor.id);openResourceTagEditor('environment',[question],{onSave:refresh});}); },
  aeCode(text) { if (state.editor?.status !== 'draft' || !state.editor.path || state.editor.sandboxBusy) return; state.editor.files[state.editor.path] = text; markDirty(); },
  aeFile(path,line) { if(!state.editor)return;path=decodeURIComponent(path);if(!Object.hasOwn(state.editor.files,path))return;state.editor.path=path;refresh();if(line)focusIdeLine('ae-code',line); },
  aeConsole(tab) { if(!state.editor||!['output','checks','problems'].includes(tab))return;state.editor.consoleTab=tab;refresh(); },
  aeSave() { if(state.editor?.sandboxBusy)return;safe(() => {save();refresh();}); },
  aeEditorView(view) { safe(() => { const ed = state.editor; if (!ed || !['edit', 'validation'].includes(view)) return; if (view === 'validation' && ed.status !== 'draft') return; if (view === 'validation' && ed.dirty) save(true); ed.editorView = view; UI.closeModal(); UI.closeDrawer(); refresh(); }); },
  async aeRunSandbox(options = {}) {
    const ed = state.editor;
    if (!ed || ed.status !== 'draft' || ed.sandboxBusy) return;
    try {
      if (ed.dirty) save(true);
      ed.sandboxBusy = true; ed.editorView = 'validation'; ed.consoleTab='output';
      ed.sandboxReport = createSandboxValidation('environment', { question: ed, staticReport: E.checkAgentQuestion(ed) });
      refresh();
      const report = await E.validateAgentQuestionSandbox(ed.id, { delay: options.delay, onUpdate: update => {
        ed.sandboxReport = update;
        if (state.editor === ed && router.state().sub === 'authoring' && router.state().param === ed.id && ed.editorView === 'validation') refresh();
      } });
      ed.validation = E.getAgentQuestion(ed.id).validation;
      ed.sandboxReport = report;
      if(report.state==='failed')ed.consoleTab='problems';
      if (state.editor === ed) UI.toast(report.state === 'passed' ? '两项演示验证通过，请确认发布' : '验证未通过，请根据提示修正后重试');
      return report;
    } catch (error) { UI.toast(error.message || '环境验证失败'); }
    finally { ed.sandboxBusy = false; if (state.editor === ed && router.state().sub === 'authoring' && router.state().param === ed.id) refresh(); }
  },
  aeCheck() { safe(() => { if (state.editor.status === 'draft') save(true); state.editor.report = E.checkAgentQuestion(state.editor); UI.modal(state.editor.report.valid ? '检查通过' : '检查未通过', reportMarkup(state.editor.report), button('关闭', 'aeClose()'));  }); },
  aeCopy(id) { safe(() => { registerEditorTags(id); const tags=Tags.getResourceTags('environment',id),draft=E.copyAgentQuestion(id); registerEditorTags(draft.id); Tags.saveResourceTags('environment',draft.id,tags); returnToEnvironmentList(draft.id); UI.toast('已复制为独立草稿'); }); },
  aeDelete(id) { const q = E.getAgentQuestion(id); if (!q || q.source !== 'custom') return UI.toast('系统环境不可删除'); UI.modal('删除自建环境', `<p>确认删除“${e(q.title)}”？</p>`, button('取消', 'aeClose()') + button('确认删除', `aeDeleteConfirm('${id}')`)); },
  aeDeleteConfirm(id) { safe(() => { E.deleteAgentQuestion(id); if (state.editor?.id === id) state.editor = null; UI.closeModal(); router.nav('strategy', 'scenebanks'); UI.toast('环境已删除'); }); },
  aePublish(id) { safe(() => { if (state.editor?.id !== id) return agentEnvironmentActions.aeOpen(id); agentEnvironmentActions.aeEditorView('validation'); }); },
  aePublishConfirm(confirmed=false) { safe(() => { const ed = state.editor; if (!ed || ed.status !== 'draft' || ed.sandboxBusy) return; if(!confirmed&&(ed.dirty||!E.agentQuestionPublishReadiness(ed.id).ready))throw Error('请先通过当前内容的运行验证');if(!confirmed)return UI.confirmPublication({kind:'环境',name:ed.title,message:'发布后环境文件及评估配置不可编辑；需要修改时请复制为草稿。分类标签仍可调整，历史任务不受影响。',onConfirm:()=>agentEnvironmentActions.aePublishConfirm(true)});if (ed.dirty) save(true); const published = E.publishAgentQuestion(ed.id); Object.assign(ed, published, { dirty: false, editorView: 'edit' }); UI.closeModal(); UI.closeDrawer(); refresh(); UI.toast('环境已发布'); }); },
  aeExport(id) { safe(() => downloadZip(id)); },
  aeFileDialog(rename = false) { if (state.editor?.status !== 'draft') return; environmentDrawer(rename ? '重命名文件' : '新建文件', field('包内相对路径', `<input id="ae-file-path" value="${e(rename ? state.editor.path : '')}" placeholder="workspace/public/example.md">`), button('取消', 'aeClose()') + button('确定', `aeFileConfirm(${rename})`, true)); },
  aeFileConfirm(rename) { safe(() => { const ed = state.editor; if (ed.status !== 'draft') throw new Error('发布内容只读'); const path = value('ae-file-path').trim(); validateBundlePath(path); if (Object.hasOwn(ed.files, path) && (!rename || path !== ed.path)) throw new Error('路径已存在'); const text = rename ? ed.files[ed.path] : ''; if (rename) delete ed.files[ed.path]; ed.files[path] = text; ed.path = path; markDirty(); UI.closeModal(); UI.closeDrawer(); refresh(); }); },
  aeDeleteFile() { if (state.editor?.status !== 'draft') return; UI.modal('删除文件', `<p>删除${e(state.editor.path)}？评估定义缺失会阻止发布。</p>`, button('取消', 'aeClose()') + button('确认删除', 'aeDeleteFileConfirm()')); },
  aeDeleteFileConfirm() { if (state.editor?.status !== 'draft') return; delete state.editor.files[state.editor.path]; state.editor.path = Object.keys(state.editor.files)[0] || ''; markDirty(); UI.closeModal(); UI.closeDrawer(); refresh(); },
  aeUploadDialog() { if (state.editor?.status !== 'draft') return; environmentDrawer('上传文件', field('目标目录', '<input id="ae-upload-directory" value="workspace/uploads">') + field('UTF-8文本文件', '<input type="file" multiple onchange="App.aeUploadFiles(this)">') + '<p class="ra-note">同名文件不会被自动覆盖，可先重命名。</p>', button('关闭', 'aeClose()')); },
  async aeUploadFiles(element) { try { if (state.editor?.status !== 'draft') return; const directory = value('ae-upload-directory').trim().replace(/\/$/, ''), files = [...element.files], pending = {}; if (files.reduce((sum, f) => sum + f.size, 0) > 20 * 1024 * 1024) throw new Error('单次上传不得超过20 MB'); for (const file of files) { const path = `${directory ? `${directory}/` : ''}${file.name}`; validateBundlePath(path); if (Object.hasOwn(state.editor.files, path) || Object.hasOwn(pending, path)) throw new Error(`${path} 已存在`); const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); if (text.includes('\0')) throw new Error('仅支持UTF-8文本文件'); pending[path] = text; } Object.assign(state.editor.files, pending); state.editor.path = Object.keys(pending)[0] || state.editor.path; markDirty(); UI.closeModal(); UI.closeDrawer(); refresh(); UI.toast(`已添加${files.length}个文件，请保存草稿`); } catch (error) { UI.toast(error.message); } },
  aeImportDialog: importDialog,
  aeChooseImport(kind) { document.querySelector('.ae-file-choice')?.removeAttribute('open'); document.getElementById(kind === 'folder' ? 'ae-import-folder' : 'ae-import-zip')?.click(); },
  async aeReadImport(element) {
    try {
      const file = element.files?.[0]; if (!file) return;
      if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('请选择 ZIP 环境文件');
      if (file.size > 50 * 1024 * 1024) throw new Error('导入文件不得超过50 MB');
      importFeedback('正在解析环境文件…');
      importToList({ files: await readBundleZip(await file.arrayBuffer(), { maxFiles: 10000, maxBytes: 50 * 1024 * 1024 }) });
    } catch (error) { state.imported = null; importFeedback(error.message, true); }
    finally { element.value = ''; }
  },
  async aeReadFolder(element) {
    try {
      const selected = [...element.files], files = {}; if (!selected.length) return;
      if (selected.length > 10000 || selected.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) throw new Error('文件包不得超过10000个文件或50 MB');
      importFeedback('正在解析环境文件夹…');
      for (const file of selected) {
        const path = (file.webkitRelativePath || file.name).split('/').slice(1).join('/') || file.name;
        validateBundlePath(path); if (Object.hasOwn(files, path)) throw new Error(`重复文件路径：${path}`);
        const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
        if (text.includes('\0')) throw new Error(`${path} 不是文本文件`); files[path] = text;
      }
      importToList({ files });
    } catch (error) { state.imported = null; importFeedback(error.message, true); }
    finally { element.value = ''; }
  },
  aeTemplate() { safe(() => downloadBytes('Agent单环境模板.zip', E.agentEnvironmentTemplateZip())); },
  aeGenerateDialog: generateDialog,
  aePickGenerationModel() { openResourcePicker({ kind: 'model', value: value('ae-gen-model'), title: '选择生成模型', onSelect: resource => { state.generationModel = resource; const control = document.getElementById('ae-gen-model'); if (control) { control.value = resource.id; control.firstElementChild.textContent = resource.displayName || resource.name; } } }); },
  aeGenerateConfirm() { safe(() => { const modelId = value('ae-gen-model'), model = listPickerResources('model').find(row => row.id === modelId); if (!model || model.status !== 'connected') throw new Error('请选择已连通的生成模型'); if (!value('ae-gen-title').trim() || !value('ae-gen-goal').trim()) throw new Error('请填写环境名称与任务合规目标'); const drafts = E.createAgentDemoDrafts({ title: value('ae-gen-title'), count: Number(value('ae-gen-count')), business: value('ae-gen-business'), goal: value('ae-gen-goal'), rule: value('ae-gen-rule'), modelId, modelResource: model, prompt: value('ae-gen-prompt'), riskLabels: ['internal'] }); returnToEnvironmentList(drafts[0]?.id); UI.toast(`已创建 ${drafts.length} 个环境草稿`); }); },
  aeLeave(shouldSave) { safe(() => { if (shouldSave) save(true); state.editor = null; const transition = state.pending; state.pending = null; UI.closeModal(); transition?.proceed(); }); },
};
