import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import { renderWebIde, focusIdeLine } from '../core/web-ide.js';
import { createSandboxValidation, runSandboxValidation, sandboxValidationIsCurrent } from '../domain/sandbox-validation.js';

const sessions=new Map();let serial=0;
const refresh=()=>{const c=router.state();router.nav(c.page,c.sub,c.param,{replace:true});};
const active=()=>sessions.get(router.state().param);
export function openTargetWebIde({input,report,onResult,onReturn}) {
  const id='target-'+(++serial), target=structuredClone(input.target), model=structuredClone(input.model);
  // Only render known configuration. Do not present simulated pulls as actual source files.
  const files={'launch.json':JSON.stringify({image:target.image,command:target.command,args:target.args||[],taskInput:target.taskInput,promptFlag:target.promptFlag||'',baseModel:{name:model.name,model:model.apiModel||model.model}},null,2),'injection-files.json':JSON.stringify((target.surfaces||[]).map(({path,kind,desc})=>({path,kind,description:desc})),null,2)};
  sessions.set(id,{id,input:{target,model},files,path:'launch.json',tab:'output',report:report&&sandboxValidationIsCurrent(report,{target,model})?structuredClone(report):createSandboxValidation('target',{target,model}),onResult,onReturn,busy:false});
  router.nav('agent','webide',id,{purpose:'configure-target'});
  return id;
}
export function agentWebIdePage() {
  const s=active();
  if(!s)return UI.pageHead('Web IDE')+'<div class="empty"><strong>请从 Agent 任务配置进入</strong><p>选择靶标和基模后，即可查看文件与运行验证。</p>'+UI.btn('返回演练任务',{onclick:"App.go('agent','ag-tasks')"})+'</div>';
  const actions=UI.btn('返回任务配置',{onclick:'App.witReturn()',disabled:s.busy})+UI.btn(s.busy?'验证中…':'拉取并运行验证',{kind:'primary',ico:'play',disabled:s.busy,onclick:'App.witRun()'});
  return UI.pageHead('靶标验证 · Web IDE',{actions})+'<p class="wi-page-note">查看当前靶标的运行配置与文件声明，验证通过后返回任务继续配置。资源文件保持只读。</p>'+renderWebIde({files:s.files,path:s.path,report:s.report,busy:s.busy,tab:s.tab,fileAction:'witFile',tabAction:'witTab',context:`<strong>${UI.esc(s.input.target.name)}</strong><span>靶标基模：${UI.esc(s.input.model.name)}</span><span>最小任务验证</span>`});
}
export const actions={
  witFile(path,line){const s=active();if(!s)return;path=decodeURIComponent(path);if(!Object.hasOwn(s.files,path))return;s.path=path;refresh();focusIdeLine('wi-code',line);},
  witTab(tab){const s=active();if(!s||!['output','checks','problems'].includes(tab))return;s.tab=tab;refresh();},
  async witRun(options={}){const s=active();if(!s||s.busy)return;s.busy=true;s.tab='output';refresh();try{const report=await runSandboxValidation('target',s.input,{delay:options.delay,onUpdate:r=>{s.report=r;if(active()===s)refresh();}});s.report=report;s.onResult?.(structuredClone(report));if(report.state==='failed')s.tab='problems';return report;}finally{s.busy=false;if(active()===s)refresh();}},
  witReturn(){const s=active();if(!s||s.busy)return;s.onReturn?.();},
};
