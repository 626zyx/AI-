import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as Assets from '../domain/asset-intake.js';
import { AGENT_FILE_GROUPS, AGENT_FILE_EXAMPLES, agentFileExample } from '../domain/agent-file-examples.js';

const e = UI.esc;
const ROUTES = ['agent-upload', 'agent-edit', 'agent-version'];
const STEPS = ['资产信息', 'Agent 运行配置', '文件注入面'];
const META_FIELDS = ['id','name','owner','sourceStatus','enterpriseVersion'];
const RUNTIME_FIELDS = ['image','command','args','taskInput','promptFlag'];
const field = (title, body, hint = '') => `<label class="field"><span>${e(title)}</span>${body}${hint?`<small>${e(hint)}</small>`:''}</label>`;
const options = (rows, current) => rows.map(([value,label])=>`<option value="${e(value)}" ${value===current?'selected':''}>${e(label)}</option>`).join('');
const input = (key,value,extra='') => `<input id="aiu-${key}" value="${e(value??'')}" oninput="App.aiuField('${key}',this.value)" ${extra}>`;
const back = () => UI.backBtn().replace('App.back()', 'App.aiuCancel()');
const copy = value => JSON.parse(JSON.stringify(value));
let editor = null, pendingNavigation = null;

function refresh({top=false}={}) {
  const cur = router.state();
  router.nav(cur.page,cur.sub,cur.param,{replace:true});
  if (top && typeof document !== 'undefined') {
    const main = document.getElementById('app-main');
    if (main) main.scrollTop = 0;
  }
}
function locked() { return editor?.mode === 'connection'; }
function mayEdit(key) {
  return Boolean(editor) && !locked() && (key !== 'id' || editor.creating);
}
function markDirty() { editor.dirty = true; editor.error = ''; }
function makeEditor({id,version,mode='edit'}={},routeKey='') {
  const existing = id ? Assets.getAsset(id,version) : null;
  if (id && (!existing || existing.kind !== 'agent')) return null;
  const form = existing ? copy(existing) : {id:'',kind:'agent',name:'',owner:'',source:'手动上传',sourceKind:'manual',sourceStatus:'未发布',version:'V1',enterpriseVersion:'',image:'',command:[],taskInput:'stdin',promptFlag:'',surfaceDeclarations:[]};
  const actualMode = existing?.immutable && mode !== 'new-version' ? 'connection' : mode;
  if (existing && !form.enterpriseVersion) form.enterpriseVersion=Assets.assetVersionLabel(existing);
  if (actualMode === 'new-version') form.enterpriseVersion='';
  const args=form.command?.slice(1).join('; ')||'';
  return {routeKey,form,mode:actualMode,creating:!existing,command:form.command?.[0]||'',args,initialArgs:args,step:0,surfacePage:1,dirty:false,saving:false,error:''};
}
function begin(cur) {
  const routeKey = `${cur.sub}/${cur.param||''}`;
  if (editor?.routeKey === routeKey) return editor;
  editor = makeEditor({id:cur.sub==='agent-upload'?null:cur.param,mode:cur.sub==='agent-version'?'new-version':'edit'},routeKey);
  return editor;
}
export function openAgentIntake({id,version,mode='edit'}={}) {
  if (id) {
    const asset = Assets.getAsset(id,version);
    if (!asset || asset.kind !== 'agent') return UI.toast('Agent 资产不存在');
    if (asset.busy) return UI.toast('资产正在更新，请稍后重试');
  }
  const sub = !id ? 'agent-upload' : mode==='new-version'?'agent-version':'agent-edit';
  const routeKey = `${sub}/${id||''}`;
  router.nav('platform',sub,id||null,{onCommit:()=>{editor=makeEditor({id,version,mode},routeKey);}});
}
function payload() {
  const args=editor.args===editor.initialArgs?(editor.form.command||[]).slice(1):editor.args.split(/[;；]/).map(value=>value.trim()).filter(Boolean);
  return {...editor.form,kind:'agent',command:locked()?[...editor.form.command]:[editor.command.trim(),...args]};
}
function collect() {
  if (!editor || typeof document === 'undefined') return;
  const before = JSON.stringify(payload());
  for (const key of [...META_FIELDS,...RUNTIME_FIELDS]) {
    const node = document.getElementById('aiu-'+key);
    if (!node || !mayEdit(key)) continue;
    if (key==='command'||key==='args') editor[key] = node.value;
    else editor.form[key] = node.value;
  }
  if (!locked()) editor.form.surfaceDeclarations = editor.form.surfaceDeclarations.map((surface,index)=>{
    const type = document.getElementById(`aiu-surface-kind-${index}`), path = document.getElementById(`aiu-surface-path-${index}`);
    if (!type || !path) return surface;
    const [kind,subtype] = type.value.split(':');
    return {...surface,kind,...(subtype?{subtype}:{}),...(!subtype&&surface.subtype?{subtype:undefined}:{}),path:path.value};
  });
  if (before !== JSON.stringify(payload())) markDirty();
}
function metadataErrors() {
  const form = editor.form, errors = [];
  if (form.id && !/^[\w.:-]{1,100}$/.test(form.id.trim())) errors.push('资产 ID 仅支持字母、数字、下划线、点、冒号和短横线，最长 100 字符');
  if (editor.creating && form.id.trim() && Assets.getAsset(form.id.trim())) errors.push('该资产 ID 已存在，请编辑现有资产或上传新版本');
  if (!form.name.trim()) errors.push('请填写资产名称');
  if (!locked() && !String(form.enterpriseVersion||'').trim()) errors.push('请填写配置版本号');
  if (!['未发布','已发布','已停用'].includes(form.sourceStatus)) errors.push('请选择有效的企业源状态');
  return errors;
}
function validateStep(step) {
  const errors = metadataErrors();
  if (step >= 1) {
    if (!editor.command.trim()) errors.push('请填写可执行命令');
    errors.push(...Assets.assetErrors({...payload(),surfaceDeclarations:step>=2?editor.form.surfaceDeclarations:[]}));
  }
  if (errors.length) throw Error([...new Set(errors)].join('；'));
}
function assetInformation() {
  const form = editor.form, dis = locked()?'disabled':'';
  return `<h2 class="pc-section-title">资产信息</h2><div class="ai-form-grid">
    ${field('资产 ID',input('id',form.id,`${editor.creating?'':'disabled'} placeholder="留空自动生成"`))}
    ${field('资产名称 *',input('name',form.name,`${dis} placeholder="例如：企业文档 Agent"`))}
    ${field('负责人',input('owner',form.owner,dis))}
    ${field('企业源状态',`<select id="aiu-sourceStatus" onchange="App.aiuField('sourceStatus',this.value)" ${dis}>${options(['未发布','已发布','已停用'].map(value=>[value,value]),form.sourceStatus)}</select>`)}
    ${field('配置版本 *',input('enterpriseVersion',form.enterpriseVersion,`${dis} placeholder="例如 1.0.0"`))}
  </div>${locked()?'<p class="ai-help">此版本已用于演练，配置已冻结；如需修改，请上传新版本。</p>':''}`;
}
function runtimeConfiguration() {
  const form = editor.form, dis = locked()?'disabled':'';
  return `<h2 class="pc-section-title">Agent 运行配置</h2><div class="ai-form-grid">
    ${field('镜像引用 *',input('image',form.image,`${dis} placeholder="company/agent:1.0"`))}
    ${field('可执行命令 *',input('command',editor.command,`${dis} placeholder="document-agent"`))}
    ${field('任务输入协议',`<select id="aiu-taskInput" onchange="App.aiuField('taskInput',this.value)" ${dis}>${options([['stdin','stdin · 标准输入'],['argv','argv · 命令行参数'],['file','file · 任务文件']],form.taskInput)}</select>`)}
    ${field('启动参数',input('args',editor.args,`${dis} placeholder="例如 --auto; --verbose"`),'多个参数用分号分隔。')}
    ${field('任务参数标记',input('promptFlag',form.promptFlag,`${dis} placeholder="例如 -p"`),'例如 -p 表示 agent -p "任务内容"；stdin 不需要填写。')}
  </div>`;
}
function injectionSurfaces() {
  const dis = locked()?'disabled':'';
  const total=editor.form.surfaceDeclarations.length,count=Math.ceil(total/UI.PAGE_SIZE)||1;
  editor.surfacePage=Math.max(1,Math.min(editor.surfacePage||1,count));
  const offset=(editor.surfacePage-1)*UI.PAGE_SIZE;
  return `<h2 class="pc-section-title">允许的文件注入面</h2><div id="aiu-surfaces">${editor.form.surfaceDeclarations.slice(offset,offset+UI.PAGE_SIZE).map((surface,rowIndex)=>{
    const index=offset+rowIndex;
    const kind = surface.subtype?`${surface.kind}:${surface.subtype}`:surface.kind;
    const example = agentFileExample(kind);
    const groups = AGENT_FILE_GROUPS.map(group=>`<optgroup label="${e(group.label)}">${options(group.types.map(type=>[type,AGENT_FILE_EXAMPLES[type].label]),kind)}</optgroup>`).join('');
    return `<div class="ai-surface-row">${field('分类',`<select id="aiu-surface-kind-${index}" onchange="App.aiuSurface(${index},'kind',this.value)" ${dis}>${groups}${AGENT_FILE_EXAMPLES[kind]?'':options([[kind,kind]],kind)}</select>`)}${field('明确文件路径',`<input id="aiu-surface-path-${index}" value="${e(surface.path)}" placeholder="${e(example.path)}" oninput="App.aiuSurface(${index},'path',this.value)" ${dis}><small id="aiu-surface-hint-${index}">${e(example.hint)}</small>`)}${UI.linkBtn('移除',{onclick:`App.aiuRemoveSurface(${index})`,disabled:locked()})}</div>`;
  }).join('')||'<p class="ai-help">暂未声明文件注入面，可按需添加。</p>'}</div>${UI.pager({page:editor.surfacePage,count,total},'App.aiuSurfacePage({p})')}<div>${UI.btn('添加文件注入面',{onclick:'App.aiuAddSurface()',disabled:locked()})}</div><p class="ai-help">填写允许注入的明确文件路径，不使用通配符。</p>`;
}
export function agentIntakePage(cur=router.state()) {
  if (!begin(cur)) return UI.pageHead('Agent 资产不存在',{back:back()})+'<div class="empty">资产已移除或链接无效。</div>';
  const title = editor.creating?'快捷上传 Agent':editor.mode==='new-version'?'上传 Agent 新版本':locked()?'查看 Agent 配置':'编辑 Agent';
  return `<div class="pc-page aiu-page">${UI.pageHead(title,{back:back()})}<section class="pc-workspace"><ol class="ai-wizard-steps">${STEPS.map((title,index)=>`<li class="${index===editor.step?'active':index<editor.step?'done':''}" ${index===editor.step?'aria-current="step"':''}><span>${index<editor.step?'✓':index+1}</span>${title}</li>`).join('')}</ol>
    <div class="ai-wizard-content ai-form">${[assetInformation,runtimeConfiguration,injectionSurfaces][editor.step]()}<p id="aiu-error" class="ai-error" role="alert">${e(editor.error)}</p></div>
    <footer class="pc-footer"><div>${UI.btn('取消',{onclick:'App.aiuCancel()',disabled:editor.saving})}</div><div>${editor.step?UI.btn('上一步',{onclick:'App.aiuPrev()',disabled:editor.saving}):''}${editor.step===2?UI.btn(locked()?'完成':'保存',{kind:'primary',onclick:locked()?'App.aiuCancel()':'App.aiuSave()',disabled:editor.saving}):UI.btn('下一步',{kind:'primary',onclick:'App.aiuNext()',disabled:editor.saving})}</div></footer></section></div>`;
}

router.beforeNavigate(transition=>{
  if (!ROUTES.includes(transition.from.sub) || !editor) return;
  collect();
  if (!editor.dirty) { editor=null; return; }
  pendingNavigation = transition;
  UI.modal('Agent 配置尚未保存','<p>离开将放弃本次修改。</p>',UI.btn('继续编辑',{onclick:'App.aiuStay()'})+UI.btn('放弃修改并离开',{onclick:'App.aiuDiscard()'}));
  return false;
});

export const actions = {
  aiuField(key,value) {
    if (![...META_FIELDS,...RUNTIME_FIELDS].includes(key)||!mayEdit(key)) return;
    if (key==='command'||key==='args') editor[key]=String(value);
    else editor.form[key]=String(value);
    const node=typeof document==='undefined'?null:document.getElementById('aiu-'+key); if(node)node.value=String(value);
    markDirty();
  },
  aiuNext() { collect(); try { validateStep(editor.step); editor.step=Math.min(2,editor.step+1); editor.error=''; refresh({top:true}); } catch(error) { editor.error=error.message; refresh(); } },
  aiuPrev() { collect(); editor.step=Math.max(0,editor.step-1); editor.error=''; refresh({top:true}); },
  aiuSurfacePage(page) { if(!editor)return; collect(); editor.surfacePage=Number(page)||1; refresh(); },
  aiuAddSurface() { if (!editor||locked()) return; collect(); editor.form.surfaceDeclarations.push({kind:'instruction',path:'',description:'用户声明的文件注入面'}); editor.surfacePage=Math.ceil(editor.form.surfaceDeclarations.length/UI.PAGE_SIZE); markDirty(); refresh(); },
  aiuSurface(index,key,value) {
    if (!editor||locked()) return;
    const surface=editor.form.surfaceDeclarations[index]; if(!surface) return;
    if(key==='kind') { const [kind,subtype]=String(value).split(':'); surface.kind=kind; if(subtype)surface.subtype=subtype;else delete surface.subtype; }
    else if(key==='path')surface.path=String(value);else return;
    const node=typeof document==='undefined'?null:document.getElementById(`aiu-surface-${key}-${index}`); if(node)node.value=String(value);
    if(key==='kind'&&typeof document!=='undefined') {
      const example=agentFileExample(value),path=document.getElementById(`aiu-surface-path-${index}`),hint=document.getElementById(`aiu-surface-hint-${index}`);
      if(path)path.placeholder=example.path;
      if(hint)hint.textContent=example.hint;
    }
    markDirty();
  },
  aiuRemoveSurface(index) { if (!editor||locked()) return; collect(); editor.form.surfaceDeclarations.splice(index,1); markDirty(); refresh(); },
  aiuSave() {
    if (!editor||editor.saving) return;
    if (locked()) return actions.aiuCancel();
    collect();
    try {
      validateStep(2); editor.saving=true;
      const saved=Assets.saveManualAgent(payload(),{mode:editor.mode});
      editor.dirty=false; editor=null; router.nav('platform','intake'); UI.toast(`已保存 ${saved.name}${saved.enterpriseVersion?' · '+saved.enterpriseVersion:''}`);
    } catch(error) { editor.saving=false; editor.error=error.message; refresh(); }
  },
  aiuCancel() { router.nav('platform','intake'); },
  aiuStay() { pendingNavigation=null; UI.closeModal(); },
  aiuDiscard() { const transition=pendingNavigation; pendingNavigation=null; editor=null; UI.closeModal(); transition?.proceed(); },
};
