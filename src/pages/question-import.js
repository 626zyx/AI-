import * as UI from '../core/ui.js';
import * as Banks from '../domain/model-bank-authoring.js';
import * as Tags from '../domain/resource-tags.js';
import { parseQuestionImport, QUESTION_IMPORT_FORMAT } from '../domain/question-import.js';

let editor=null,serial=0;
const e=UI.esc,copy=value=>structuredClone(value);
const currentText=()=>document.getElementById('qi-text')?.value||'';
const active=()=>Boolean(editor&&document.querySelector('#drawer.open .qi-form'));
const uniqueId=()=>`Q-${(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+ ++serial).replaceAll('-','').slice(0,18).toUpperCase()}`;
const setError=message=>{const el=document.getElementById('qi-error');if(el)el.textContent=message;};
const catalog=()=>({knownTags:{business:Tags.listTags('business'),risk:Tags.listTags('risk')},existingIds:Banks.listModelBanks().flatMap(bank=>bank.items.map(item=>item.id).filter(Boolean))});
function clearPreview(){if(!editor)return;editor.parsed=null;editor.parsedText='';document.getElementById('qi-preview')?.replaceChildren();const save=document.getElementById('qi-save');if(save)save.disabled=true;setError('');}
export function openQuestionImport(mode='manual',{onSaved}={}) {
  editor={mode:mode==='file'?'file':'manual',onSaved,text:'',format:'auto',parsed:null,parsedText:'',readToken:0};
  const file=editor.mode==='file';
  const input=file?'<label class="field"><span>题目文件</span><input id="qi-file" type="file" accept=".txt,.jsonl,.csv,text/plain,application/x-ndjson,text/csv" onchange="App.qiReadFile(this)"></label><p class="qi-help">支持 TXT、CSV、JSONL，最大 10 MB。上传后可检查内容，再点击解析。</p>':'';
  const tools='<div class="qi-input-heading"><label for="qi-text">'+(file?'文件内容':'题目内容')+'</label>'+(!file?UI.linkBtn('+ 导入格式',{onclick:'App.qiAddFormat()',title:'在文本框末尾添加一条题目格式'}):UI.linkBtn('下载模板',{onclick:'App.qiTemplate()'}))+'</div>';
  UI.drawer(file?'文件导入题目':'手动导入题目','<div class="qi-form">'+input+tools+'<textarea id="qi-text" aria-label="导入题目内容" rows="11" placeholder="'+e(file?'上传文件后显示内容，也可以在此修改':'点击“+ 导入格式”添加一条题目；每条题目用单独一行 --- 分隔。')+'" oninput="App.qiTextChanged()"></textarea><p class="qi-help">ID 留空将自动生成；业务类型与风险场景可留空，多个标签用分号分隔。标签名称须与标签管理中的名称一致。</p><div class="qi-parse-row">'+UI.btn('解析',{onclick:'App.qiParse()'})+'</div><p id="qi-error" class="qi-error" role="alert"></p><div id="qi-preview" aria-live="polite"></div></div>',UI.btn('取消',{onclick:'App.qiCancel()'})+'<button id="qi-save" class="btn primary w-lg" disabled onclick="App.qiSave()">保存草稿</button>');
  document.querySelector('#drawer .drawer')?.classList.add('qi-drawer');
  document.querySelector('#drawer .modal-head .icon-btn')?.setAttribute('onclick','App.qiCancel()');
  if(!file)document.getElementById('qi-text')?.focus();
}
function preview(parsed){
  const text=parsed.items.length+' 道题目将保存为草稿'+(parsed.duplicates.length?'，已去重 '+parsed.duplicates.length+' 道':'');
  const table=UI.table([{title:'题目 ID',width:'130px',render:row=>e(row.id||'自动生成')},{title:'题目内容',render:row=>'<span class="qi-preview-prompt" title="'+e(row.prompt)+'">'+e(row.prompt)+'</span>'},{title:'业务类型',width:'110px',render:row=>e(row.tagNames.business.join('、')||'—')},{title:'风险场景',width:'150px',render:row=>e(row.tagNames.risk.join('、')||'—')}],parsed.items,'没有可保存的题目');
  document.getElementById('qi-preview').innerHTML='<div class="qi-preview-heading"><strong>解析结果</strong><span>'+text+'</span></div><div class="qi-preview-table">'+table+'</div>';
}
export const actions={
  qiCancel(){editor=null;UI.closeDrawer();},
  qiAddFormat(){if(!active())return;editor.readToken++;const input=document.getElementById('qi-text');input.value=(input.value.trimEnd()?input.value.trimEnd()+'\n\n---\n\n':'')+QUESTION_IMPORT_FORMAT;clearPreview();input.focus();input.setSelectionRange(input.value.length,input.value.length);},
  qiTextChanged(){if(!active())return;editor.readToken++;clearPreview();},
  qiTemplate(){UI.download('题目导入模板.txt',QUESTION_IMPORT_FORMAT+'\n','text/plain;charset=utf-8');},
  async qiReadFile(input){
    if(!active())return;const file=input.files?.[0];clearPreview();const current=editor,token=++current.readToken;
    if(!file)return;const ext=file.name.split('.').at(-1).toLowerCase();
    if(!['txt','csv','jsonl'].includes(ext))return setError('请上传 TXT、CSV 或 JSONL 文件');
    if(file.size>10*1024*1024)return setError('文件不能超过 10 MB');
    try{const content=await file.text();if(editor!==current||current.readToken!==token||!active()||document.getElementById('qi-file')!==input||input.files?.[0]!==file)return;current.format=ext==='txt'?'auto':ext;document.getElementById('qi-text').value=content;}
    catch{if(editor===current&&current.readToken===token&&active())setError('文件读取失败，请重试');}
  },
  qiParse(){if(!active())return;clearPreview();try{const text=currentText(),parsed=parseQuestionImport(text,{format:editor.format,...catalog()});if(!parsed.valid){setError(parsed.errors.map(row=>'第 '+row.line+' 行：'+row.message).join('\n'));return;}editor.parsed=parsed;editor.parsedText=text;preview(parsed);document.getElementById('qi-save').disabled=false;}catch(error){setError(error.message);}},
  qiSave(){
    if(!active()||!editor.parsed)return;
    if(currentText()!==editor.parsedText){clearPreview();return setError('内容已变化，请重新解析');}
    const saved=[],resourceIds=[];const current=editor;
    try{
      // Revalidate IDs and labels at save time so another editor cannot make the preview stale.
      const latest=parseQuestionImport(current.parsedText,{format:current.format,...catalog()});
      if(!latest.valid)throw Error('题目或标签已变化，请重新解析。'+latest.errors.map(row=>row.message).join('；'));
      const allocated=new Set(catalog().existingIds),items=latest.items.map(item=>{let id=item.id;while(!id||allocated.has(id))id=uniqueId();allocated.add(id);return{...copy(item),id};});
      // Save backwards so the first imported question remains first within the newest batch.
      for(const item of [...items].reverse()){
        const bank=Banks.saveModelBankDraft({name:item.prompt.slice(0,60),business:'',items:[{id:item.id,prompt:item.prompt,scene:'',scenes:[]}],questionLibraryEntry:true});saved.push(bank);
        const id=encodeURIComponent(bank.id)+':'+(bank.items[0].libraryKey??0);resourceIds.push(id);
        Tags.registerResourceSeeds('question',[{id,title:item.prompt,seeds:{business:[],risk:[]}}]);
        Tags.saveResourceTags('question',id,item.tagIds);
      }
    }catch(error){
      for(const bank of saved)try{Banks.deleteModelBank(bank.id);}catch{}
      if(resourceIds.length)try{Tags.removeResourceTags('question',resourceIds);}catch{}
      if(editor===current)setError(error.message);
      return;
    }
    editor=null;UI.closeDrawer();current.onSaved?.(saved.reverse());UI.toast('已保存 '+saved.length+' 道题目草稿');
  },
};
