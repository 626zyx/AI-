/* Agent entry point for the shared page wizard. */
import { openTaskWizard } from './task-wizard.js';
export function openAgentWizard(preset = {}) {
  openTaskWizard('agent', preset);
}
