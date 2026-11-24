import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { agentMethodsPage, actions } from '../src/pages/agent-attack-library.js';
import { getAgentAttackTemplate, listAgentAttackTemplates, saveAgentAttackTemplate } from '../src/domain/agent-attack-library.js';
import { NATIVE_SURFACE_KINDS, SURFACE_GROUPS, SURFACE_TYPES } from '../src/domain/attack-surfaces.js';
import { normalizeSurfaceDeclarations } from '../src/domain/agent-surfaces.js';

const dom = new JSDOM('<main></main><div id="drawer"></div><div id="modal"></div>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
after(() => dom.window.close());

test('Agent attack catalog is system-only and cannot create or copy a template', () => {
  document.querySelector('main').innerHTML = agentMethodsPage();
  const page = document.querySelector('main');
  assert.equal(listAgentAttackTemplates().length, 1);
  assert.deepEqual([...page.querySelectorAll('.row-actions button')].map(button => button.textContent), ['详情']);
  assert.doesNotMatch(page.textContent, /新建|复制|删除/);
  assert.equal(actions.editAttackTemplate, undefined);
  assert.throws(() => saveAgentAttackTemplate({ name: 'Custom', prompt: 'Custom prompt' }), /暂不支持/);
  const record = getAgentAttackTemplate('universal'); record.prompt = 'mutation';
  assert.notEqual(getAgentAttackTemplate('universal').prompt, 'mutation');
});

test('Agent detail groups files, includes scoped workspace context and preserves original delivery constraints', () => {
  actions.openAgMethod('universal');
  const panel = document.querySelector('#drawer .drawer');
  assert.ok(panel.classList.contains('tc-config-drawer'));
  assert.deepEqual([...panel.querySelectorAll('.tc-detail-block > h3')].map(node => node.textContent), ['描述', '覆盖攻击面', '攻击提示词']);
  assert.deepEqual([...panel.querySelectorAll('[data-surface-group]')].map(node => node.dataset.surfaceGroup), SURFACE_GROUPS.map(group => group.id));
  assert.equal(panel.querySelectorAll('[data-surface-type]').length, SURFACE_TYPES.length);
  assert.match(panel.querySelector('[data-workspace-surface]').textContent, /README\.md/);
  for (const fragment of ['APPEND', 'REPLACE', 'SKILL.md', '1–3 句', '100 字节', '50 字节', '{{attack_iteration}}']) assert.ok(panel.textContent.includes(fragment), fragment);
  assert.doesNotMatch(panel.textContent, /系统执行器|新建|复制为自建模板/);
  assert.equal(panel.querySelectorAll('textarea,input,select').length, 0);
  assert.ok(!NATIVE_SURFACE_KINDS.includes('workspace'));
  assert.throws(() => normalizeSurfaceDeclarations([{ kind: 'workspace', path: 'README.md' }]), /请选择注入面分类/);
});
