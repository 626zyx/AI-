import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  ASSET_IMPORT_EXAMPLE,
  assetErrors,
  deleteManualAgent,
  manualAgentDeleteError,
  getAsset,
  getAssetSnapshot,
  importAssets,
  importManualAgents,
  listAssetVersions,
  listTestableAssets,
  markAssetUsed,
  parseAssetImport,
  previewAssets,
  previewManualAgents,
  listManualAgentVersions,
  saveAsset,
  saveManualAgent,
  selectAssetVersion,
  subscribeAssets,
  validateAsset,
  updateAssetConnection,
} from '../src/domain/asset-intake.js';

const model = (id, extra = {}) => ({
  id, kind: 'model', name: '测试模型 ' + id, owner: '模型研发', source: '企业资产台账',
  sourceStatus: '未发布', baseUrl: 'https://api.example.com/v1', apiModel: 'qa-model', apiKey: 'secret-token',
  ...extra,
});
const agent = (id, baseModelId, extra = {}) => ({
  id, kind: 'agent', enterpriseVersion: '1.0.0', name: '测试 Agent ' + id, owner: '应用研发', source: '企业资产台账',
  sourceStatus: '未发布', image: 'company/qa-agent:1.0.0', command: ['qa-agent', '--auto'],
  taskInput: 'stdin', baseModelId, baseModelVersion: 'V1', surfaceDeclarations: [], ...extra,
});

test('asset validation exposes real stages and independent busy, passed, failed states', async () => {
  const id = 'intake-check-model';
  const created = saveAsset(model(id));
  assert.equal(created.status, 'pending');
  assert.equal(created.busy, false);
  assert.equal('apiKey' in created, false, 'credentials never appear in asset responses');

  const progress = [];
  const checked = await validateAsset(id, { delay: 0, onProgress: (asset) => progress.push(asset) });
  assert.equal(checked.status, 'ready');
  assert.equal(checked.busy, false);
  assert.equal(checked.validation.state, 'passed');
  assert.deepEqual(checked.validation.steps.map((step) => step.state), ['passed', 'passed', 'passed', 'passed']);
  assert.ok(progress.some((asset) => asset.busy && asset.validation.steps.some((step) => step.state === 'running')));
  assert.ok(listTestableAssets({ kind: 'model' }).some((asset) => asset.id === id && asset.version === 'V1'));

  const failed = saveAsset(model('intake-check-failed', { baseUrl: 'https://unreachable.example/v1' }));
  const failure = await validateAsset(failed.id, { delay: 0 });
  assert.equal(failure.status, 'failed');
  assert.equal(failure.validation.steps[0].state, 'passed');
  assert.equal(failure.validation.steps[1].state, 'failed');
  assert.ok(!listTestableAssets({ kind: 'model' }).some((asset) => asset.id === failed.id));
});

test('batch import is idempotent and applies model references before Agent checks', async () => {
  const modelId = 'intake-batch-model';
  const agentId = 'intake-batch-agent';
  const manifest = [model(modelId), agent(agentId, modelId)];
  const parsed = parseAssetImport(JSON.stringify(manifest));
  assert.deepEqual(parsed, manifest);
  const preview = previewAssets(parsed);
  assert.deepEqual(preview.map((row) => row.operation), ['新增 V1', '新增 V1']);
  assert.ok(preview.every((row) => row.errors.length === 0));

  const imported = importAssets(parsed);
  assert.equal(imported.errors.length, 0);
  assert.deepEqual(imported.changed.map((asset) => asset.id), [modelId, agentId]);
  assert.equal(getAsset(agentId).status, 'pending');
  await validateAsset(modelId, { delay: 0 });
  const checkedAgent = await validateAsset(agentId, { delay: 0 });
  assert.equal(checkedAgent.status, 'ready');
  assert.equal(checkedAgent.validation.steps[1].state, 'passed', 'base model version was resolved');

  const repeated = importAssets(parsed);
  assert.equal(repeated.errors.length, 0);
  assert.equal(repeated.changed.length, 0);
  assert.equal(repeated.imported[0].version, 'V1');
  assert.equal(listAssetVersions(modelId).length, 1);
  assert.equal(listAssetVersions(agentId).length, 1);

  const duplicateRows = previewAssets([model('intake-duplicate-id'), model('intake-duplicate-id')]);
  assert.match(duplicateRows[1].errors.join(' '), /重复/);
});

test('test configuration versions freeze on use while enterprise status sync stays in place', async () => {
  const id = 'intake-versioned-model';
  const initial = saveAsset(model(id));
  await validateAsset(id, { delay: 0 });
  markAssetUsed(id, 'V1', 'task-intake-history');

  assert.throws(() => saveAsset({ ...getAssetSnapshot(id, 'V1'), apiModel: 'changed-model' }), /已冻结/);
  const sync = model(id, { sourceStatus: '已发布', owner: 'AI 平台组' });
  const statusPreview = previewAssets([sync]);
  assert.equal(statusPreview[0].operation, '同步资产信息');
  const statusResult = importAssets([sync]);
  assert.equal(statusResult.errors.length, 0);
  assert.equal(statusResult.changed[0].version, 'V1');
  assert.equal(getAsset(id).sourceStatus, '已发布');
  assert.equal(getAsset(id).status, 'ready', 'enterprise lifecycle updates do not invalidate sandbox connectivity');
  assert.equal(getAsset(id).immutable, true);

  const connection = updateAssetConnection(id, 'V1', { baseUrl: 'https://api-v2.example.com/v1', apiKey: 'rotated-secret' });
  assert.equal(connection.version, 'V1');
  assert.equal(connection.connectionRevision, initial.connectionRevision + 1);
  assert.equal(connection.status, 'pending');
  assert.equal(connection.immutable, true, 'the tested configuration stays frozen');
  assert.equal('apiKey' in connection, false);
  assert.equal(connection.connectionHistory.at(-1).status, 'pending');
  await validateAsset(id, { version: 'V1', delay: 0 });

  const combined = importAssets([{
    ...model(id), owner: 'AI 平台运维', sourceStatus: '已停用',
    baseUrl: 'https://api-v3.example.com/v1', apiKey: 'third-secret',
  }]);
  assert.equal(combined.errors.length, 0, 'a single enterprise row may update its source status and rotate its connection together');
  assert.equal(combined.changed[0].version, 'V1');
  assert.equal(combined.changed[0].connectionRevision, 3);
  assert.equal(combined.changed[0].sourceStatus, '已停用');

  const next = saveAsset({ ...getAssetSnapshot(id, 'V1'), apiModel: 'qa-model-v2' }, { mode: 'new-version' });
  assert.equal(next.version, 'V2');
  assert.equal(next.status, 'pending');
  assert.equal(next.immutable, false);
  assert.equal(next.credentialConfigured, true);
  assert.equal(getAssetSnapshot(id, 'V1').immutable, true);
  assert.equal(listAssetVersions(id).length, 2);
  assert.equal(getAsset(id).version, 'V2');

  const explicitCopy = saveAsset(getAssetSnapshot(id, 'V2'), { mode: 'new-version' });
  assert.equal(explicitCopy.version, 'V3', 'an explicit new-version action creates a version even with identical configuration');
  assert.deepEqual(explicitCopy.apiModel, next.apiModel);
  assert.equal(listAssetVersions(id).length, 3);
  assert.equal(selectAssetVersion(id, 'V1').version, 'V1');
  assert.equal(getAsset(id).version, 'V1', 'the list can select a historical configuration version');
  assert.equal(getAsset(id).latestVersion, 'V3');
});

test('CSV import preserves quoted delimiters and rejects malformed records', () => {
  const rows = parseAssetImport('id,name\r\na,"Service, East"\r\nb,"two lines\ninside"', 'csv');
  assert.deepEqual(rows, [{ id: 'a', name: 'Service, East' }, { id: 'b', name: 'two lines\ninside' }]);
  assert.throws(() => parseAssetImport('id,name\na,1,2', 'csv'), /列数不一致/);
  assert.throws(() => parseAssetImport('id,name\na,"open', 'csv'), /引号未闭合/);
  assert.throws(() => parseAssetImport('{"records":[]}', 'json'), /资产对象数组/);
  assert.ok(ASSET_IMPORT_EXAMPLE.some((item) => item.kind === 'agent'));
});

test('manual Agent import rejects model dependencies in the upload and registers valid configuration without connectivity checks', async () => {
  const dom = new JSDOM('<div id="modal"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.history = dom.window.history;
  try {
    const router = await import('../src/core/router.js');
    router.nav('assets', 'intake', null, { replace: true });
    const page = await import('../src/pages/asset-intake.js');
    const initial = page.assetIntakePage({ tab: 'connection' });
    assert.match(initial, /企业资产平台连接/);
    assert.match(initial, /模型接入配置/);
    const markup = page.assetIntakePage({ tab: 'manual' });
    assert.match(markup, /批量上传/);
    assert.match(markup, /快捷上传/);
    assert.doesNotMatch(markup, /测试连通|接入状态|测试连通|ai-kind-filter|aiUpload\('model'\)/);
    const manualDOM=JSDOM.fragment(markup);
    const headers=[...manualDOM.querySelectorAll('thead th')].map(node=>node.textContent);
    for(const label of ['资产名称/ID','类型','资产状态','更新时间','操作'])assert.ok(headers.includes(label),label+' is shown');
    assert.equal(headers.includes('最近同步时间'),false);

    const baseId = 'intake-ui-base-model';
    saveAsset(model(baseId));
    await validateAsset(baseId, { delay: 0 });
    const id = 'intake-ui-agent';
    page.actions.aiImport();
    assert.equal(document.querySelector('#modal .ai-notice'),null);
    assert.equal(document.querySelector('#modal .ai-help'),null);
    assert.ok(document.querySelector('.ai-import-tools #ai-import-file'));
    assert.match(document.querySelector('.ai-import-heading').textContent,/上传 JSON \/ CSV.*JSON 模板.*CSV 模板/);
    assert.match(document.querySelector('.ai-import-paste-heading').textContent,/或粘贴清单内容.*填入示例/);
    document.getElementById('ai-import-content').value = JSON.stringify([model('intake-ui-rejected-model')]);
    page.actions.aiPreview();
    assert.equal(document.getElementById('ai-import-confirm').disabled, true);
    assert.match(document.getElementById('ai-import-preview').textContent, /人工上传仅支持 Agent/);
    page.actions.aiConfirmImport();
    assert.equal(getAsset('intake-ui-rejected-model'), null);
    page.actions.aiImport();
    const unconnectedBase = 'intake-ui-mixed-unconnected-model';
    const dependentAgent = 'intake-ui-mixed-unconnected-agent';
    document.getElementById('ai-import-content').value = JSON.stringify([
      model(unconnectedBase), agent(dependentAgent, unconnectedBase),
    ]);
    page.actions.aiPreview();
    const rejectedRows = [...document.querySelectorAll('#ai-import-preview tbody tr')];
    assert.equal(rejectedRows.length, 2);
    assert.match(rejectedRows[0].textContent, /人工上传仅支持 Agent/);
    assert.match(rejectedRows[1].textContent, /需关联被测模型的明确版本/);
    assert.equal(rejectedRows[0].querySelector('td').textContent, '1');
    assert.equal(rejectedRows[1].querySelector('td').textContent, '2');
    assert.equal(document.getElementById('ai-import-confirm').disabled, true);
    page.actions.aiConfirmImport();
    assert.equal(getAsset(unconnectedBase), null);
    assert.equal(getAsset(dependentAgent), null);
    page.actions.aiImport();
    page.actions.aiFillExample();
    assert.ok(JSON.parse(document.getElementById('ai-import-content').value).every(row => row.kind === 'agent'));
    document.getElementById('ai-import-content').value = JSON.stringify([agent(id, baseId)]);
    page.actions.aiPreview();
    assert.equal(document.getElementById('ai-import-confirm').disabled, false);
    page.actions.aiConfirmImport();
    assert.equal(getAsset(id).status, 'ready');
    assert.equal(getAsset(id).validation.actualConnectionVerified, false);
    assert.ok(listTestableAssets({kind:'agent'}).some(row=>row.id===id));

    page.actions.aiFilter('query', id);
    const importedDOM=JSDOM.fragment(page.assetIntakePage());
    const importedRow=importedDOM.querySelector('tbody tr');
    assert.match(importedRow.textContent,/未发布/);
    assert.doesNotMatch(importedRow.textContent,/演示可用|待检查|测试连通/);
    assert.match(importedRow.textContent,/详情/);assert.match(importedRow.textContent,/编辑|新版本/);

    page.actions.aiDetail(id, 'V1');
    assert.match(document.getElementById('drawer').textContent, /未发布/);
    assert.doesNotMatch(document.getElementById('drawer').textContent, /连通检查|保存并检查/);
    assert.equal(getAsset(id).kind, 'agent');
    assert.equal(getAsset(id).baseModelId, baseId);
  } finally {
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.location;
    delete globalThis.history;
  }
});

test('manual Agent configuration preserves frozen versions and refuses model rows at the import boundary', () => {
  const baseId='mdl-deepseek-flash', id='intake-manual-versioned-agent';
  const first=saveManualAgent(agent(id,baseId));
  assert.equal(first.status,'ready');
  assert.equal(first.validation.actualConnectionVerified,false);
  assert.equal(first.lastSyncedAt,undefined);
  markAssetUsed(id,'V1','task-manual-version-freeze');
  assert.throws(()=>saveManualAgent({...getAsset(id,'V1'),image:'company/qa-agent:2.0.0'}),/冻结|新版本/);
  assert.throws(()=>saveManualAgent({...getAsset(id,'V1'),surfaceDeclarations:[{kind:'instruction',path:'RULES.md'}]}),/冻结|新版本/);
  const next=saveManualAgent({...getAsset(id,'V1'),image:'company/qa-agent:2.0.0',enterpriseVersion:'2.0.0'},{mode:'new-version'});
  assert.equal(next.version,'V2');assert.equal(next.immutable,false);
  assert.equal(next.status,'ready');assert.equal(getAssetSnapshot(id,'V1').image,'company/qa-agent:1.0.0');
  assert.equal(getAssetSnapshot(id,'V1').immutable,true);
  const disabled=saveManualAgent(agent('intake-manual-disabled',baseId,{sourceStatus:'已停用'}));
  assert.ok(!listTestableAssets({kind:'agent'}).some(row=>row.id===disabled.id));
  const modelId='intake-manual-forbidden-model',agentId='intake-manual-missing-dependency';
  assert.throws(()=>importManualAgents([model(modelId),agent(agentId,modelId)]),/人工上传仅支持 Agent/);
  assert.equal(getAsset(modelId),null);assert.equal(getAsset(agentId),null);
  const rejected=importManualAgents([agent(agentId,modelId)]);
  assert.equal(rejected.imported.length,0);assert.equal(rejected.errors.length,1);
  const imported=importManualAgents([agent('intake-manual-imported',baseId)]);
  assert.equal(imported.errors.length,0);assert.equal(imported.imported[0].status,'ready');
  assert.equal(importManualAgents([agent('intake-manual-imported',baseId)]).changed.length,0);
});

test('validation completion preserves later connection navigation and another asset detail', async () => {
  const dom = new JSDOM('<div id="modal"></div><div id="drawer"></div><div id="toast"></div>', {url:'http://localhost/'});
  const previous = {window:globalThis.window, document:globalThis.document, location:globalThis.location, history:globalThis.history};
  Object.assign(globalThis, {window:dom.window, document:dom.window.document, location:dom.window.location, history:dom.window.history});
  try {
    const router = await import('../src/core/router.js');
    const page = await import('../src/pages/asset-intake.js');
    const ui = await import('../src/core/ui.js');
    const first = saveAsset(model('intake-async-first'));
    const second = saveAsset(model('intake-async-second'));

    router.nav('platform','intake');
    const singleCheck = page.actions.aiValidate(first.id, 'V1');
    assert.equal(getAsset(first.id).busy, true);
    ui.closeDrawer();
    router.nav('platform','connection-create');
    await singleCheck;
    assert.equal(getAsset(first.id).status, 'ready');
    assert.deepEqual(router.state(), {page:'platform', sub:'connection-create', param:null});
    assert.equal(document.getElementById('drawer').classList.contains('open'), false);

    router.nav('platform','intake');
    page.actions.aiClearSelection();
    page.actions.aiSelect(first.id, 'V1', true);
    const batchCheck = page.actions.aiValidateSelected();
    assert.equal(getAsset(first.id).busy, true);
    ui.closeModal();
    router.nav('platform','connection-create');
    await batchCheck;
    assert.equal(getAsset(first.id).status, 'ready');
    assert.deepEqual(router.state(), {page:'platform', sub:'connection-create', param:null});

    router.nav('platform','intake');
    const checkWhileBrowsing = page.actions.aiValidate(first.id, 'V1');
    assert.equal(getAsset(first.id).busy, true);
    page.actions.aiDetail(second.id, 'V1');
    const secondDetail = document.getElementById('drawer').innerHTML;
    assert.match(document.querySelector('#drawer h2').textContent, /intake-async-second/);
    await checkWhileBrowsing;
    assert.equal(getAsset(first.id).status, 'ready');
    assert.equal(document.getElementById('drawer').classList.contains('open'), true);
    assert.equal(document.getElementById('drawer').innerHTML, secondDetail, 'completed checks cannot replace a later asset detail');
  } finally {
    dom.window.close();
    for (const [key,value] of Object.entries(previous)) value === undefined ? delete globalThis[key] : globalThis[key] = value;
  }
});

test('asset subscribers observe import, check, and usage state changes', async () => {
  const id = 'intake-subscriber-model';
  let updates = 0;
  const unsubscribe = subscribeAssets(() => updates++);
  try {
    saveAsset(model(id));
    await validateAsset(id, { delay: 0 });
    markAssetUsed(id, 'V1', 'task-subscriber');
    assert.ok(updates >= 4);
  } finally {
    unsubscribe();
  }
});

test('new page asset state resets without reading or writing browser storage', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('browser storage must not be used'); } });
  try {
    const page = await import('../src/domain/asset-intake.js?asset-page=fresh');
    assert.equal(page.getAsset('intake-check-model'), null);
    assert.equal(page.getAsset('intake-versioned-model'), null);
    assert.ok(page.listTestableAssets().length > 0, 'the fresh page retains only seeded examples');
    const local = page.saveAsset(model('fresh-page-model'));
    assert.equal(local.version, 'V1');
    assert.equal(local.status, 'pending');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});


test('manual Agent versions are unique by asset name and user label across IDs and preserve history',()=>{
 const config=agent('manual-name-version-a','',{name:'统一命名资产',baseModelVersion:'',enterpriseVersion:'1.0.0'});
 const first=saveManualAgent(config);
 assert.equal(first.baseModelId,'');
 assert.throws(()=>saveManualAgent({...config,id:'manual-name-version-b'}),/同名资产/);
 const second=saveManualAgent({...config,id:'manual-name-version-b',enterpriseVersion:'2.0.0'});
 assert.equal(listManualAgentVersions(config.name).length,2);
 const batch=previewManualAgents([{...config,id:'manual-name-version-c',enterpriseVersion:'3.0.0'},{...config,id:'manual-name-version-d',enterpriseVersion:'3.0.0'}]);
 assert.equal(batch[0].errors.length,0);assert.match(batch[1].errors.join(''),/重复/);
 const next=saveManualAgent({...first,enterpriseVersion:'1.1.0',image:'company/qa-agent:1.1.0'});
 assert.equal(next.version,'V2');assert.equal(getAssetSnapshot(first.id,'V1').enterpriseVersion,'1.0.0');
 markAssetUsed(next.id,next.version,'manual-version-snapshot');
 assert.throws(()=>saveManualAgent({...next,name:'改名'}),/新版本/);
 assert.throws(()=>saveManualAgent({...config,id:'manual-version-empty',enterpriseVersion:''}),/版本号/);
 assert.equal(previewManualAgents([{...config,id:second.id,enterpriseVersion:'2.0.0'}])[0].errors.length,0);
});

test('manual list shows fixed version rows and detail follows the intake form',async()=>{
 const previous={window:globalThis.window,document:globalThis.document,location:globalThis.location,history:globalThis.history};
 const dom=new JSDOM('<div id="drawer"></div><div id="modal"></div><div id="toast"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history});
 try{
  const page=await import('../src/pages/asset-intake.js');
  const name='列表同名测试',config=agent('group-agent-first','',{name,enterpriseVersion:'1.0.0'});
  saveManualAgent(config);saveManualAgent({...config,id:'group-agent-second',enterpriseVersion:'2.0.0'});
  page.selectIntakeTab('manual');page.actions.aiFilter('query',name);
  let fragment=JSDOM.fragment(page.assetIntakePage());
  assert.equal(fragment.querySelectorAll('tbody tr').length,2);
  assert.equal(fragment.querySelector('.ai-version-select'),null);
  assert.deepEqual([...fragment.querySelectorAll('tbody tr')].map(row=>row.children[2].textContent),['1.0.0','2.0.0']);
  assert.match(fragment.querySelector('tbody tr').textContent,/group-agent-first/);
  page.actions.aiDetail('group-agent-first','V1');
  assert.doesNotMatch(document.querySelector('#drawer').textContent,/基座模型|执行服务地址|来源|更新时间/);
  assert.equal(document.querySelector('.ai-version-list'),null);
  assert.deepEqual([...document.querySelectorAll('.ai-section-title')].map(node=>node.textContent),['资产信息','Agent 运行配置','文件注入面']);
  assert.match(document.querySelector('#drawer').textContent,/可执行命令.*qa-agent.*启动参数.*--auto/);
  const menus=[...fragment.querySelectorAll('.dd-menu')];
  assert.equal(menus.length,2);assert.deepEqual([...menus[0].querySelectorAll('button')].map(node=>node.textContent),['新版本','删除']);
  page.actions.aiDeleteAgent('group-agent-first','V1');
  assert.match(document.querySelector('#modal').textContent,/确认删除.*1.0.0/);
  page.actions.aiConfirmDeleteAgent('group-agent-first','V1');assert.equal(getAsset('group-agent-first'),null);
  markAssetUsed('group-agent-second','V1','used-group-agent');
  const protectedDOM=JSDOM.fragment(page.assetIntakePage());
  assert.equal([...protectedDOM.querySelectorAll('.dd-menu button')].find(node=>node.textContent==='删除').disabled,true);
  page.actions.aiConfirmDeleteAgent('group-agent-second','V1');assert.ok(getAsset('group-agent-second'));
  page.actions.aiFilter('query','');
 }finally{dom.window.close();for(const [key,value] of Object.entries(previous))value===undefined?delete globalThis[key]:globalThis[key]=value;}
});


test('Demo Agent image accepts any nonempty value',()=>{
 const config=agent('image-check','');
 for(const image of ['1','company/agent','company/agent:1.0'])assert.equal(assetErrors({...config,image}).length,0,image);
 assert.ok(assetErrors({...config,image:'   '}).some(message=>/镜像/.test(message)));
});


test('manual deletion protects exercised versions and leaves sibling versions intact',()=>{
 const config=agent('delete-version-record','',{enterpriseVersion:'1.0.0'});
 const first=saveManualAgent(config);markAssetUsed(first.id,first.version,'exercised-asset');
 assert.match(manualAgentDeleteError(first.id,first.version),/用于演练/);
 assert.throws(()=>deleteManualAgent(first.id,first.version),/不能删除/);
 const second=saveManualAgent({...config,enterpriseVersion:'2.0.0'},{mode:'new-version'});
 selectAssetVersion(first.id,second.version);deleteManualAgent(first.id,second.version);
 assert.equal(getAsset(first.id).version,'V1');assert.equal(getAsset(first.id).latestVersion,'V1');
 assert.equal(getAssetSnapshot(first.id,'V2'),null);assert.equal(getAsset(first.id).usedBy[0],'exercised-asset');
 const third=saveManualAgent({...config,enterpriseVersion:'3.0.0'},{mode:'new-version'});
 assert.equal(third.version,'V3','a deleted internal identity is never reused');
 assert.throws(()=>deleteManualAgent('platform-enterprise-demo:agent','V1'),/人工上传/);
 const modelId='delete-protect-model';saveAsset(model(modelId));assert.throws(()=>deleteManualAgent(modelId,'V1'),/人工上传/);
});
