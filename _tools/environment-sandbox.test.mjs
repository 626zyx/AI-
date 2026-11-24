import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as E from '../src/domain/agent-environments.js';
import * as router from '../src/core/router.js';
import { agentEnvironmentEditorPage as render, agentEnvironmentActions as A } from '../src/pages/agent-environment-editor.js';
import { sandboxValidationIsCurrent } from '../src/domain/sandbox-validation.js';

const draft = title => E.createAgentDemoDrafts({ title, goal: '整理公开资料并交付摘要', count: 1 })[0];

test('environment publication requires both sandbox phases and editing invalidates their saved evidence', async () => {
  const q = draft('沙箱发布守卫');
  try {
    assert.throws(() => E.publishAgentQuestion(q.id), /可运行性检查与基本对照测试/);
    const updates = [];
    const result = await E.validateAgentQuestionSandbox(q.id, { delay: 0, onUpdate: state => updates.push(state) });
    assert.equal(result.state, 'passed');
    assert.equal(result.mode, 'demo');
    assert.equal(result.actualExecuted, false);
    assert.deepEqual([...new Set(result.steps.map(step => step.phase))], ['可运行性检查', '基本对照测试']);
    assert.ok(result.steps.every(step => step.state === 'passed'));
    assert.ok(updates.some(state => state.state === 'running'));
    assert.ok(sandboxValidationIsCurrent(result, { question: E.getAgentQuestion(q.id) }));
    const unchanged = E.saveAgentQuestion(E.getAgentQuestion(q.id));
    assert.equal(unchanged.validation.sandbox.state, 'passed', 'saving unchanged content retains validation');
    const changed = E.saveAgentQuestion({ ...unchanged, files: { ...unchanged.files, 'task.md': unchanged.files['task.md'] + '\n补充交付要求。' } });
    assert.equal(changed.validation.sandbox, undefined);
    assert.throws(() => E.publishAgentQuestion(q.id), /可运行性检查/);
    const injected = E.saveAgentQuestion({ ...changed, validation: { sandbox: result, runtime: 'demo_passed' } });
    assert.equal(injected.validation.sandbox, undefined, 'caller-supplied evidence cannot bypass validation');
    await E.validateAgentQuestionSandbox(q.id, { delay: 0 });
    assert.equal(E.publishAgentQuestion(q.id).status, 'published');
    await assert.rejects(E.validateAgentQuestionSandbox(q.id, { delay: 0 }), /仅自建草稿/);
  } finally { E.deleteAgentQuestion(q.id); }
});

test('missing files block the sandbox and concurrent edits cannot receive an outdated pass', async () => {
  const q = draft('验证失败与重试');
  try {
    const missing = { ...q.files }; delete missing['checkpoints.md'];
    E.saveAgentQuestion({ ...q, files: missing });
    const failed = await E.validateAgentQuestionSandbox(q.id, { delay: 0 });
    assert.equal(failed.state, 'failed');
    assert.match(failed.blockingIssues.join(' '), /checkpoints.md/);
    assert.ok(failed.steps.some(step => step.state === 'skipped'));
    E.saveAgentQuestion({ ...q, files: q.files });
    let edited = false;
    await assert.rejects(E.validateAgentQuestionSandbox(q.id, { delay: 0, onUpdate: report => {
      if (!edited && report.state === 'running') {
        edited = true;
        E.saveAgentQuestion({ ...E.getAgentQuestion(q.id), business: '变更业务' });
      }
    } }), /环境内容已变化/);
    assert.equal(E.getAgentQuestion(q.id).validation.sandbox, undefined);
    assert.throws(() => E.publishAgentQuestion(q.id), /可运行性检查/);
    await E.validateAgentQuestionSandbox(q.id, { delay: 0 });
    assert.equal(E.publishAgentQuestion(q.id).status, 'published');
  } finally { E.deleteAgentQuestion(q.id); }
});

test('environment editor uses a page for sandbox validation and publishes only after explicit confirmation', async () => {
  const dom = new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  router.setRenderer(() => { document.querySelector('main').innerHTML = render(router.state()); });
  const q = draft('页面式验证');
  try {
    A.aeOpen(q.id); A.aePublish(q.id);
    assert.ok(document.querySelector('.ae-validation-workspace'));
    assert.equal(document.querySelector('#modal.open'), null);
    assert.equal(document.querySelector('#drawer.open'), null);
    assert.ok(document.querySelector('[onclick="App.aePublishConfirm()"]').disabled);
    A.aePublishConfirm(); assert.equal(E.getAgentQuestion(q.id).status, 'draft');
    await A.aeRunSandbox({ delay: 0 });
    assert.match(document.querySelector('.sv-panel').textContent, /演示验证.*模拟过程/);
    assert.equal(document.querySelector('[onclick="App.aePublishConfirm()"]').disabled, false);
    assert.equal(E.getAgentQuestion(q.id).status, 'draft');
    A.aeEditorView('edit');
    A.aeCode(E.getAgentQuestion(q.id).files['task.md'] + '\n新的任务细节');
    A.aePublish(q.id);
    assert.ok(document.querySelector('[onclick="App.aePublishConfirm()"]').disabled);
    assert.match(document.querySelector('.sv-status').textContent, /重新验证/);
    await A.aeRunSandbox({ delay: 0 });
    A.aeEditorView('edit'); A.aeFile(encodeURIComponent('checkpoints.md')); A.aeCode(''); A.aePublish(q.id);
    await A.aeRunSandbox({ delay: 0 });
    assert.match(document.querySelector('.sv-panel').textContent, /checkpoints.md/);
    assert.ok(document.querySelector('[onclick="App.aePublishConfirm()"]').disabled);
    A.aeEditorView('edit'); A.aeCode(q.files['checkpoints.md']); A.aePublish(q.id);
    await A.aeRunSandbox({ delay: 0 });
    A.aePublishConfirm();
    assert.equal(E.getAgentQuestion(q.id).status, 'published');
    assert.equal(document.getElementById('ae-code').readOnly, true);
  } finally { E.deleteAgentQuestion(q.id); dom.window.close(); }
});
