/* Model entry points for the shared page wizard. */
import { openTaskWizard, copyTaskConfig } from './task-wizard.js';
export const openWizard = (type = 'model', preset = {}) => openTaskWizard(type, preset);
export const openRetest = task => copyTaskConfig(task.id, 'model');
export { actions } from './task-wizard.js';
