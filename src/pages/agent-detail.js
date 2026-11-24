/* Agent and model detail pages share the same task workspace. */
import { taskWorkspacePage } from './task-workspace.js';
export { actions } from './agent-question-flow.js';
export const agentDetailPage = cur => taskWorkspacePage(cur, 'agent');
