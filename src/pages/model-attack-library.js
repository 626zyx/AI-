import * as UI from '../core/ui.js';
import { attackStrategyPage } from './strategy.js';
import { methodsPage, banksPage } from './library.js';
export function modelAttackLibraryPage(cur) {
  const tab = ['attack','methods','banks'].includes(cur.sub) ? cur.sub : 'attack';
  const tabs = `<nav class="v4-tabs" aria-label="模型攻击库分类">${[['attack','组合攻击策略'],['methods','方法库'],['banks','题库']].map(([id,label])=>`<button class="${tab===id?'active':''}" onclick="App.go('strategy','${id}')">${label}</button>`).join('')}</nav>`;
  const content = tab==='attack' ? attackStrategyPage({embedded:true}) : tab==='methods' ? methodsPage({embedded:true}) : banksPage({embedded:true});
  return UI.pageHead('攻击库', {actions:UI.btn('新建攻击策略',{kind:'primary',ico:'plus',onclick:'App.newStrategy()'})}) + tabs + content;
}
