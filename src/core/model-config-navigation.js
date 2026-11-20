/* Role-model pickers share a navigation option, never a model identifier.
 * Keep the active form in its owning page and resume it after asset configuration. */
import * as UI from './ui.js';
import * as router from './router.js';

export const CONFIGURE_MODEL_VALUE = '__configure_models__';
export const configureModelsOption = `<option value="${CONFIGURE_MODEL_VALUE}">+ 去配置更多模型</option>`;
let pending = null;

export function configureMoreModels(resume, label = '返回配置', { returnRoute } = {}) {
  const from = { ...router.state() };
  UI.closeModal();
  UI.closeDrawer();
  return router.nav('platform', 'roles', null, {
    purpose: 'configure-models',
    onCommit: () => { pending = { route: returnRoute?.() || from, resume, label }; },
  });
}

export function modelConfigurationReturnButton() {
  return pending ? UI.btn(pending.label, { onclick: 'App.returnToModelConfiguration()' }) : '';
}

export function returnToModelConfiguration() {
  if (!pending) return;
  const { route, resume } = pending;
  pending = null;
  router.nav(route.page, route.sub, route.param);
  resume?.();
}
