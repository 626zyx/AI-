/* Shared file workspace. Validation is supplied by the owning resource flow. */
import * as UI from './ui.js';
import { icon } from './icons.js';

const e = UI.esc;
export const idePathArg = path => encodeURIComponent(path).replace(/'/g, '%27');
const language = path => ({py:'Python',json:'JSON',yaml:'YAML',yml:'YAML',md:'Markdown',sh:'Shell',txt:'Text'})[path.split('.').pop()] || 'Text';
const stateText = { idle:'等待运行', running:'验证中', passed:'验证通过', failed:'验证未通过', pending:'等待', skipped:'未执行' };

export function ideProblems(files, report, staticReport) {
  const problems = [];
  for (const [path, text] of Object.entries(files)) {
    if (!path.endsWith('.json')) continue;
    try { JSON.parse(text); } catch (error) {
      const pos = Number(error.message.match(/position (\d+)/)?.[1]);
      const line = Number(error.message.match(/line (\d+)/)?.[1]) || (Number.isFinite(pos) ? text.slice(0,pos).split('\n').length : 1);
      problems.push({path,line,message:`JSON 格式错误：${error.message}`});
    }
  }
  for (const message of [...(staticReport?.errors || []), ...(report?.blockingIssues || [])]) {
    if (problems.some(p=>p.message.includes(message))) continue;
    const path = Object.keys(files).find(path=>message.includes(path)) || '';
    problems.push({path,line:1,message});
  }
  return problems.filter((p,i,all)=>all.findIndex(q=>q.path===p.path&&q.message===p.message)===i);
}

export function renderIdeConsole({report,files={},staticReport,tab='output',tabAction,fileAction,stale=false}) {
  const problems=ideProblems(files,report,staticReport), steps=report?.steps||[], logs=report?.logs||[];
  const status=stale?'内容已修改，需重新验证':stateText[report?.state||'idle'];
  const tabs=[['output','运行输出'],['checks','检查结果'],['problems',`问题${problems.length?` · ${problems.length}`:''}`]];
  const body=tab==='problems'? (problems.length?problems.map(p=>`<button type="button" class="wi-problem" ${p.path?`onclick="App.${fileAction}('${idePathArg(p.path)}',${p.line})"`: 'disabled'}><span class="wi-error-marker">!</span><span>${e(p.message)}</span><code>${e(p.path||'运行配置')}${p.path?`:${p.line}`:''}</code></button>`).join(''):'<p class="wi-console-empty">暂无已发现的问题。运行验证后查看结果。</p>')
    :tab==='checks'?(steps.length?`<div class="wi-checks">${steps.map(step=>`<div class="wi-check ${step.state}"><span>${e(stateText[step.state]||step.state)}</span><strong>${e(step.name)}</strong><p>${e(step.detail||'等待执行')}</p></div>`).join('')}</div>`:'<p class="wi-console-empty">运行后显示文件检查与沙箱验证结果。</p>')
    :`<div class="wi-log-lines"><div class="wi-log-muted">验证模式：本地演示 · 运行阶段为模拟输出，未实际拉取镜像或执行 Python。</div>${logs.map((log,i)=>`<div class="${steps.find(s=>s.id===log.stepId)?.state==='failed'?'wi-log-error':''}"><span>${String(i+1).padStart(2,'0')}</span><code>${e(log.message)}</code></div>`).join('')||'<p class="wi-console-empty">点击“运行验证”查看输出、错误和检查结果。</p>'}${report?.state==='running'?'<div class="wi-running-line">正在验证<span>…</span></div>':''}${['passed','failed'].includes(report?.state)?`<div class="wi-log-end ${report.state}">验证结束 · ${e(stateText[report.state])}</div>`:''}</div>`;
  return `<section class="wi-console" aria-label="运行与问题"><header><div role="tablist" aria-label="运行结果">${tabs.map(([id,label])=>`<button type="button" role="tab" aria-selected="${tab===id}" class="${tab===id?'active':''}" onclick="App.${tabAction}('${id}')">${label}</button>`).join('')}</div><span class="wi-run-state ${stale?'stale':report?.state||'idle'}" role="status">${report?.state==='running'?'<i></i>':''}${e(status)}</span></header><div class="wi-console-body" aria-live="polite">${body}</div></section>`;
}

export function renderWebIde({files,path,editable=false,dirty=false,busy=false,codeId='wi-code',fileAction,codeAction,tabAction,tab='output',report,staticReport,stale=false,tools='',context='',fileTools=''}) {
  const paths=Object.keys(files).sort(), text=files[path]||'', selected=paths.includes(path);
  const directories=[...new Set(paths.map(p=>p.includes('/')?p.split('/')[0]+'/':''))];
  return `<section class="wi-workspace" aria-label="Web IDE"><div class="wi-context">${context}<span>${dirty?'有未保存更改':editable?'草稿已保存':'只读快照'}</span></div><div class="wi-layout"><aside class="wi-files"><header><strong>文件</strong><span>${paths.length}</span>${fileTools}</header><div class="wi-file-tree">${directories.map(dir=>`${dir?`<div class="wi-directory">${icon('chevronDown',13)}${e(dir)}</div>`:''}${paths.filter(p=>(p.includes('/')?p.split('/')[0]+'/':'')===dir).map(p=>`<button type="button" class="${p===path?'active':''}${dir?' nested':''}" title="${e(p)}" onclick="App.${fileAction}('${idePathArg(p)}')">${icon('file',15)}<span>${e(dir?p.slice(dir.length):p)}</span>${p.endsWith('.py')?'<small>PY</small>':''}</button>`).join('')}`).join('')||'<p class="wi-console-empty">暂无文件</p>'}</div></aside><div class="wi-main"><section class="wi-editor"><header><div class="wi-file-tab">${icon('file',15)}<span>${e(path||'未选择文件')}</span>${dirty?'<i title="未保存"></i>':''}</div><div class="row-actions">${tools}</div></header><div class="wi-code-wrap"><pre class="wi-line-numbers" aria-hidden="true">${text.split('\n').map((_,i)=>i+1).join('\n')}</pre><textarea id="${codeId}" class="wi-code" aria-label="${codeId==='ae-code'?'环境文件内容':'靶标配置文件内容'}" spellcheck="false" wrap="off" ${editable&&selected&&!busy?`oninput="App.${codeAction}(this.value);UI.syncIdeEditor(this)"`:'readonly'} onscroll="UI.syncIdeScroll(this)" onkeydown="UI.ideCodeKey(event,this)">${e(text)}</textarea></div><footer><span>${e(language(path))}</span><span>${text.split('\n').length} 行</span><span>UTF-8</span><span>${editable?'工作区文件':'资源快照'}</span></footer></section>${renderIdeConsole({report,files,staticReport,tab,tabAction,fileAction,stale})}</div></div></section>`;
}

export function syncIdeScroll(node){const gutter=node.previousElementSibling;if(gutter)gutter.scrollTop=node.scrollTop;}
export function syncIdeEditor(node){const gutter=node.previousElementSibling;if(gutter)gutter.textContent=node.value.split('\n').map((_,i)=>i+1).join('\n');syncIdeScroll(node);}
export function ideCodeKey(event,node){if(event.key!=='Tab'||node.readOnly)return;event.preventDefault();const start=node.selectionStart,end=node.selectionEnd;node.setRangeText('    ',start,end,'end');node.dispatchEvent(new Event('input',{bubbles:true}));}
export function focusIdeLine(id,line=1){const node=document.getElementById(id);if(!node)return;const lines=node.value.split('\n'),start=lines.slice(0,line-1).reduce((n,s)=>n+s.length+1,0);node.focus();node.setSelectionRange(start,start+(lines[line-1]?.length||0));node.scrollTop=Math.max(0,(line-3)*22);syncIdeScroll(node);}
