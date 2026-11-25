import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import { listModelResources, deleteModelResource, getAsset, getAssetSnapshot, selectAssetVersion, validateAsset, assetVersionLabel, manualAgentDeleteError, deleteManualAgent, listPlatformConnections, getPlatformConnection } from '../domain/asset-intake.js';
import { syncPlatformConnection, connectionRecords, newConnectionDraft } from '../domain/platform-connection.js';
import { openPlatformConnection } from './platform-connection.js';
import { openPlatformSyncPicker, platformSyncPickerActions } from './platform-sync-picker.js';
import * as Applications from '../domain/application-assets.js';
import { openAgentIntake } from './agent-intake.js';
import { openModelIntake, modelDetail } from './model-intake.js';
const TABS=[['connection','企业资产平台'],['manual','资产目录'],['models','模型配置']];
let activeTab='connection';
export function selectIntakeTab(tab){if(TABS.some(([id])=>id===tab))activeTab=tab;}
const FILTER={kind:'all',status:'all',sourceStatus:'all',source:'all',addressType:'all',query:''},selected=new Set();
const STATUS={pending:['待测试','amber'],ready:['已连通','green'],failed:['连通失败','red']};
const e=UI.esc, val=id=>document.getElementById(id)?.value?.trim()||'';
const routeKey=()=>{const r=router.state();return [r.page,r.sub,r.param||''].join('/');};
const key=x=>x.id+'@'+x.version, refresh=()=>router.nav(router.state().page==='platform'?'platform':'assets','intake'), message=error=>UI.toast(error.message||String(error));
let preview=[],pageRows=[],batchBusy=false,detailKey='';
const badge=x=>x.sourceStatus==='已停用'?UI.badge('源已停用','gray'):x.busy?UI.badge('检查中','blue'):UI.badge(...STATUS[x.status]);
const surfaceTypes=[['instruction','指令文件'],['rule','规则文件'],['skill','技能文件'],['command','命令文件'],['memory:long_term','长期记忆'],['memory:conversation','会话历史'],['memory:task_state','任务状态'],['configuration','配置文件']];
function splitKey(value){const index=value.lastIndexOf('@');return[value.slice(0,index),value.slice(index+1)];}
function selectedAssets(){return[...selected].map(x=>getAsset(...splitKey(x))).filter(Boolean);}
function currentRows(){
 if(activeTab==='models'){const query=FILTER.query.trim().toLowerCase();return [...listModelResources()].reverse().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).filter(x=>(FILTER.status==='all'||x.status===FILTER.status)&&(!query||[x.name,x.apiModel,x.baseUrl].join(' ').toLowerCase().includes(query)));}
 return Applications.listApplicationAssets({query:FILTER.query,sourceStatus:FILTER.sourceStatus,source:FILTER.source,addressType:FILTER.addressType});
}
function manualMore(x){return UI.moreMenu([
 ['新版本',"App.aiNewVersion('"+x.id+"','"+x.version+"')"],
 ['删除',"App.aiDeleteAgent('"+x.id+"','"+x.version+"')",{danger:true,disabled:Boolean(manualAgentDeleteError(x.id,x.version))}]
]);}
const sourceBadge=x=>UI.badge(x.sourceStatus,({'已发布':'green','未发布':'amber','已停用':'gray'})[x.sourceStatus]||'gray');
const displayTime=value=>value?e(new Date(value).toLocaleString('zh-CN',{hour12:false})):'—';
const call=(name,...args)=>e('App.'+name+'('+args.map(x=>JSON.stringify(x)).join(',')+')');
const applicationAddress=x=>'<span class="ai-address-value" title="'+e(x.address)+'">'+e(x.address||'—')+'</span>';
function applicationColumns({actions:withActions=true,source=true}={}){
 const columns=[
  {title:'资产名称',width:'180px',render:x=>withActions?UI.linkBtn(x.name,{onclick:call('aaDetail',x.id)}):e(x.name)},
  {title:'资产 ID',width:'150px',render:x=>'<span class="ai-asset-id" title="'+e(x.assetId)+'">'+e(x.assetId)+'</span>'},
  ...(source?[{title:'来源',width:'140px',render:x=>e(x.sourceName)}]:[]),
  {title:'版本',width:'90px',render:x=>e(x.enterpriseVersion)},
  {title:'发布状态',width:'120px',render:sourceBadge},
  {title:'地址类型',width:'110px',render:x=>e(Applications.applicationAddressTypeLabel(x.addressType))},
  {title:'资产地址',width:'220px',render:applicationAddress},
  {title:'更新时间',width:'160px',render:x=>displayTime(x.sourceUpdatedAt||x.updatedAt)},
 ];
 if(withActions)columns.push({title:'操作',width:'155px',render:x=>'<div class="row-actions">'+UI.linkBtn('详情',{onclick:call('aaDetail',x.id)})+UI.linkBtn('编辑',{onclick:call('aaEdit',x.id),disabled:Boolean(x.platformConnectionId),title:x.platformConnectionId?'平台同步资产由来源平台维护':''})+UI.linkBtn('删除',{danger:true,onclick:call('aaDelete',x.id)})+'</div>'});
 return columns;
}
function manualTable(){
 const rows=currentRows(),pg=UI.paginate('asset-intake',rows);
 const sources=new Map(listPlatformConnections().map(x=>[x.id,x.name]));
 Applications.listApplicationAssets().forEach(x=>{if(x.platformConnectionId)sources.set(x.platformConnectionId,x.sourceName);});
 const filters=UI.filters({search:{label:'搜索',id:'ai-search',value:FILTER.query,placeholder:'资产名称、ID、地址',oninput:'App.aiFilter("query",this.value)'},selects:[
  {label:'来源',id:'ai-source-filter',value:FILTER.source,onchange:'App.aiFilter("source",this.value)',options:[['all','全部来源'],['manual','手动上传'],...sources]},
  {label:'地址类型',id:'ai-address-type-filter',value:FILTER.addressType,onchange:'App.aiFilter("addressType",this.value)',options:[['all','全部类型'],...Applications.APPLICATION_ADDRESS_TYPES.map(x=>[x.value,x.label])]},
  {label:'发布状态',id:'ai-publish-filter',value:FILTER.sourceStatus,onchange:'App.aiFilter("sourceStatus",this.value)',options:[['all','全部状态'],...[...new Set(['未发布','已发布','已下架','已停用',...Applications.listApplicationAssets().map(x=>x.sourceStatus)])].map(value=>[value,value])]}
 ],right:'<div class="ai-filter-actions">'+UI.btn('从平台同步',{onclick:'App.aiSyncFromPlatforms()'})+'<span class="ai-upload-menu">'+UI.moreMenu([['登记资产',"App.aiUpload('agent')"],['批量导入 CSV','App.aiImport()']],'手动上传').replace('class="link-btn"','class="btn w-lg primary" aria-haspopup="true"')+'</span></div>'});
 return '<section class="ai-asset-panel ai-manual-panel" aria-label="资产目录">'+filters+UI.card('',UI.table(applicationColumns(),pg.slice,'暂无匹配资产，可从平台同步或手动上传。')+UI.pager(pg,"UI.setPage('asset-intake',{p})"),'',true)+'</section>';
}
let applicationEditorId='',applicationDetailId='',platformDrawerId='',importContent='',applicationDetailParent=null;
const stackedDrawerHosts=new WeakSet();
function closeApplicationDetail(){
 const host=document.getElementById('drawer'),parent=applicationDetailParent;
 applicationDetailParent=null;applicationDetailId='';
 if(!parent||!host.contains(parent.node)){UI.closeDrawer();return;}
 parent.node.classList.remove('ai-drawer-parent');parent.node.removeAttribute('inert');parent.node.removeAttribute('aria-hidden');parent.node.setAttribute('aria-modal','true');
 host.replaceChildren(parent.node);host.classList.add('open');platformDrawerId=parent.platformId;
 parent.node.querySelector('.modal-body').scrollTop=parent.scrollTop;parent.node.querySelector('.table-wrap').scrollLeft=parent.scrollLeft;
 if(parent.focus?.isConnected)parent.focus.focus();
}
function bindStackedDrawer(host){
 if(stackedDrawerHosts.has(host))return;stackedDrawerHosts.add(host);
 host.addEventListener('click',event=>{if(event.target===host&&applicationDetailParent&&host.querySelector('.ai-asset-detail-drawer')){event.stopImmediatePropagation();closeApplicationDetail();}},true);
 host.addEventListener('keydown',event=>{if(event.key==='Escape'&&applicationDetailParent&&host.querySelector('.ai-asset-detail-drawer')&&!document.getElementById('modal')?.classList.contains('open')){event.preventDefault();event.stopPropagation();closeApplicationDetail();}});
}
function applicationDetail(id){
 const x=Applications.getApplicationAsset(id);if(!x)return UI.toast('资产不存在或已删除');
 const host=document.getElementById('drawer'),parent=host.classList.contains('open')?host.querySelector(':scope > .ai-platform-drawer:not(.ai-drawer-parent)'):null;
 applicationDetailParent=parent?{node:parent,platformId:platformDrawerId,scrollTop:parent.querySelector('.modal-body').scrollTop,scrollLeft:parent.querySelector('.table-wrap').scrollLeft,focus:document.activeElement}:null;
 applicationDetailId=id;if(!parent)platformDrawerId='';
 UI.drawer(x.name,'<div class="ai-detail">'+UI.kvTable([
  ['资产名称',e(x.name)],['资产 ID',e(x.assetId)],['地址类型',e(Applications.applicationAddressTypeLabel(x.addressType))],['资产地址',applicationAddress(x)],['来源',e(x.sourceName)],['版本',e(x.enterpriseVersion)],['发布状态',sourceBadge(x)],['更新时间',displayTime(x.sourceUpdatedAt||x.updatedAt)]
 ])+'</div>',UI.btn('关闭',{onclick:'App.aaCloseDetail()'})+(!x.platformConnectionId?UI.btn('编辑信息',{onclick:call('aaEdit',id)}):''));
 const detail=host.querySelector('.drawer');detail.classList.add('ai-asset-detail-drawer');detail.querySelector('.modal-head .icon-btn').setAttribute('onclick','App.aaCloseDetail()');
 if(parent){parent.classList.add('ai-drawer-parent');parent.setAttribute('inert','');parent.setAttribute('aria-hidden','true');parent.removeAttribute('aria-modal');host.append(parent);bindStackedDrawer(host);detail.querySelector('.modal-head .icon-btn').focus();}
}
function openApplicationEditor(id){
 const x=id?Applications.getApplicationAsset(id):null;
 if(id&&!x)return UI.toast('资产不存在或已删除');
 if(x?.platformConnectionId)return UI.toast('平台同步资产由来源平台维护');
 applicationEditorId=id||'';applicationDetailId='';platformDrawerId='';applicationDetailParent=null;
 const field=(key,label,value,extra='')=>'<label class="field" for="aa-'+key+'"><span>'+label+'</span><input id="aa-'+key+'" value="'+e(value||'')+'" '+extra+'></label>';
 const statuses=[...new Set(['未发布','已发布','已下架','已停用',...(x?[x.sourceStatus]:[])])];
 UI.drawer(x?'编辑资产信息':'登记资产','<form class="ai-form aa-form" onsubmit="event.preventDefault();App.aaSave()"><div class="ai-form-grid">'+
  field('name','资产名称 *',x?.name,'required placeholder="例如：业务智能体1镜像"')+
  field('assetId','资产 ID',x?.assetId,'placeholder="留空自动生成" '+(x?'readonly':''))+
  field('enterpriseVersion','版本 *',x?.enterpriseVersion,'required placeholder="例如：1.0.0"')+
  '<label class="field" for="aa-sourceStatus"><span>发布状态 *</span><select id="aa-sourceStatus">'+statuses.map(v=>'<option '+(v===(x?.sourceStatus||'未发布')?'selected':'')+'>'+e(v)+'</option>').join('')+'</select></label></div>'+
  '<label class="field" for="aa-addressType"><span>地址类型 *</span><select id="aa-addressType" required onchange="App.aaAddressType(this.value)"><option value="">请选择地址类型</option>'+Applications.APPLICATION_ADDRESS_TYPES.map(type=>'<option value="'+type.value+'" '+(type.value===x?.addressType?'selected':'')+'>'+e(type.label)+'</option>').join('')+'</select></label>'+
  field('address','资产地址 *',x?.address,'required placeholder="'+e(addressExample(x?.addressType))+'"')+
  '<p id="aa-error" class="ai-error" role="alert"></p></form>',UI.btn('取消',{onclick:'UI.closeDrawer()'})+UI.btn('保存',{kind:'primary',onclick:'App.aaSave()'}));
 document.querySelector('#drawer .drawer')?.classList.add('aa-editor-drawer');
}
function addressExample(type){return({git:'例如：https://github.com/team/application.git',image:'例如：registry.example.com/team/application:1.0.0',package:'例如：https://artifacts.example.com/application.zip',object:'例如：s3://bucket/application.zip',other:'填写资产内容的获取地址'})[type]||'请先选择地址类型，再填写获取地址';}

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
 const filters=UI.filters({search:{label:'搜索',id:'ai-search',value:FILTER.query,placeholder:'模型名称、模型标识、API 地址',oninput:'App.aiFilter("query",this.value)'},selects:[{label:'接入状态',id:'ai-status-filter',value:FILTER.status,onchange:'App.aiFilter("status",this.value)',options:[['all','全部状态'],...Object.entries(STATUS).map(([key,[name]])=>[key,name])]}],right:UI.btn('测试连通',{onclick:'App.aiValidateSelected()',disabled:!count||batchBusy})+UI.btn('接入模型',{kind:'primary',onclick:"App.aiUpload('model')",ico:'plus'})});

 const table=UI.table([
 {title:'<input type="checkbox" aria-label="全选当前页" '+(all?'checked':'')+' onchange="App.aiSelectPage(this.checked)">',raw:true,width:'38px',render:x=>'<input type="checkbox" aria-label="选择 '+e(x.name)+'" '+(selected.has(key(x))?'checked':'')+' onchange="App.aiSelect(\''+x.id+'\',\''+x.version+'\',this.checked)">'},
 {title:'模型名称',render:x=>UI.linkBtn(x.name,{onclick:'App.aiDetail(\''+x.id+'\')'})},
 {title:'模型标识',render:x=>e(x.apiModel)},
 {title:'API 地址',render:x=>'<span class="ai-api-address">'+e(x.baseUrl)+'</span>'},
 {title:'接入状态',width:'100px',render:badge},
 {title:'操作',width:'230px',render:x=>'<div class="row-actions">'+UI.linkBtn('测试连通',{disabled:x.busy,onclick:'App.aiValidate(\''+x.id+'\',\''+x.version+'\')'})+UI.linkBtn('编辑信息',{onclick:'App.aiEdit(\''+x.id+'\')'})+UI.linkBtn('删除',{danger:true,disabled:x.busy,onclick:'App.aiDeleteModel(\''+x.id+'\')'})+'</div>'}
 ],pageRows,'暂无模型，请点击接入模型添加 API 配置。');
 return '<section class="ai-asset-panel ai-model-panel" aria-label="模型配置">'+filters+UI.card('',table+UI.pager(pg,"UI.setPage('asset-intake',{p})"),'',true)+'</section>';
}
function connectionBadge(x){return UI.badge(...(x.state==='error'?['连接异常','red']:x.state==='partial'?['部分成功','amber']:x.state==='connected'?['已连通','green']:['未连通','gray']));}
function connectionsPanel(){
 const rows=[...listPlatformConnections()].reverse().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 return '<section class="ai-connection-panel" aria-label="企业资产平台"><div class="ai-connection-toolbar">'+UI.btn('连接资产平台',{kind:'primary',onclick:'App.aiConnectPlatform()',ico:'plus'})+'</div>'+UI.card('',UI.table([
  {title:'平台名称',render:x=>'<span class="ai-platform-name">'+UI.linkBtn(x.name,{onclick:call('aiPlatformDetail',x.id)})+'</span>'},
  {title:'API 地址',render:x=>'<span class="ai-api-address">'+e((x.endpoint||'').replace(/\/$/,'')+(x.resourcePath||''))+'</span>'},
  {title:'连接状态',width:'100px',render:connectionBadge},
  {title:'最近同步时间',width:'160px',render:x=>displayTime(x.lastSyncedAt)},
  {title:'操作',width:'230px',render:x=>'<div class="row-actions ai-connection-actions">'+UI.linkBtn('立即同步',{onclick:call('aiSyncPlatform',x.id),disabled:x.state!=='connected',title:x.state!=='connected'?'请先恢复平台连接':''})+UI.linkBtn('资产目录',{onclick:call('aiPlatformAssets',x.id)})+UI.linkBtn('编辑连接',{onclick:call('aiConnectPlatform',x.id)})+'</div>'}
 ],rows,'尚未连接资产平台，点击右上角“连接资产平台”添加连接。'),' ',true)+'</section>';
}
function platformDetail(id){
 const x=getPlatformConnection(id);if(!x)return;
 applicationDetailId='';platformDrawerId='';applicationDetailParent=null;
 UI.drawer(x.name,'<div class="ai-detail">'+UI.kvTable([
  ['平台名称',e(x.name)],['API 地址','<span class="ai-api-address">'+e((x.endpoint||'').replace(/\/$/,'')+(x.resourcePath||''))+'</span>'],
  ['密钥',x.credentialConfigured?'已配置':'未配置'],['连接状态',connectionBadge(x)],['最近同步时间',displayTime(x.lastSyncedAt)]
 ])+'</div>',UI.btn('关闭',{onclick:'UI.closeDrawer()'}));
}
function platformAssets(id){
 const connection=getPlatformConnection(id);if(!connection)return;
 applicationDetailId='';platformDrawerId=id;applicationDetailParent=null;
 const rows=Applications.listApplicationAssets({source:id}),pg=UI.paginate('platform-assets-'+id,rows);
 UI.drawer(connection.name+' · 资产目录','<div class="ai-platform-detail">'+UI.table(applicationColumns({source:false}),pg.slice,'尚未同步资产，请先点击“立即同步”。')+UI.pager(pg,'App.aiPlatformAssetPage('+JSON.stringify(id)+',{p})')+'</div>',UI.btn('关闭',{onclick:'UI.closeDrawer()'}));
 document.querySelector('#drawer .drawer')?.classList.add('ai-platform-drawer');
}

export function assetIntakePage(options={}){
 if(options.tab)selectIntakeTab(options.tab);
 const tabs='<div class="ai-tabs" role="tablist" aria-label="资产接入方式">'+TABS.map(([id,label])=>'<button type="button" role="tab" aria-selected="'+(id===activeTab)+'" class="'+(id===activeTab?'active':'')+'" onclick="App.aiTab(\''+id+'\')">'+label+'</button>').join('')+'</div>';
 return UI.pageHead('资产接入')+tabs+(activeTab==='connection'?connectionsPanel():assetTable());
}
function checkBlock(x){const v=x.validation,done=v.steps.filter(s=>s.state==='passed').length;return'<div class="ai-verify-header">'+badge(x)+'<span>'+(x.busy?done+' / '+v.steps.length+' 步完成':v.checkedAt?'最近检查 '+new Date(v.checkedAt).toLocaleString('zh-CN',{hour12:false}):'尚未进行连通检查')+'</span></div>'+(v.steps.length?'<ol class="ai-checks">'+v.steps.map(s=>'<li class="'+s.state+'"><span class="ai-check-icon">'+(s.state==='passed'?'✓':s.state==='failed'?'!':s.state==='running'?'…':'·')+'</span><div><strong>'+e(s.name)+'</strong><p>'+e(s.detail)+'</p></div></li>').join('')+'</ol>':'<div class="ai-empty">检查配置、连接和最小响应，连通后可用于演练。</div>');}
function detail(id,version){
 const asset=getAsset(id,version);if(!asset)return;
 detailKey=key(asset);
 if(asset.kind==='agent')return agentDetail(asset);
 modelDetail(id,{onEdit:()=>actions.aiEdit(id),onDelete:()=>actions.aiDeleteModel(id),onTest:()=>actions.aiValidate(id,asset.version)});
}
function openImport(){
 preview=[];importContent='';
 UI.modal('批量导入资产','<div class="ai-import"><div class="ai-import-file-section"><div class="ai-import-heading"><label for="ai-import-file">上传 CSV 文件</label>'+UI.linkBtn('下载 CSV 模板',{onclick:'App.aiTemplate()'})+'</div><div class="ai-import-tools"><input id="ai-import-file" type="file" accept=".csv,text/csv" onchange="App.aiReadFile(this)"></div></div><p id="ai-import-error" class="ai-error" role="alert"></p><div id="ai-import-preview"></div></div>',UI.btn('取消',{onclick:'UI.closeModal()'})+'<button id="ai-import-confirm" class="btn w-md primary" disabled onclick="App.aiConfirmImport()">确认导入</button>',{wide:true,cls:'ai-modal ai-import-modal'});
}
function renderImportPreview(){
 try{
  preview=Applications.previewApplicationCsv(importContent);
  const valid=preview.filter(x=>!x.errors.length).length;
  document.getElementById('ai-import-error').textContent='';
  document.getElementById('ai-import-preview').innerHTML='<div class="ai-preview-summary">'+UI.badge(valid+' 项可导入','green')+UI.badge((preview.length-valid)+' 项需修正',valid===preview.length?'gray':'red')+'</div>'+UI.table([
   {title:'行',width:'42px',key:'row'},{title:'资产名称',render:x=>e(x.data?.name||'—')},{title:'资产 ID',render:x=>e(x.data?.assetId||'—')},{title:'地址类型',render:x=>e(Applications.applicationAddressTypeLabel(x.data?.addressType))},
   {title:'资产地址',render:x=>e(x.data?.address||'—')},{title:'处理结果',render:x=>x.errors.length?'<span class="ai-error">'+e(x.errors.join('；'))+'</span>':e(x.operation)}
  ],preview);
  document.getElementById('ai-import-confirm').disabled=!valid;
 }catch(error){preview=[];document.getElementById('ai-import-error').textContent=error.message;document.getElementById('ai-import-preview').innerHTML='';document.getElementById('ai-import-confirm').disabled=true;}
}

async function runCheck(id,version){const x=getAsset(id,version);if(!x)return;const originRoute=routeKey();detail(id,x.version);try{const result=await validateAsset(id,{version:x.version,onProgress:a=>{if(detailKey===key(a)&&document.getElementById('drawer')?.classList.contains('open')){const host=document.getElementById('ai-verification');if(host)host.innerHTML=checkBlock(a);}}});const open=detailKey===key(x)&&document.getElementById('drawer')?.classList.contains('open');if(routeKey()===originRoute){if(!document.getElementById('drawer')?.classList.contains('open')||open)refresh();if(open)detail(id,x.version);}UI.toast(result.status==='ready'?'连通测试通过（本地模拟）':'连通测试失败，请查看配置');}catch(error){message(error);}}
export const actions={
 ...platformSyncPickerActions,
 aiSyncFromPlatforms(){openPlatformSyncPicker({onSynced:()=>{activeTab='manual';Object.assign(FILTER,{source:'all',addressType:'all',sourceStatus:'all',query:''});UI.resetPage('asset-intake');const panel=document.querySelector('.ai-manual-panel');if(panel)panel.outerHTML=manualTable();}});},
 aiTab(tab){selectIntakeTab(tab);selected.clear();Object.assign(FILTER,{kind:'all',status:'all',sourceStatus:'all',source:'all',addressType:'all',query:''});UI.resetPage('asset-intake');refresh();},
 aiPlatformDetail:platformDetail,
 aiConnectPlatform(id){activeTab='connection';return openPlatformConnection(id,{onSaved:refresh});},
 aiPlatformAssets:platformAssets,
 aiPlatformAssetPage(id,page){UI.setPage('platform-assets-'+id,page,{rerender:false});platformAssets(id);},
 aiSyncPlatform(id){
  const connection=getPlatformConnection(id);if(!connection)return;
  if(connection.state!=='connected')return UI.toast('请先恢复平台连接后再同步');
  const count=connectionRecords(newConnectionDraft(connection)).length;
  UI.modal('同步资产','<p>将同步 '+count+' 个资产，可到资产目录中查看。</p>',UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('确认同步',{kind:'primary',onclick:call('aiConfirmSyncPlatform',id)}));
 },
 aiConfirmSyncPlatform(id){try{const result=syncPlatformConnection(id);UI.closeModal();refresh();if(platformDrawerId===id&&document.getElementById('drawer')?.classList.contains('open'))platformAssets(id);UI.toast('已同步 '+result.imported.length+' 个资产，可到资产目录中查看');}catch(error){message(error);}},
 aaDetail:applicationDetail,
 aaCloseDetail:closeApplicationDetail,
 aaEdit:openApplicationEditor,
 aaAddressType(type){const input=document.getElementById('aa-address');if(input)input.placeholder=addressExample(type);},
 aaSave(){
  try{Applications.saveManualApplication({name:val('aa-name'),assetId:val('aa-assetId'),enterpriseVersion:val('aa-enterpriseVersion'),sourceStatus:val('aa-sourceStatus'),addressType:val('aa-addressType'),address:val('aa-address')},{id:applicationEditorId||undefined});UI.closeDrawer();activeTab='manual';Object.assign(FILTER,{query:'',source:'all',sourceStatus:'all',addressType:'all'});UI.resetPage('asset-intake');refresh();UI.toast('资产信息已保存');}
  catch(error){document.getElementById('aa-error').textContent=error.message;}
 },
 aaDelete(id){
  const x=Applications.getApplicationAsset(id);if(!x)return;
  UI.modal('删除资产','<p>确认删除 '+e(x.name)+'？</p>'+(x.platformConnectionId?'<p class="ai-help">仅从本平台移除，后续同步可能重新获取该资产。</p>':''),UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('删除',{kind:'danger',onclick:call('aaConfirmDelete',id)}));
 },
 aaConfirmDelete(id){try{Applications.deleteApplicationAsset(id);UI.closeModal();if(applicationDetailId===id)closeApplicationDetail();refresh();if(platformDrawerId&&document.getElementById('drawer')?.classList.contains('open'))platformAssets(platformDrawerId);UI.toast('资产已删除');}catch(error){message(error);}},

 aiUpload(kind='agent'){UI.closeModal();if(kind==='agent'){activeTab='manual';return openApplicationEditor();}activeTab='models';return openModelIntake({onSaved:()=>{selected.clear();Object.assign(FILTER,{query:'',status:'all'});UI.resetPage('asset-intake');refresh();}});},
 aiEdit(id,version){const asset=getAsset(id,version);if(!asset)return;if(asset.kind==='agent'){activeTab='manual';UI.closeDrawer();return openAgentIntake({id,version:asset.version,mode:asset.immutable?'connection':'edit'});}activeTab='models';openModelIntake({id,onSaved:()=>{selected.clear();Object.assign(FILTER,{query:'',status:'all'});UI.resetPage('asset-intake');refresh();}});},
 aiNewVersion(id,version){const asset=getAsset(id,version);if(!asset)return;if(asset.kind==='model')return actions.aiEdit(id);activeTab='manual';UI.closeDrawer();openAgentIntake({id,version:asset.version,mode:'new-version'});},
 aiDeleteModel(id){const asset=listModelResources().find(row=>row.id===id);if(!asset)return;UI.modal('删除模型','<p>确认删除 '+e(asset.name)+'？</p>',UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('删除',{kind:'danger',onclick:"App.aiConfirmDeleteModel('"+id+"')"}));},
 aiConfirmDeleteModel(id){try{deleteModelResource(id);for(const value of [...selected])if(splitKey(value)[0]===id)selected.delete(value);UI.closeModal();if(detailKey.startsWith(id+'@'))UI.closeDrawer();refresh();UI.toast('已删除模型');}catch(error){message(error);}},
 aiFilter(k,v){if(activeTab==='connection')activeTab='manual';if(activeTab==='models'&&FILTER[k]!==v)selected.clear();FILTER[k]=v;UI.resetPage('asset-intake');refresh();if(k==='query'){const x=document.getElementById('ai-search');x?.focus();x?.setSelectionRange(v.length,v.length);}},

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
 aiTemplate(){UI.download('应用资产模板.csv',Applications.APPLICATION_CSV_TEMPLATE);},
 async aiReadFile(input){
  const file=input.files?.[0];if(!file)return;
  const error=document.getElementById('ai-import-error');
  preview=[];importContent='';document.getElementById('ai-import-confirm').disabled=true;document.getElementById('ai-import-preview').innerHTML='';
  if(!/\.csv$/i.test(file.name)){error.textContent='仅支持 CSV 文件';return;}
  if(file.size>5*1024*1024){error.textContent='CSV 文件请控制在 5 MB 内';return;}
  try{const content=await file.text();if(input!==document.getElementById('ai-import-file')||input.files?.[0]!==file||!document.getElementById('modal')?.classList.contains('open'))return;importContent=content;renderImportPreview();}catch(err){if(input===document.getElementById('ai-import-file')&&document.getElementById('modal')?.classList.contains('open'))error.textContent='无法读取 CSV 文件，请重新上传';}
 },
 aiConfirmImport(){
  if(!preview.some(x=>!x.errors.length))return;
  try{const result=Applications.importApplicationCsv(importContent);preview=[];importContent='';UI.closeModal();activeTab='manual';Object.assign(FILTER,{query:'',source:'all',sourceStatus:'all',addressType:'all'});UI.resetPage('asset-intake');refresh();UI.toast('已导入 '+result.imported.length+' 个资产'+(result.errors.length?'，'+result.errors.length+' 项未导入':''));}catch(error){message(error);}
 }
};
