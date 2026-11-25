import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import * as Banks from '../domain/model-bank-authoring.js';
import * as Authoring from '../domain/resource-authoring.js';
import * as Groups from '../domain/resource-groups.js';
import * as Tags from '../domain/resource-tags.js';
import { openResourceTagEditor } from './tag-management.js';
import { openQuestionImport, actions as questionImportActions } from './question-import.js';
import { renderTagFilter, matchesTagSelection, normalizeTagSelection, actions as tagFilterActions } from '../core/tag-filter.js';
import { renderSelectionSummary } from '../core/selection-summary.js';

const e = UI.esc, copy = value => structuredClone(value);
const call = (name, ...args) => e('App.' + name + '(' + args.map(value => JSON.stringify(value)).join(',') + ')');
const text = id => document.getElementById(id)?.value?.trim() || '';
const tags = value => [...new Set(String(value || '').split(/[,，、;；\n]/).map(part => part.trim()).filter(Boolean))];
const scenes = item => Array.isArray(item.scenes) ? item.scenes : tags(item.scene);
const date = value => value ? e(String(value).slice(0, 16).replace('T', ' ')) : '—';
const refresh = () => router.nav('strategy', 'banks');
const view = { tab: 'all', query: '', source: '', status: '', tagSelection: {}, onlySelected: false };
let questionEditor = null, pendingQuestion = null;
const selectedQuestions = new Set();
let questionPageRows = [], pendingBatch = null;
function ensureCatalog() { if (!Authoring.resourceCatalog()) Authoring.connectResourceCatalog(store); }

export function listLibraryQuestions(dimensions = Tags.listTagDimensions()) {
  ensureCatalog();
  const rows = Banks.listModelBanks().reverse().sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)).flatMap(bank => {
    const base = bank.versions.at(-1), published = new Set((base?.items || []).map(Banks.modelQuestionIdentity));
    return bank.items.map((item, index) => {
      const status = bank.status === 'published' || published.has(Banks.modelQuestionIdentity(item)) ? 'published' : 'draft';
      return { ...copy(item), id: encodeURIComponent(bank.id) + ':' + (item.libraryKey ?? index), questionId: item.id || 'Q-' + (index + 1),
        title: item.prompt, bankId: bank.id, index, bank, status, source: bank.readOnly ? 'system' : 'custom',
        business: bank.business ?? bank.industry ?? '', scenes: scenes(item), createdAt: bank.createdAt, updatedAt: bank.updatedAt || bank.createdAt,
        editable: !bank.readOnly && status === 'draft' };
    });
  });
  Tags.registerResourceSeeds('question', rows.map(row => ({id:row.id,title:row.title,seeds:{business:row.business?[row.business]:[],risk:row.scenes}})), {replace:true});
  const labels = new Map(Tags.getResourcesTags('question',rows.map(row=>row.id)).map(row=>[row.id,row]));
  return rows.map(row => ({...row, tagIds:Object.fromEntries(dimensions.map(d=>[d.id,labels.get(row.id)[d.id]])), tagNames:labels.get(row.id).names}));
}
export function exportQuestionRows(rows) {
  return rows.map(row=>JSON.stringify({...JSON.parse(Authoring.openRtJsonl([row.bank.items[row.index]])),id:row.questionId,business_type:row.tagNames.business,risk_scenarios:row.tagNames.risk,tags:row.tagNames})).join('\n')+'\n';
}
const question = id => listLibraryQuestions().find(row => row.id === id);
function filteredQuestions(rows) {
  const query = view.query.trim().toLowerCase();
  return rows.filter(row => (!view.source || row.source === view.source) && (!view.status || row.status === view.status)
    && matchesTagSelection(row.tagIds,view.tagSelection)
    && (!query || [row.title, row.questionId, ...Object.values(row.tagNames).flat()].join(' ').toLowerCase().includes(query)));
}
const tagText = (names=[]) => names.length ? UI.tagList(names) : '<span class="faint">—</span>';
const otherTagText = (names, dimensions) => {const value=dimensions.filter(d=>!d.system&&(names[d.id]||[]).length).map(d=>d.name+'：'+names[d.id].join('、')).join('；');return '<span class="ql-cell-text" title="'+e(value||'—')+'">'+e(value||'—')+'</span>';};
const resetQuestionView = () => {Object.assign(view,{tab:'all',query:'',source:'',status:'',tagSelection:{},onlySelected:false});UI.resetPage('question-library');};
function openImport(mode='manual'){ensureCatalog();openQuestionImport(mode,{onSaved(){selectedQuestions.clear();resetQuestionView();refresh();}});}
function toolbarMenu(label,items,{primary=false,disabled=false}={}){return '<span class="dd ql-toolbar-menu"><button class="btn w-md '+(primary?'primary':'')+'" type="button" aria-haspopup="menu" aria-expanded="false" '+(disabled?'disabled ':'')+'onclick="UI.toggleMenu(event,this)">'+e(label)+'</button><span class="dd-menu" role="menu" hidden>'+items.map(([name,handler])=>'<button type="button" role="menuitem" onclick="UI.closeMenus();'+e(handler)+'">'+e(name)+'</button>').join('')+'</span></span>';}
const questionReferenced = row => Banks.getModelBankUsage(row.bankId).used || Groups.listResourceGroups('question').some(group=>group.memberIds.includes(row.id)) || (Authoring.resourceCatalog()?.strategies||[]).some(strategy=>(strategy.banks||[]).some(ref=>[row.bankId,...row.bank.versions.map(v=>v.catalogId)].includes(typeof ref==='string'?ref:ref.bankId)));
const canDeleteQuestion = row => row.source==='custom' && !questionReferenced(row) && (row.editable || row.bank.items.length===1);
function questionActions(row) {
  const canDelete = canDeleteQuestion(row);
  return '<div class="row-actions">' + UI.linkBtn('发布', { onclick: call('qlPublish', row.id), disabled: !row.editable || !row.title?.trim(), title: !row.editable ? '仅自建草稿可发布' : !row.title?.trim() ? '请填写题目内容' : '' }) + UI.linkBtn('详情', { onclick: call('qlDetail', row.id) }) + UI.linkBtn('编辑', { onclick: call('qlEdit', row.id), disabled: !row.editable }) + UI.moreMenu([
    ['编辑标签', call('qlTags', row.id)],
    ['复制为草稿', call('qlCopy', row.id)],
    ['导出 JSONL', call('qlExport', row.id)],
    ['删除', call('qlDelete', row.id), { danger: true, disabled: !canDelete, title:!canDelete?'系统内容、已引用内容或已有多题发布快照不可删除':'' }],
  ]) + '</div>';
}
export function questionLibraryPage() {
  const dimensions=Tags.listTagDimensions(), customDimensions=dimensions.filter(d=>!d.system);
  const all = listLibraryQuestions(dimensions);
  for (const id of selectedQuestions) if (!all.some(row=>row.id===id)) selectedQuestions.delete(id);
  if(!selectedQuestions.size)view.onlySelected=false;
  if(all.some(row=>row.id===router.state().param||row.bankId===router.state().param))resetQuestionView();
  const normalized=normalizeTagSelection(view.tagSelection);if(JSON.stringify(normalized)!==JSON.stringify(view.tagSelection)){view.tagSelection=normalized;UI.resetPage('question-library');}
  const tabs = '<div class="ql-tabs" role="tablist" aria-label="题库视图">' + [['all', '全部题目'], ['groups', '题目分组']].map(([id, label]) => '<button role="tab" aria-selected="' + (view.tab === id) + '" class="' + (view.tab === id ? 'active' : '') + '" onclick="' + call('qlTab', id) + '">' + label + '</button>').join('') + '</div>';
  if (view.tab === 'groups') return UI.pageHead('题库') + tabs + resourceGroupsPanel('question', { resources: () => listLibraryQuestions().map(row=>({...row,business:row.tagNames.business.join('、')||'未打标签'})), refresh,
    systemGroups: () => Banks.listModelBanks().filter(bank => bank.readOnly).map(bank => ({ id: 'system-question-' + bank.id, kind: 'question', source: 'system', name: bank.name, description: '', updatedAt: bank.createdAt, memberIds: listLibraryQuestions().filter(row => row.bankId === bank.id && row.status === 'published').map(row => row.id) })) });
  const filters = UI.filters({ search: { label: '搜索', id: 'ql-query', value: view.query, placeholder: '搜索题目、编号或场景', oninput: 'App.qlFilter("query",this.value)' }, selects: [
    { label: '来源', id: 'ql-source', value: view.source, options: [['', '全部来源'], ['system', '系统'], ['custom', '自建']], onchange: 'App.qlFilter("source",this.value)' },
  ], extra: renderTagFilter('question-library',{getSelection:()=>view.tagSelection,onChange(selection){view.tagSelection=selection;UI.resetPage('question-library');refresh();}})+'<label class="filter"><span>状态</span><select id="ql-status" onchange="App.qlFilter(\'status\',this.value)">'+[['','全部状态'],['draft','草稿'],['published','已发布']].map(([value,label])=>'<option value="'+value+'" '+(view.status===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label>',right: toolbarMenu('批量操作',[['批量发布',"App.qlBatch('publish')"],['批量导出',"App.qlExportSelected()"],['批量删除',"App.qlBatch('delete')"]],{disabled:!selectedQuestions.size})+toolbarMenu('新增题目',[['手动导入',"App.qlImport('manual')"],['文件导入',"App.qlImport('file')"]],{primary:true}) });
  const matching=filteredQuestions(all), rows=view.onlySelected?matching.filter(row=>selectedQuestions.has(row.id)):matching;
  const pg = UI.paginate('question-library',rows); questionPageRows=pg.slice;
  const checked = pg.slice.length>0 && pg.slice.every(row=>selectedQuestions.has(row.id));
  const table = UI.table([
    {title:'<input type="checkbox" aria-label="全选当前页题目" '+(checked?'checked':'')+' onchange="App.qlSelectPage(this.checked)">',raw:true,width:'42px',render:row=>'<input type="checkbox" aria-label="选择题目 '+e(row.questionId)+'" '+(selectedQuestions.has(row.id)?'checked':'')+' onchange="'+e('App.qlSelect('+JSON.stringify(row.id)+',this.checked)')+'">'},
    { title: '题目', width:'260px',cls:'ql-title-cell',render: row => UI.linkBtn(row.title, { onclick: call('qlDetail', row.id),title:row.title }) },
    { title: '题目编号',width:'100px',render:row=>'<span class="ql-cell-text" title="'+e(row.questionId)+'">'+e(row.questionId)+'</span>' },
    { title: '来源', width: '75px', render: row => UI.badge(row.source === 'system' ? '系统' : '自建', row.source === 'system' ? 'blue' : 'gray') },
    { title: '业务类型', width: '130px', render: row => tagText(row.tagNames.business) },
    { title: '风险场景', width: '180px', render: row => tagText(row.tagNames.risk) },
    {title:'其他标签',width:'180px',render:row=>otherTagText(row.tagNames,customDimensions)},
    { title: '状态', width: '80px', render: row => UI.badge(row.status === 'draft' ? '草稿' : '已发布', row.status === 'draft' ? 'gray' : 'green') },
    { title: '更新时间', width: '140px', render: row => date(row.updatedAt) },
    { title: '操作', width: '175px', render: questionActions },
  ], pg.slice, '暂无匹配题目')+UI.pager(pg,"UI.setPage('question-library',{p})");
  const batch=selectedQuestions.size?renderSelectionSummary({count:selectedQuestions.size,visibleCount:matching.filter(row=>selectedQuestions.has(row.id)).length,unit:'道题目',onlySelected:view.onlySelected,onOnlySelected:'App.qlOnlySelected(this.checked)',onClear:'App.qlClearSelection()',onSelectFiltered:'App.qlSelectFiltered()',filteredCount:matching.length}):'';
  return UI.pageHead('题库') + tabs + '<section class="ql-library">' + batch + filters + UI.card('', table, '', true) + '</section>';
}
function showQuestion(id) {
  const row = question(id); if (!row) return UI.toast('题目不存在');
  UI.drawer('题目详情', '<div class="ql-question-detail">' + UI.kvTable([
    ['题目编号', e(row.questionId)], ['来源', row.source === 'system' ? '系统' : '自建'], ['业务类型', tagText(row.tagNames.business)],
    ['风险场景', tagText(row.tagNames.risk)], ...Tags.listTagDimensions().filter(d=>!d.system).map(d=>[d.name,tagText(row.tagNames[d.id])]), ['状态', UI.badge(row.status === 'draft' ? '草稿' : '已发布')],
  ]) + '<label class="field"><span>题目内容</span><p class="ql-full-prompt">' + e(row.title) + '</p></label></div>',
  UI.btn('关闭', { onclick: 'UI.closeDrawer()' }) + UI.btn('编辑', { onclick: call('qlEdit', id), disabled: !row.editable }));
}
function editQuestion(id) {
  if(!id)return openImport('manual');
  const row = id ? question(id) : null;
  if (id && !row) return UI.toast('题目不存在');
  if (row && !row.editable) return UI.toast('已发布题目只读');
  questionEditor = row ? { id, bankId: row.bankId, index: row.index } : {};
  UI.drawer(row ? '编辑题目' : '新增题目', '<div class="ql-form"><label class="field"><span>题目内容 *</span><textarea id="ql-prompt" rows="9">' + e(row?.title || '') + '</textarea></label><p class="faint">保存后可在列表的“编辑标签”中设置业务类型、风险场景等标签，标签可以留空。</p><p id="ql-error" class="ql-error" role="alert"></p></div>', UI.btn('取消', { onclick: 'UI.closeDrawer()' }) + UI.btn('保存草稿', { kind: 'primary', onclick: 'App.qlSave()' }));
}
function replaceDraftItem(row, replacement) {
  const record = Banks.getModelBank(row.bankId);
  if (!record || !row.editable || record.status !== 'draft') throw Error('题目已变化，请重新打开草稿');
  const items = copy(record.items).map((item,index)=>({...item,libraryKey:item.libraryKey??index}));
  if (replacement) items[row.index] = {...replacement,libraryKey:items[row.index].libraryKey}; else items.splice(row.index, 1);
  if (!items.length && !record.versions.length) return Banks.deleteModelBank(record.id);
  const base = new Set((record.versions.at(-1)?.items || []).map(Banks.modelQuestionIdentity));
  return Banks.saveModelBankDraft({ ...record, items, ...(record.versions.length ? { pendingItems: items.filter(item => !base.has(Banks.modelQuestionIdentity(item))) } : {}) });
}
function publishQuestion(row) {
  if(!row.editable)throw Error('仅自建草稿可发布');
  if(row.bank.items.length===1&&!row.bank.versions.length)return Banks.publishModelBank(row.bankId);
  // Split a legacy multi-question draft so publishing one selection never publishes its siblings.
  const draft=Banks.saveModelBankDraft({name:row.title.slice(0,60),business:row.business,items:[copy(row.bank.items[row.index])],questionLibraryEntry:true});
  Banks.publishModelBank(draft.id);replaceDraftItem(row,null);
  const created=listLibraryQuestions().find(item=>item.bankId===draft.id);
  Tags.saveResourceTags('question',created.id,row.tagIds);
  return created;
}
function deleteQuestion(row) {
  if(!canDeleteQuestion(row))throw Error('题目被引用或不可删除');
  if(row.status==='published')return Banks.deleteModelBank(row.bankId);
  return replaceDraftItem(row,null);
}
// Shared grouping controls. Each library supplies its own live candidate resolver.
const groupContexts = new Map(), groupViews = new Map();
let groupEditor = null, pendingGroup = null;
const kindLabel = kind => kind === 'question' ? '题目' : '环境';
const groupView = kind => { if (!groupViews.has(kind)) groupViews.set(kind, { query: '', source: '' }); return groupViews.get(kind); };
const groupRows = kind => [...Groups.listResourceGroups(kind).reverse(),...(groupContexts.get(kind)?.systemGroups?.() || [])].sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0));
const groupById = (kind, id) => groupRows(kind).find(row => row.id === id);
export function resourceGroupsPanel(kind, context) {
  groupContexts.set(kind, context); const state = groupView(kind), query = state.query.trim().toLowerCase();
  const resources = new Map(context.resources().map(row => [row.id, row]));
  const rows = groupRows(kind).filter(row => (!state.source || row.source === state.source) && (!query || [row.name, row.description].join(' ').toLowerCase().includes(query)));
  const filters = UI.filters({ search: { label: '搜索', id: 'rg-query', value: state.query, placeholder: '搜索分组名称或说明', oninput: 'App.rgFilter(' + JSON.stringify(kind) + ',"query",this.value)' }, selects: [
    { label: '来源', id: 'rg-source', value: state.source, options: [['', '全部来源'], ['system', '系统'], ['custom', '自建']], onchange: 'App.rgFilter(' + JSON.stringify(kind) + ',"source",this.value)' },
  ], right: UI.btn('新建分组', { kind: 'primary', ico: 'plus', onclick: call('rgEdit', kind) }) });
  const table = UI.pagedTable('resource-groups-' + kind, [
    { title: '分组名称', render: row => UI.linkBtn(row.name, { onclick: call('rgDetail', kind, row.id) }) + (row.description ? '<div class="faint text-support">' + e(row.description) + '</div>' : '') },
    { title: '来源', width: '90px', render: row => UI.badge(row.source === 'system' ? '系统' : '自建', row.source === 'system' ? 'blue' : 'gray') },
    { title: kindLabel(kind) + '数量', width: '130px', render: row => { const missing = row.memberIds.filter(id => resources.get(id)?.status !== 'published').length; return row.memberIds.length + (missing ? '<div class="ql-error">' + missing + ' 项已不可用</div>' : ''); } },
    { title: '更新时间', width: '150px', render: row => date(row.updatedAt) },
    { title: '操作', width: '185px', render: row => '<div class="row-actions">' + UI.linkBtn('详情', { onclick: call('rgDetail', kind, row.id) }) + UI.linkBtn('编辑', { onclick: call('rgEdit', kind, row.id), disabled: row.source === 'system' }) + UI.linkBtn('删除', { danger: true, onclick: call('rgDelete', kind, row.id), disabled: row.source === 'system' }) + '</div>' },
  ], rows, '暂无分组，可选择已发布' + kindLabel(kind) + '组建');
  return '<section class="ql-groups">' + filters + UI.card('', table, '', true) + '</section>';
}
function collectGroup() { if (groupEditor) { groupEditor.name = text('rg-name'); groupEditor.description = text('rg-description'); } }
function groupCandidates(current) {
  const candidates=[...new Map(groupContexts.get(current.kind).resources().filter(row=>row.status==='published').map(row=>[row.id,row])).values()];
  const classification=new Map(Tags.getResourcesTags(current.kind,candidates.map(row=>row.id)).map(tags=>[tags.id,tags]));
  return candidates.map(row=>({...row,groupTags:classification.get(row.id)}));
}
function groupTagCell(value) {
  const text=(value||[]).join('、')||'—';
  return '<span class="rg-cell-text" title="'+e(text)+'">'+e(text)+'</span>';
}
function renderGroupEditor() {
  const current=groupEditor;if(!current)return;
  const label=kindLabel(current.kind),all=groupCandidates(current),query=current.query.trim().toLowerCase();
  const dimensions=Tags.listTagDimensions();
  current.tagSelection=normalizeTagSelection(current.tagSelection);
  const availableIds=new Set(all.map(row=>row.id)),unavailable=[...current.memberIds].filter(id=>!availableIds.has(id));
  const matching=all.filter(row=>(!current.source||row.source===current.source)&&matchesTagSelection(row.groupTags,current.tagSelection)&&(!query||[row.title,row.questionId,row.taskId,...dimensions.map(d=>row.groupTags.names[d.id]?.join('、')||'未打标签')].join(' ').toLowerCase().includes(query)));
  current.matchingRows=matching;
  const visible=current.onlySelected?matching.filter(row=>current.memberIds.has(row.id)):matching;
  const pg=UI.paginate('resource-group-picker',visible);current.pageRows=pg.slice;
  const checkboxIds=current.onlySelected?current.memberIds:current.stagedIds;
  const checkedCount=pg.slice.filter(row=>checkboxIds.has(row.id)).length,selectedAll=pg.slice.length>0&&checkedCount===pg.slice.length;
  const summary=renderSelectionSummary({count:current.memberIds.size,visibleCount:matching.filter(row=>current.memberIds.has(row.id)).length,unit:current.kind==='question'?'道题目':'个环境',onlySelected:current.onlySelected,onOnlySelected:'App.rgOnlySelected(this.checked)',onClear:'App.rgClearSelection()',clearLabel:'清空已选',onSelectFiltered:'App.rgSelectFiltered()',filteredCount:matching.length,notice:current.selectionNotice||'',stagedCount:current.stagedIds.size,onAdd:'App.rgAddStaged()',onClearStaged:'App.rgClearStaged()'});
  const filter=renderTagFilter('resource-group-picker',{getSelection:()=>groupEditor?.tagSelection||{},onChange:selection=>{if(!groupEditor)return;collectGroup();groupEditor.tagSelection=selection;UI.resetPage('resource-group-picker');renderGroupEditor();},label:'标签'});
  const filters=UI.filters({search:{label:'搜索',id:'rg-picker-query',value:current.query,placeholder:'搜索'+label+'或编号',oninput:'App.rgSearchMembers(this.value)'},selects:[{label:'来源',id:'rg-picker-source',value:current.source,options:[['','全部来源'],['system','系统'],['custom','自建']],onchange:'App.rgMemberSource(this.value)'}],extra:filter});
  const table=UI.table([
    {title:'<input type="checkbox" aria-label="全选当前页成员" '+(selectedAll?'checked ':'')+(!pg.slice.length?'disabled ':'')+'onchange="App.rgSelectPage(this.checked)">',raw:true,width:'42px',render:row=>'<input type="checkbox" aria-label="选择'+label+' '+e(row.questionId||row.taskId||row.id)+'" '+(checkboxIds.has(row.id)?'checked ':'')+'onchange="'+e('App.rgSelect('+JSON.stringify(row.id)+',this.checked)')+'">'},
    {title:label,width:'280px',render:row=>'<span class="rg-cell-text rg-member-prompt" title="'+e(row.title)+'">'+e(row.title)+'</span>'},
    {title:label+'编号',width:'130px',render:row=>'<span class="rg-cell-text" title="'+e(row.questionId||row.taskId||row.id)+'">'+e(row.questionId||row.taskId||row.id)+'</span>'},
    {title:'来源',width:'75px',render:row=>row.source==='system'?'系统':'自建'},
    {title:'业务类型',width:'130px',render:row=>groupTagCell(row.groupTags.names.business)},
    {title:'风险场景',width:'180px',render:row=>groupTagCell(row.groupTags.names.risk)},
    {title:'其他标签',width:'180px',render:row=>{const value=dimensions.filter(d=>!d.system&&(row.groupTags.names[d.id]||[]).length).map(d=>d.name+'：'+row.groupTags.names[d.id].join('、')).join('；')||'—';return '<span class="rg-cell-text" title="'+e(value)+'">'+e(value)+'</span>';}},
    {title:'选择状态',width:'95px',render:row=>current.memberIds.has(row.id)?'已加入':current.stagedIds.has(row.id)?'待加入':'—'}
  ],pg.slice,current.onlySelected?'当前筛选下暂无已选'+label:'暂无匹配的已发布'+label);
  const form='<div class="ql-group-form rg-picker-form"><div class="rg-group-metadata"><label class="field"><span>分组名称 *</span><input id="rg-name" maxlength="100" placeholder="请输入分组名称" value="'+e(current.name)+'"></label><label class="field"><span>说明</span><input id="rg-description" maxlength="500" placeholder="选填" value="'+e(current.description)+'"></label></div><div class="ql-group-picker-head"><strong>选择已发布'+label+'</strong><span>分组仅组织成员，保留原'+label+'内容</span></div>'+summary+filters+(unavailable.length?'<p class="ql-error">有 '+unavailable.length+' 项已选成员已不可用，保存前请移除。'+UI.linkBtn('移除不可用成员',{onclick:'App.rgRemoveUnavailable()'})+'</p>':'')+'<div class="rg-picker-table">'+table+'</div>'+UI.pager(pg,'App.rgMemberPage({p})')+'<p id="rg-error" class="ql-error" role="alert">'+e(current.error||'')+'</p></div>';
  UI.modal(current.id?'编辑'+label+'分组':'新建'+label+'分组',form,UI.btn('取消',{onclick:'App.rgCancel()'})+UI.btn('保存分组',{kind:'primary',onclick:'App.rgSave()'}),{wide:true,cls:'rg-group-modal'});
  const head=document.querySelector('#modal .rg-group-modal .modal-head .icon-btn');if(head)head.setAttribute('onclick','App.rgCancel()');
  const pageCheckbox=document.querySelector('#modal [aria-label="全选当前页成员"]');if(pageCheckbox)pageCheckbox.indeterminate=checkedCount>0&&!selectedAll;
}
function groupDetail(kind, id, page = 1) {
  const record = groupById(kind, id), context = groupContexts.get(kind); if (!record || !context) return UI.toast('分组不存在');
  const resources = new Map(context.resources().map(row => [row.id, row]));
  UI.setPage('resource-group-detail', page, { rerender: false });
  const rows = record.memberIds.map(memberId => resources.get(memberId) || { id: memberId, title: '成员已删除或暂不可用', status: 'missing' });
  const pg = UI.paginate('resource-group-detail', rows);
  UI.drawer(record.name, '<div class="ql-group-detail">' + (record.description ? '<p>' + e(record.description) + '</p>' : '') + '<p class="faint">共 ' + rows.length + ' 个' + kindLabel(kind) + '</p>' + UI.table([
    { title: kindLabel(kind), render: row => '<span class="ql-member-title">' + e(row.title) + '</span>' },
    { title: '成员状态', width: '100px', render: row => UI.badge(row.status === 'published' ? '已发布' : '不可用', row.status === 'published' ? 'green' : 'gray') },
  ], pg.slice, '暂无成员') + UI.pager(pg, 'App.rgDetail(' + JSON.stringify(kind) + ',' + JSON.stringify(id) + ',{p})') + '</div>', UI.btn('关闭', { onclick: 'UI.closeDrawer()' }) + UI.btn('编辑', { onclick: call('rgEdit', kind, id), disabled: record.source === 'system' }));
  document.querySelector('#drawer .drawer')?.classList.add('ql-group-drawer');
}
export const resourceGroupActions = {
  rgFilter(kind, key, value) { if (!['query', 'source'].includes(key)) return; groupView(kind)[key] = value; UI.resetPage('resource-groups-' + kind); groupContexts.get(kind)?.refresh(); if (key === 'query') { const input = document.getElementById('rg-query'); input?.focus(); input?.setSelectionRange(value.length, value.length); } },
  rgEdit(kind,id) { const context=groupContexts.get(kind);if(!context)return;const record=id?groupById(kind,id):null;if(id&&(!record||record.source==='system'))return UI.toast('系统分组只读');tagFilterActions.tfDone('resource-group-picker');groupEditor={kind,id:record?.id,name:record?.name||'',description:record?.description||'',memberIds:new Set(record?.memberIds||[]),stagedIds:new Set(),query:'',source:'',tagSelection:{},onlySelected:false,pageRows:[],matchingRows:[],selectionNotice:'勾选后点击“加入已选”，可分多次组合',error:''};UI.closeDrawer();UI.resetPage('resource-group-picker');renderGroupEditor(); },
  rgCancel(){tagFilterActions.tfDone('resource-group-picker');groupEditor=null;UI.closeModal();},
  rgMemberTag(dimension,value){if(!groupEditor||!Tags.listTagDimensions().some(d=>d.id===dimension))return;collectGroup();groupEditor.tagSelection[dimension]=value?[value]:[];UI.resetPage('resource-group-picker');renderGroupEditor();},
  rgMemberSource(value){if(!groupEditor||!['','system','custom'].includes(value))return;collectGroup();groupEditor.source=value;UI.resetPage('resource-group-picker');renderGroupEditor();},
  rgSearchMembers(value){if(!groupEditor)return;collectGroup();groupEditor.query=value;UI.resetPage('resource-group-picker');renderGroupEditor();const input=document.getElementById('rg-picker-query');input?.focus();input?.setSelectionRange(value.length,value.length);},
  rgSelect(id,checked){if(!groupEditor||!groupContexts.get(groupEditor.kind)?.resources().some(row=>row.id===id&&row.status==='published'))return;collectGroup();const ids=groupEditor.onlySelected?groupEditor.memberIds:groupEditor.stagedIds;checked?ids.add(id):ids.delete(id);groupEditor.selectionNotice=groupEditor.onlySelected?'已更新已选成员':'勾选已保留，点击“加入已选”后汇总';renderGroupEditor();},
  rgSelectPage(checked){if(!groupEditor)return;collectGroup();const ids=groupEditor.onlySelected?groupEditor.memberIds:groupEditor.stagedIds;groupEditor.pageRows.forEach(row=>checked?ids.add(row.id):ids.delete(row.id));groupEditor.selectionNotice=groupEditor.onlySelected?'已更新当前页成员':'已更新当前页勾选，其他页面的勾选继续保留';renderGroupEditor();},
  rgSelectFiltered(){if(!groupEditor||groupEditor.onlySelected)return;collectGroup();groupEditor.matchingRows.forEach(row=>groupEditor.stagedIds.add(row.id));groupEditor.selectionNotice='已勾选全部匹配，点击“加入已选”后去重汇总';renderGroupEditor();},
  rgAddStaged(){if(!groupEditor||!groupEditor.stagedIds.size)return;collectGroup();const available=new Set(groupCandidates(groupEditor).map(row=>row.id));let added=0,duplicate=0,unavailable=0;for(const id of groupEditor.stagedIds){if(!available.has(id)){unavailable++;continue;}if(groupEditor.memberIds.has(id))duplicate++;else{groupEditor.memberIds.add(id);added++;}}groupEditor.stagedIds.clear();groupEditor.error='';groupEditor.selectionNotice='本次新增 '+added+' '+(groupEditor.kind==='question'?'道题目':'个环境')+'，已去重 '+duplicate+' 项'+(unavailable?'，跳过 '+unavailable+' 项不可用内容':'');renderGroupEditor();},
  rgClearStaged(){if(!groupEditor)return;collectGroup();groupEditor.stagedIds.clear();groupEditor.error='';groupEditor.selectionNotice='已清空本次待加入，已选成员保留';renderGroupEditor();},
  rgOnlySelected(checked){if(!groupEditor)return;collectGroup();groupEditor.onlySelected=Boolean(checked);UI.resetPage('resource-group-picker');renderGroupEditor();},
  rgClearSelection(){if(!groupEditor)return;collectGroup();groupEditor.memberIds.clear();groupEditor.selectionNotice='已清空已选成员';UI.resetPage('resource-group-picker');renderGroupEditor();},
  rgMemberPage(page){if(!groupEditor)return;collectGroup();UI.setPage('resource-group-picker',page,{rerender:false});renderGroupEditor();},
  rgRemoveUnavailable(){if(!groupEditor)return;collectGroup();const ids=new Set(groupContexts.get(groupEditor.kind).resources().filter(row=>row.status==='published').map(row=>row.id));groupEditor.memberIds=new Set([...groupEditor.memberIds].filter(id=>ids.has(id)));renderGroupEditor();},
  rgSave(){if(!groupEditor)return;collectGroup();try{if(groupEditor.stagedIds.size)throw Error('还有 '+groupEditor.stagedIds.size+' 项待加入，请先点击“加入已选”或“清空待加入”');Groups.saveResourceGroup({...groupEditor,memberIds:[...groupEditor.memberIds]},groupContexts.get(groupEditor.kind).resources());const kind=groupEditor.kind;tagFilterActions.tfDone('resource-group-picker');groupEditor=null;Object.assign(groupView(kind),{query:'',source:''});UI.resetPage('resource-groups-'+kind);UI.closeModal();groupContexts.get(kind).refresh();UI.toast('分组已保存');}catch(error){groupEditor.error=error.message;document.getElementById('rg-error').textContent=error.message;}},
  rgDetail: groupDetail,
  rgDelete(kind, id) { const record = groupById(kind, id); if (!record || record.source === 'system') return UI.toast('系统分组不可删除'); pendingGroup = { kind, id }; UI.modal('删除分组', '<p>确认删除“' + e(record.name) + '”？分组中的' + kindLabel(kind) + '会保留。</p>', UI.btn('取消', { onclick: 'UI.closeModal()' }) + UI.btn('删除', { kind: 'danger', onclick: 'App.rgConfirmDelete()' })); },
  rgConfirmDelete() { if (!pendingGroup) return; try { const { kind, id } = pendingGroup; Groups.deleteResourceGroup(id); pendingGroup = null; UI.closeModal(); groupContexts.get(kind).refresh(); UI.toast('分组已删除'); } catch (error) { UI.toast(error.message); } },
};
export const actions = {
  ...resourceGroupActions,
  ...questionImportActions,
  ...tagFilterActions,
  qlSelect(id,checked) { if(!question(id))return; checked?selectedQuestions.add(id):selectedQuestions.delete(id); refresh(); },
  qlSelectPage(checked) { questionPageRows.forEach(row=>checked?selectedQuestions.add(row.id):selectedQuestions.delete(row.id));refresh(); },
  qlClearSelection() { selectedQuestions.clear();view.onlySelected=false;refresh(); },
  qlOnlySelected(value){view.onlySelected=Boolean(value);UI.resetPage('question-library');refresh();},
  qlSelectFiltered(){filteredQuestions(listLibraryQuestions()).forEach(row=>selectedQuestions.add(row.id));refresh();},
  qlTags(id) { const rows=id?[question(id)]:listLibraryQuestions().filter(row=>selectedQuestions.has(row.id));if(!rows.length)return UI.toast('请先选择题目');openResourceTagEditor('question',rows.map(row=>({id:row.id,title:row.title})),{onSave:refresh}); },
  qlCopy(id) { try { const row=question(id);if(!row)throw Error('题目不存在');const item=copy(row.bank.items[row.index]),usedIds=new Set(listLibraryQuestions().map(entry=>entry.questionId));const prefix='Q-'+Date.now().toString(36).toUpperCase();let suffix=1;item.id=prefix;while(usedIds.has(item.id))item.id=prefix+'-'+suffix++;const saved=Banks.saveModelBankDraft({name:row.title.slice(0,60)+' · 副本',business:row.business,items:[item],questionLibraryEntry:true});const created=listLibraryQuestions().find(entry=>entry.bankId===saved.id);Tags.saveResourceTags('question',created.id,row.tagIds);resetQuestionView();UI.closeDrawer();refresh();UI.toast('已复制为独立草稿');}catch(error){UI.toast(error.message);} },
  qlBatch(action) { const rows=listLibraryQuestions().filter(row=>selectedQuestions.has(row.id));const eligible=rows.filter(row=>action==='publish'?row.editable:canDeleteQuestion(row));if(!eligible.length)return UI.toast(action==='publish'?'请选择自建草稿':'所选题目均不可删除');pendingBatch={action,ids:eligible.map(row=>row.id)};UI.modal(action==='publish'?'批量发布题目':'批量删除题目','<p>将'+(action==='publish'?'发布':'删除')+' '+eligible.length+' 道题目，跳过 '+(rows.length-eligible.length)+' 道不符合条件的题目。</p><p class="faint">'+(action==='publish'?'发布后内容固定，标签仍可修改。':'系统题目和已引用的题目会保留。')+'</p>',UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('确认'+(action==='publish'?'发布':'删除'),{kind:action==='publish'?'primary':'danger',onclick:'App.qlConfirmBatch()'})); },
  qlConfirmBatch() { if(!pendingBatch)return;const current=pendingBatch;pendingBatch=null;let succeeded=0;const failures=[];for(const id of current.ids){try{const row=question(id);if(!row)throw Error('题目已不存在');if(current.action==='publish')publishQuestion(row);else deleteQuestion(row);selectedQuestions.delete(id);succeeded++;}catch(error){failures.push({name:question(id)?.title||id,error:error.message});}}UI.closeModal();if(current.action==='publish')view.status='';refresh();if(failures.length)UI.modal('批量处理结果','<p>成功 '+succeeded+' 道，未完成 '+failures.length+' 道。</p>'+UI.table([{title:'题目',render:r=>e(r.name)},{title:'原因',render:r=>e(r.error)}],failures),UI.btn('关闭',{onclick:'UI.closeModal()'}));else UI.toast('已'+(current.action==='publish'?'发布':'删除')+' '+succeeded+' 道题目'); },
  qlTab(tab) { if (!['all', 'groups'].includes(tab)) return; view.tab = tab; refresh(); },
  qlFilter(key, value) { if (!['query', 'source', 'scene', 'business', 'status'].includes(key)) return; if(['business','scene'].includes(key)){const dimension=key==='scene'?'risk':'business';view.tagSelection={...view.tagSelection,[dimension]:value?[value]:[]};}else view[key] = value; UI.resetPage('question-library'); refresh(); if (key === 'query') { const input = document.getElementById('ql-query'); input?.focus(); input?.setSelectionRange(value.length, value.length); } },
  qlDimensionFilter(dimension,value){if(!Tags.listTagDimensions().some(d=>d.id===dimension&&!d.system))return;view.tagSelection={...view.tagSelection,[dimension]:value?[value]:[]};UI.resetPage('question-library');refresh();},
  qlDetail: showQuestion, qlEdit: editQuestion,
  qlSave() { if (!questionEditor) return; try {
    const prompt = text('ql-prompt');
    if (!prompt) throw Error('请填写题目内容');
    const row = questionEditor.id ? question(questionEditor.id) : null;
    if (questionEditor.id && !row?.editable) throw Error('题目已变化，请重新打开草稿');
    const item = { ...(row ? copy(row.bank.items[row.index]) : {scene:'',scenes:[]}), prompt };
    if (row) replaceDraftItem(row, item);
    else Banks.saveModelBankDraft({ name: prompt.slice(0, 60), business:'', items: [item], questionLibraryEntry: true });
    questionEditor = null; UI.closeDrawer(); resetQuestionView(); refresh(); UI.toast('题目草稿已保存');
  } catch (error) { document.getElementById('ql-error').textContent = error.message; } },
  qlPublish(id) { const row = question(id); if (!row?.editable) return UI.toast('仅自建草稿可发布'); pendingQuestion = { id, action: 'publish' }; UI.modal('发布题目', '<p>确认发布这道题目？发布后题目内容只读，标签仍可修改。</p><p class="ql-full-prompt">' + e(row.title) + '</p>', UI.btn('取消', { onclick: 'UI.closeModal()' }) + UI.btn('发布', { kind: 'primary', onclick: 'App.qlConfirmQuestionAction()' })); },
  qlDelete(id) { const row = question(id); if (!row||!canDeleteQuestion(row)) return UI.toast('系统、已引用或已有多题发布快照不可删除'); pendingQuestion = { id, action: 'delete' }; UI.modal('删除题目', '<p>确认删除这道题目？</p><p class="ql-full-prompt">' + e(row.title) + '</p>', UI.btn('取消', { onclick: 'UI.closeModal()' }) + UI.btn('删除', { kind: 'danger', onclick: 'App.qlConfirmQuestionAction()' })); },
  qlConfirmQuestionAction() { if (!pendingQuestion) return; try { const row = question(pendingQuestion.id); if (!row) throw Error('题目已变化，请重新选择'); if (pendingQuestion.action === 'publish') { publishQuestion(row); view.status = ''; } else deleteQuestion(row); pendingQuestion = null; UI.closeModal(); refresh(); } catch (error) { UI.toast(error.message); } },
  qlExportSelected() { const rows=listLibraryQuestions().filter(row=>selectedQuestions.has(row.id));if(!rows.length)return UI.toast('请先选择题目');UI.download('模型题目-'+rows.length+'道.jsonl',exportQuestionRows(rows));UI.toast('已导出 '+rows.length+' 道题目'); },
  qlExport(id) { const row = question(id); if (row) UI.download(row.questionId + '.jsonl', Authoring.openRtJsonl([row.bank.items[row.index]]) + '\n'); },
  qlImport: openImport,
  qlTemplate: questionImportActions.qiTemplate,
  qlImportChanged: questionImportActions.qiTextChanged,
  qlReadFile: questionImportActions.qiReadFile,
  qlPreviewImport: questionImportActions.qiParse,
  qlConfirmImport: questionImportActions.qiSave,
};
