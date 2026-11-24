import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import { listAssets, listModelResources, deleteModelResource, getAsset, getAssetSnapshot, listAssetVersions, listTestableAssets, selectAssetVersion, saveAsset, validateAsset, importAssets, importManualAgents, previewManualAgents, assetVersionLabel, manualAgentDeleteError, deleteManualAgent, previewAssets, parseAssetImport, ASSET_IMPORT_EXAMPLE, listPlatformConnections, listPlatformSyncedAssets, getPlatformConnection, platformCatalog, importPlatformAssets } from '../domain/asset-intake.js';
import { syncPlatformConnection } from '../domain/platform-connection.js';
import { openAgentIntake } from './agent-intake.js';
import { openModelIntake, modelDetail } from './model-intake.js';
const TABS=[['connection','企业资产平台连接'],['manual','人工上传'],['models','模型接入配置']];
let activeTab='connection',catalogConnectionId='',catalogSelection=new Set();
export function selectIntakeTab(tab){if(TABS.some(([id])=>id===tab))activeTab=tab;}
const FILTER={kind:'all',status:'all',sourceStatus:'all',query:''},selected=new Set();
const STATUS={pending:['待测试','amber'],ready:['已连通','green'],failed:['连通失败','red']};
const e=UI.esc, val=id=>document.getElementById(id)?.value?.trim()||'', typeName=k=>k==='agent'?'Agent':'模型';
const routeKey=()=>{const r=router.state();return [r.page,r.sub,r.param||''].join('/');};
const key=x=>x.id+'@'+x.version, refresh=()=>router.nav(router.state().page==='platform'?'platform':'assets','intake'), message=error=>UI.toast(error.message||String(error));
let preview=[],pageRows=[],batchBusy=false,detailKey='';
const badge=x=>x.sourceStatus==='已停用'?UI.badge('源已停用','gray'):x.busy?UI.badge('检查中','blue'):UI.badge(...STATUS[x.status]);
const surfaceTypes=[['instruction','指令文件'],['rule','规则文件'],['skill','技能文件'],['command','命令文件'],['memory:long_term','长期记忆'],['memory:conversation','会话历史'],['memory:task_state','任务状态'],['configuration','配置文件']];
function splitKey(value){const index=value.lastIndexOf('@');return[value.slice(0,index),value.slice(index+1)];}
function selectedAssets(){return[...selected].map(x=>getAsset(...splitKey(x))).filter(Boolean);}
function currentRows(){
 if(activeTab==='models'){const query=FILTER.query.trim().toLowerCase();return listModelResources().filter(x=>(FILTER.status==='all'||x.status===FILTER.status)&&(!query||[x.name,x.apiModel,x.baseUrl].join(' ').toLowerCase().includes(query)));}
 const query=FILTER.query.trim().toLowerCase();
 return listAssets({kind:'agent'}).flatMap(asset=>listAssetVersions(asset.id)).filter(asset=>!asset.platformConnectionId&&
  (FILTER.sourceStatus==='all'||asset.sourceStatus===FILTER.sourceStatus)&&
  (!query||[asset.name,asset.id,asset.owner].join(' ').toLowerCase().includes(query)));
}
function manualMore(x){return UI.moreMenu([
 ['新版本',"App.aiNewVersion('"+x.id+"','"+x.version+"')"],
 ['删除',"App.aiDeleteAgent('"+x.id+"','"+x.version+"')",{danger:true,disabled:Boolean(manualAgentDeleteError(x.id,x.version))}]
]);}
const sourceBadge=x=>UI.badge(x.sourceStatus,({'已发布':'green','未发布':'amber','已停用':'gray'})[x.sourceStatus]||'gray');
const displayTime=value=>value?e(new Date(value).toLocaleString('zh-CN',{hour12:false})):'—';
function manualTable(){
 const rows=currentRows(),pg=UI.paginate('asset-intake',rows);
 const filters=UI.filters({search:{label:'搜索',id:'ai-search',value:FILTER.query,placeholder:'Agent 名称、ID、负责人',oninput:'App.aiFilter("query",this.value)'},selects:[{label:'资产状态',id:'ai-source-filter',value:FILTER.sourceStatus,onchange:'App.aiFilter("sourceStatus",this.value)',options:[['all','全部状态'],...['未发布','已发布','已停用'].map(value=>[value,value])]}],right:'<div class="ai-filter-actions">'+UI.btn('批量上传',{onclick:'App.aiImport()',ico:'upload'})+UI.btn('快捷上传',{kind:'primary',onclick:"App.aiUpload('agent')",ico:'plus'})+'</div>'});
 const table=UI.table([
  {title:'资产名称/ID',render:x=>UI.linkBtn(x.name,{onclick:'App.aiDetail(\''+x.id+'\',\''+x.version+'\')'})+'<div class="ai-subtext">'+e(x.id)+'</div>'},
  {title:'类型',width:'80px',render:()=> '智能体'},
  {title:'配置版本',width:'120px',render:x=>e(assetVersionLabel(x))},
  {title:'资产状态',width:'120px',render:sourceBadge},
  {title:'更新时间',width:'170px',render:x=>displayTime(x.updatedAt)},
  {title:'操作',width:'200px',render:x=>'<div class="row-actions">'+UI.linkBtn('详情',{onclick:'App.aiDetail(\''+x.id+'\',\''+x.version+'\')'})+UI.linkBtn('编辑',{onclick:'App.aiEdit(\''+x.id+'\',\''+x.version+'\')'})+manualMore(x)+'</div>'}
 ],pg.slice,'暂无匹配 Agent，可快捷上传或批量上传配置。');
 return '<section class="ai-asset-panel ai-manual-panel" aria-label="人工上传">'+filters+UI.card('',table+UI.pager(pg,"UI.setPage('asset-intake',{p})"),'',true)+'</section>';
}
function agentDetail(x){
 detailKey=key(x);
 const surfaces=UI.table([{title:'分类',render:s=>e(surfaceTypes.find(([value])=>value===(s.subtype?s.kind+':'+s.subtype:s.kind))?.[1]||s.kind)},{title:'文件路径',render:s=>'<code>'+e(s.path)+'</code>'}],x.surfaceDeclarations||[],'暂无注入面');

 UI.drawer(x.name,'<div class="ai-detail"><h3 class="ai-section-title">资产信息</h3>'+UI.kvTable([
  ['资产 ID',e(x.id)],['资产名称',e(x.name)],['企业源状态',sourceBadge(x)],['配置版本',e(assetVersionLabel(x))],['负责人',e(x.owner)]
 ])+'<h3 class="ai-section-title">Agent 运行配置</h3>'+UI.kvTable([
  ['镜像引用',e(x.image)],['可执行命令','<code>'+e(x.command[0]||'—')+'</code>'],['启动参数','<code>'+e(x.command.slice(1).join('; ')||'—')+'</code>'],['任务输入协议',e(x.taskInput)],['任务参数标记',e(x.promptFlag||'—')]
 ])+'<h3 class="ai-section-title">文件注入面</h3>'+surfaces+'</div>',UI.btn('关闭',{onclick:'UI.closeDrawer()'})+UI.btn('编辑',{onclick:'App.aiEdit(\''+x.id+'\',\''+x.version+'\')'})+manualMore(x));
}
function assetTable(){
 if(activeTab==='manual')return manualTable();
 const rows=currentRows(),pg=UI.paginate('asset-intake',rows);pageRows=pg.slice;
 const count=selected.size,all=pageRows.length&&pageRows.every(x=>selected.has(key(x)));
 const filters=UI.filters({search:{label:'搜索',id:'ai-search',value:FILTER.query,placeholder:'模型名称、请求标识、API 地址',oninput:'App.aiFilter("query",this.value)'},selects:[{label:'接入状态',id:'ai-status-filter',value:FILTER.status,onchange:'App.aiFilter("status",this.value)',options:[['all','全部状态'],...Object.entries(STATUS).map(([key,[name]])=>[key,name])]}],right:UI.btn('接入模型',{kind:'primary',onclick:"App.aiUpload('model')",ico:'plus'})});
 const bulk='<div class="ai-bulk"><span>已选 <strong>'+count+'</strong> 个模型</span>'+UI.linkBtn('选择全部匹配（'+rows.length+'）',{onclick:'App.aiSelectMatching()'})+UI.linkBtn('仅选待测试',{onclick:'App.aiSelectPending()'})+UI.linkBtn('清空选择',{onclick:'App.aiClearSelection()',disabled:!count})+'<div class="ai-bulk-right">'+UI.btn('测试连通',{onclick:'App.aiValidateSelected()',disabled:!count||batchBusy})+'</div></div>';
 const table=UI.table([
 {title:'<input type="checkbox" aria-label="全选当前页" '+(all?'checked':'')+' onchange="App.aiSelectPage(this.checked)">',raw:true,width:'38px',render:x=>'<input type="checkbox" aria-label="选择 '+e(x.name)+'" '+(selected.has(key(x))?'checked':'')+' onchange="App.aiSelect(\''+x.id+'\',\''+x.version+'\',this.checked)">'},
 {title:'模型名称',render:x=>UI.linkBtn(x.name,{onclick:'App.aiDetail(\''+x.id+'\')'})},
 {title:'请求标识',render:x=>e(x.apiModel)},
 {title:'API 地址',render:x=>'<span class="ai-api-address">'+e(x.baseUrl)+'</span>'},
 {title:'接入状态',width:'100px',render:badge},
 {title:'操作',width:'230px',render:x=>'<div class="row-actions">'+UI.linkBtn('测试连通',{disabled:x.busy,onclick:'App.aiValidate(\''+x.id+'\',\''+x.version+'\')'})+UI.linkBtn('编辑信息',{onclick:'App.aiEdit(\''+x.id+'\')'})+UI.linkBtn('删除',{danger:true,disabled:x.busy,onclick:'App.aiDeleteModel(\''+x.id+'\')'})+'</div>'}
 ],pageRows,'暂无模型，请点击接入模型添加 API 配置。');
 return '<section class="ai-asset-panel ai-model-panel" aria-label="模型接入配置">'+filters+UI.card('',bulk+table+UI.pager(pg,"UI.setPage('asset-intake',{p})"),'',true)+'</section>';
}
function connectionsPanel(){
 const rows=listPlatformConnections();
 return '<section class="ai-connection-panel" aria-label="企业资产平台连接"><div class="ai-connection-toolbar">'+UI.btn('连接资产平台',{kind:'primary',onclick:'App.aiConnectPlatform()',ico:'plus'})+UI.btn('人工上传 →',{kind:'ai-manual-link',onclick:"App.aiTab('manual')"})+'</div>'+UI.card('',UI.table([
  {title:'平台名称',render:x=>'<span class="ai-platform-name">'+UI.linkBtn(x.name,{onclick:'App.aiPlatformDetail(\''+x.id+'\')'})+'</span>'},
  {title:'API 地址',render:x=>'<span class="ai-api-address">'+e((x.endpoint||'').replace(/\/$/,'')+(x.resourcePath||''))+'</span>'},
  {title:'连接状态',width:'110px',render:x=>UI.badge(...(x.state==='error'?['同步异常','red']:x.state==='partial'?['部分成功','amber']:['已连通','green']))},
  {title:'最近同步时间',width:'170px',render:x=>x.lastSyncedAt?e(new Date(x.lastSyncedAt).toLocaleString('zh-CN',{hour12:false})):'—'},
  {title:'操作',width:'210px',render:x=>'<div class="row-actions ai-connection-actions">'+UI.linkBtn('立刻同步',{onclick:'App.aiSyncPlatform(\''+x.id+'\')'})+UI.linkBtn('编辑连接',{onclick:'App.aiConnectPlatform(\''+x.id+'\')'})+'</div>'}
 ],rows,'尚未连接资产平台，点击右上角“连接资产平台”添加连接。'),' ',true)+'</section>';
}
function platformDetail(id){
 const connection=getPlatformConnection(id);if(!connection)return;
 const rows=listPlatformSyncedAssets(id),time=value=>value?e(new Date(value).toLocaleString('zh-CN',{hour12:false})):'—';
 const body='<div class="ai-platform-detail"><div class="ai-platform-overview"><span>已同步资产</span><span>'+rows.length+' 项</span></div>'+UI.table([
  {title:'资产名称/ID',width:'180px',render:x=>e(x.name)+'<div class="ai-subtext">企业 ID：'+e(x.sourceRecordId)+'</div>'},
  {title:'类型',width:'80px',render:x=>x.kind==='agent'?'智能体':'模型'},
  {title:'企业版本',width:'90px',render:x=>e(x.enterpriseVersion||'—')},
  {title:'地址 / 镜像',render:x=>'<span class="ai-api-address">'+e(x.kind==='model'?x.baseUrl:x.image||x.runtimeEndpoint||'—')+'</span>'},
  {title:'企业资产状态',width:'110px',render:x=>UI.badge(x.sourceStatus,({'已发布':'green','未发布':'amber','已停用':'gray'})[x.sourceStatus]||'gray')},
  {title:'最近同步时间',width:'170px',render:x=>time(x.lastSyncedAt)},
 ],rows,'尚未同步资产。')+'</div>';
 UI.drawer(connection.name,body,UI.btn('关闭',{onclick:'UI.closeDrawer()'}));
 document.querySelector('#drawer .drawer')?.classList.add('ai-platform-drawer');
}
export function assetIntakePage(options={}){
 if(options.tab)selectIntakeTab(options.tab);
 const tabs='<div class="ai-tabs" role="tablist" aria-label="资产接入方式">'+TABS.map(([id,label])=>'<button type="button" role="tab" aria-selected="'+(id===activeTab)+'" class="'+(id===activeTab?'active':'')+'" onclick="App.aiTab(\''+id+'\')">'+label+'</button>').join('')+'</div>';
 return UI.pageHead('资产接入')+tabs+(activeTab==='connection'?connectionsPanel():assetTable());
}
function renderPlatformCatalog(){
 const connection=getPlatformConnection(catalogConnectionId);if(!connection)return;const rows=platformCatalog(catalogConnectionId);
 const bulk='<div class="ai-bulk"><span>已选 '+catalogSelection.size+' 项</span>'+UI.linkBtn('全选',{onclick:'App.aiPlatformSelectAll()'})+UI.linkBtn('清空',{onclick:'App.aiPlatformClear()'})+'</div>';
 UI.modal('选择资产导入 · '+connection.name,bulk+UI.table([
  {title:'选择',width:'50px',render:x=>'<input type="checkbox" aria-label="导入 '+e(x.name)+'" '+(catalogSelection.has(x.id)?'checked':'')+' onchange="App.aiPlatformSelect(\''+x.id+'\',this.checked)">'},
  {title:'资产名称',render:x=>e(x.name)+'<div class="ai-subtext">'+e(x.sourceRecordId)+'</div>'},{title:'类型',render:x=>typeName(x.kind)},
  {title:'来源',render:x=>e(x.source)},{title:'导入状态',render:x=>UI.badge(x.imported?'已导入':'待导入',x.imported?'green':'gray')},
  {title:'操作',render:x=>UI.linkBtn(x.imported?'同步配置':'导入',{onclick:'App.aiImportPlatformRow(\''+x.id+'\')'})}
 ],rows),UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('导入所选（'+catalogSelection.size+'）',{kind:'primary',onclick:'App.aiImportPlatformSelection()',disabled:!catalogSelection.size}),{wide:true,cls:'ai-modal ai-import-modal'});
}
function finishPlatformImport(ids){
 try{const result=importPlatformAssets(catalogConnectionId,ids);catalogSelection.clear();renderPlatformCatalog();refresh();UI.toast('已导入 '+result.imported.length+' 项'+(result.addedDependencies.length?'（含关联基座模型）':'')+(result.errors.length?'；'+result.errors.length+' 项需修正':''));}catch(error){message(error);}
}
function checkBlock(x){const v=x.validation,done=v.steps.filter(s=>s.state==='passed').length;return'<div class="ai-verify-header">'+badge(x)+'<span>'+(x.busy?done+' / '+v.steps.length+' 步完成':v.checkedAt?'最近检查 '+new Date(v.checkedAt).toLocaleString('zh-CN',{hour12:false}):'尚未进行连通检查')+'</span></div>'+(v.steps.length?'<ol class="ai-checks">'+v.steps.map(s=>'<li class="'+s.state+'"><span class="ai-check-icon">'+(s.state==='passed'?'✓':s.state==='failed'?'!':s.state==='running'?'…':'·')+'</span><div><strong>'+e(s.name)+'</strong><p>'+e(s.detail)+'</p></div></li>').join('')+'</ol>':'<div class="ai-empty">检查配置、连接和最小响应，连通后可用于演练。</div>');}
function detail(id,version){
 const asset=getAsset(id,version);if(!asset)return;
 detailKey=key(asset);
 if(asset.kind==='agent')return agentDetail(asset);
 modelDetail(id,{onEdit:()=>actions.aiEdit(id),onDelete:()=>actions.aiDeleteModel(id),onTest:()=>actions.aiValidate(id,asset.version)});
}
function manualExample(){return ASSET_IMPORT_EXAMPLE.filter(x=>x.kind==='agent').map(({baseModelId,baseModelVersion,source,...x})=>({...x,enterpriseVersion:'1.0.0'}));}
function openImport(){preview=[];UI.modal('批量上传 Agent','<div class="ai-import"><div class="ai-import-file-section"><div class="ai-import-heading"><label for="ai-import-file">上传 JSON / CSV</label><div class="ai-import-heading-actions">'+UI.linkBtn('JSON 模板',{onclick:"App.aiTemplate('json')"})+UI.linkBtn('CSV 模板',{onclick:"App.aiTemplate('csv')"})+'</div></div><div class="ai-import-tools"><input id="ai-import-file" type="file" accept=".json,.csv" onchange="App.aiReadFile(this)"></div></div><div class="ai-import-paste"><div class="ai-import-paste-heading ai-import-heading"><label for="ai-import-content">或粘贴清单内容</label>'+UI.linkBtn('填入示例',{onclick:'App.aiFillExample()'})+'</div><textarea id="ai-import-content" class="ai-code" rows="8" oninput="App.aiResetPreview()" placeholder="带稳定 id 的 JSON 数组或 CSV"></textarea></div><p id="ai-import-error" class="ai-error" role="alert"></p><div id="ai-import-preview"></div></div>',UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('校验预览',{onclick:'App.aiPreview()'})+'<button id="ai-import-confirm" class="btn w-lg primary" disabled onclick="App.aiConfirmImport()">导入有效行</button>',{wide:true,cls:'ai-modal ai-import-modal'});}

async function runCheck(id,version){const x=getAsset(id,version);if(!x)return;const originRoute=routeKey();detail(id,x.version);try{const result=await validateAsset(id,{version:x.version,onProgress:a=>{if(detailKey===key(a)&&document.getElementById('drawer')?.classList.contains('open')){const host=document.getElementById('ai-verification');if(host)host.innerHTML=checkBlock(a);}}});const open=detailKey===key(x)&&document.getElementById('drawer')?.classList.contains('open');if(routeKey()===originRoute){if(!document.getElementById('drawer')?.classList.contains('open')||open)refresh();if(open)detail(id,x.version);}UI.toast(result.status==='ready'?'连通测试通过（本地模拟）':'连通测试失败，请查看配置');}catch(error){message(error);}}
export const actions={
 aiTab(tab){selectIntakeTab(tab);selected.clear();Object.assign(FILTER,{kind:'all',status:'all',sourceStatus:'all',query:''});UI.resetPage('asset-intake');refresh();},
 aiPlatformDetail:platformDetail,
 aiConnectPlatform(id){activeTab='connection';router.nav('platform',id?'connection-edit':'connection-create',id||'');},
 aiSyncPlatform(id){try{const result=syncPlatformConnection(id);refresh();UI.toast('同步完成：'+result.imported.length+' 项资产'+(result.errors.length?'；'+result.errors.length+' 项需修正':''));}catch(error){message(error);}},

 aiPlatformCatalog(id){catalogConnectionId=id;catalogSelection.clear();renderPlatformCatalog();},
 aiPlatformSelect(id,checked){checked?catalogSelection.add(id):catalogSelection.delete(id);renderPlatformCatalog();},
 aiPlatformSelectAll(){platformCatalog(catalogConnectionId).forEach(row=>catalogSelection.add(row.id));renderPlatformCatalog();},
 aiPlatformClear(){catalogSelection.clear();renderPlatformCatalog();},
 aiImportPlatformRow(id){finishPlatformImport([id]);},
 aiImportPlatformSelection(){finishPlatformImport([...catalogSelection]);},
 aiUpload(kind='agent'){UI.closeModal();if(kind==='agent'){activeTab='manual';return openAgentIntake();}activeTab='models';return openModelIntake({onSaved:()=>{selected.clear();refresh();}});},
 aiEdit(id,version){const asset=getAsset(id,version);if(!asset)return;if(asset.kind==='agent'){activeTab='manual';UI.closeDrawer();return openAgentIntake({id,version:asset.version,mode:asset.immutable?'connection':'edit'});}activeTab='models';openModelIntake({id,onSaved:()=>{selected.clear();refresh();}});},
 aiNewVersion(id,version){const asset=getAsset(id,version);if(!asset)return;if(asset.kind==='model')return actions.aiEdit(id);activeTab='manual';UI.closeDrawer();openAgentIntake({id,version:asset.version,mode:'new-version'});},
 aiDeleteModel(id){const asset=listModelResources().find(row=>row.id===id);if(!asset)return;UI.modal('删除模型','<p>确认删除 '+e(asset.name)+'？</p>',UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('删除',{kind:'danger',onclick:"App.aiConfirmDeleteModel('"+id+"')"}));},
 aiConfirmDeleteModel(id){try{deleteModelResource(id);for(const value of [...selected])if(splitKey(value)[0]===id)selected.delete(value);UI.closeModal();if(detailKey.startsWith(id+'@'))UI.closeDrawer();refresh();UI.toast('已删除模型');}catch(error){message(error);}},
 aiFilter(k,v){if(activeTab==='connection')activeTab='manual';FILTER[k]=v;UI.resetPage('asset-intake');refresh();if(k==='query'){const x=document.getElementById('ai-search');x?.focus();x?.setSelectionRange(v.length,v.length);}},

 aiDeleteAgent(id,version){
  const reason=manualAgentDeleteError(id,version);if(reason)return UI.toast(reason);
  const asset=getAsset(id,version);
  UI.modal('删除资产配置','<p>确认删除 '+e(asset.name)+' · '+e(assetVersionLabel(asset))+'？</p>',UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('删除',{kind:'danger',onclick:"App.aiConfirmDeleteAgent('"+id+"','"+version+"')"}));
 },
 aiConfirmDeleteAgent(id,version){try{deleteManualAgent(id,version);selected.delete(key({id,version}));UI.closeModal();if(detailKey===key({id,version}))UI.closeDrawer();refresh();UI.toast('已删除资产配置');}catch(error){message(error);}},
 aiChooseVersion(id,version){selectAssetVersion(id,version);refresh();},
 aiSelect(id,version,checked){checked?selected.add(id+'@'+version):selected.delete(id+'@'+version);refresh();},
 aiSelectPage(checked){pageRows.forEach(x=>checked?selected.add(key(x)):selected.delete(key(x)));refresh();},
 aiSelectMatching(){currentRows().forEach(x=>selected.add(key(x)));refresh();},
 aiSelectPending(){selected.clear();currentRows().filter(x=>x.status==='pending'&&!x.busy).forEach(x=>selected.add(key(x)));refresh();},
 aiClearSelection(){selected.clear();refresh();},
 aiDetail:detail,aiValidate:runCheck,
 async aiValidateSelected(){if(batchBusy)return;const originRoute=routeKey();const rows=selectedAssets().filter(x=>!x.busy).sort((a,b)=>(a.kind==='model'?0:1)-(b.kind==='model'?0:1));if(!rows.length)return UI.toast('请选择需要测试的模型');batchBusy=true;UI.modal('测试连通','<div id="ai-batch-progress"></div>',UI.btn('关闭',{onclick:'UI.closeModal()'}),{wide:true,cls:'ai-modal'});let passed=0;const update=()=>{const host=document.getElementById('ai-batch-progress');if(host)host.innerHTML=UI.table([{title:'模型名称',render:x=>e(x.name)},{title:'状态',render:badge},{title:'当前步骤',render:x=>e(x.validation.steps.find(s=>['running','failed'].includes(s.state))?.name||(x.status==='ready'?'全部通过':'等待检查'))}],rows.map(x=>getAsset(x.id,x.version)));};update();try{for(const row of rows){const x=await validateAsset(row.id,{version:row.version,onProgress:update});if(x.status==='ready')passed++;}selected.clear();if(routeKey()===originRoute&&!document.getElementById('drawer')?.classList.contains('open'))refresh();UI.toast('测试完成：'+passed+' 项已连通，'+(rows.length-passed)+' 项连通失败');}catch(error){message(error);}finally{batchBusy=false;}},
 aiVersion(id,version){const x=getAssetSnapshot(id,version);if(!x)return;UI.modal(x.name+' · '+x.version+' 快照','<pre class="ai-snapshot">'+e(JSON.stringify(x,null,2))+'</pre>',UI.btn('关闭',{onclick:'UI.closeModal()'})+UI.btn('导出快照',{onclick:'App.aiExport(\''+id+'\',\''+version+'\')'}),{wide:true,cls:'ai-modal'});},
 aiExport(id,version){const x=getAssetSnapshot(id,version);if(x)UI.download(id+'-'+x.version+'.json',JSON.stringify(x,null,2));},
 aiImport(){activeTab='manual';openImport();},
 aiTemplate(format){if(format==='json')return UI.download('Agent配置模板.json',JSON.stringify(manualExample(),null,2));const fields=['id','kind','name','enterpriseVersion','owner','sourceStatus','image','command','taskInput','promptFlag','surfaceDeclarations'];const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';UI.download('Agent配置模板.csv','\uFEFF'+fields.join(',')+'\r\n'+manualExample().map(x=>fields.map(k=>quote(Array.isArray(x[k])?JSON.stringify(x[k]):x[k])).join(',')).join('\r\n'));},
 aiFillExample(){document.getElementById('ai-import-content').value=JSON.stringify(manualExample(),null,2);actions.aiResetPreview();},
 async aiReadFile(input){const file=input.files?.[0];if(!file)return;if(file.size>5*1024*1024){document.getElementById('ai-import-error').textContent='清单文件请控制在 5 MB 内';return;}document.getElementById('ai-import-content').value=await file.text();actions.aiResetPreview();actions.aiPreview();},
 aiResetPreview(){preview=[];document.getElementById('ai-import-preview').innerHTML='';document.getElementById('ai-import-error').textContent='';document.getElementById('ai-import-confirm').disabled=true;},
 aiPreview(){try{const content=val('ai-import-content'),rows=parseAssetImport(content,content.startsWith('[')||content.startsWith('{')?'json':'csv');if(!rows.length||rows.length>1000)throw Error('单次请上传 1—1000 项资产');const agentPreview=previewManualAgents(rows.filter(row=>row.kind==='agent'));let agentIndex=0;preview=rows.map((raw,index)=>raw.kind==='agent'?{...agentPreview[agentIndex++],row:index+1}:{row:index+1,id:String(raw.id??''),data:raw,raw,operation:'不支持',errors:['人工上传仅支持 Agent；模型请前往模型接入配置']});const valid=preview.filter(x=>!x.errors.length).length;document.getElementById('ai-import-error').textContent='';document.getElementById('ai-import-preview').innerHTML='<div class="ai-preview-summary">'+UI.badge(valid+' 项可导入','green')+UI.badge((rows.length-valid)+' 项需修正',valid===rows.length?'gray':'red')+'</div>'+UI.table([{title:'行',width:'42px',key:'row'},{title:'ID / 名称',render:x=>e(x.id)+'<div class="ai-subtext">'+e(x.data.name)+'</div>'},{title:'处理方式',width:'110px',key:'operation'},{title:'校验结果',render:x=>x.errors.length?'<span class="ai-error">'+e(x.errors.join('；'))+'</span>':UI.badge('配置通过','green')}],preview);document.getElementById('ai-import-confirm').disabled=!valid;}catch(error){preview=[];document.getElementById('ai-import-error').textContent=error.message;document.getElementById('ai-import-preview').innerHTML='';document.getElementById('ai-import-confirm').disabled=true;}},
 aiConfirmImport(){if(!preview.length)return;const result=importManualAgents(preview.filter(x=>!x.errors.length).map(x=>x.raw));preview=[];UI.closeModal();selected.clear();FILTER.status='all';FILTER.kind='all';FILTER.query='';FILTER.sourceStatus='all';UI.resetPage('asset-intake');refresh();UI.toast('已导入 '+result.imported.length+' 项，其中 '+result.changed.length+' 项新增或更新'+(result.errors.length?'；'+result.errors.length+' 项失败':''));}
};
