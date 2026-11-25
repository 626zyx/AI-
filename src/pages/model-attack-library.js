import { attackStrategyPage } from './strategy.js';
import { methodsPage } from './library.js';
import { questionLibraryPage } from './question-library.js';
export function modelAttackLibraryPage(cur = {}) {
  if (cur.sub === 'methods') return methodsPage();
  if (cur.sub === 'banks') return questionLibraryPage();
  return attackStrategyPage();
}
