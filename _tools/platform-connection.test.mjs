import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { getAsset, getPlatformConnection, listAssetVersions, listPlatformConnections, saveAsset, savePlatformConnection } from '../src/domain/asset-intake.js';
import {
  DEFAULT_MAPPING, newConnectionDraft, connectionErrors, testConnection,
  connectionRecords, filteredSourceRows, previewConnection,
  importConnectionSelection, syncPlatformConnection,
} from '../src/domain/platform-connection.js';

const draft = (id, extra = {}) => newConnectionDraft({
  id, name:'字段映射测试平台', owner:'测试平台组', baseUrl:'https://assets.example.test',
  authType:'none', ...extra,
});
const save = config => savePlatformConnection({...config, endpoint:config.baseUrl});

async function withoutNetworkOrScheduler(run) {
  const previous = {fetch:globalThis.fetch, setInterval:globalThis.setInterval};
  globalThis.fetch = () => { throw Error('platform demo must not send a network request'); };
  globalThis.setInterval = () => { throw Error('saved sync preferences must not start a background scheduler'); };
  try { return await run(); }
  finally { Object.assign(globalThis, previous); }
}

test('demo connection requires nonempty address fields without contacting a remote platform', async () => {
  await withoutNetworkOrScheduler(async () => {
    const config = draft('platform-contract');
    assert.deepEqual(connectionErrors(config, {mapping:true, scope:true, rules:true}), []);
    const result = await testConnection(config);
    assert.equal(result.mode, 'demo');
    assert.equal(result.actualConnected, false);
    assert.equal(result.count, connectionRecords(config).length);
    assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
    for (const baseUrl of ['', '   ']) {
      assert.match(connectionErrors({...config, baseUrl}).join('；'), /API 地址/);
    }
    for (const resourcePath of ['', '   ']) {
      assert.match(connectionErrors({...config, resourcePath}).join('；'), /资源路径/);
    }
    assert.match(connectionErrors({...config, authType:'bearer'}).join('；'), /凭据/);
    assert.match(connectionErrors({...config, timeout:4}).join('；'), /超时/);
    assert.match(connectionErrors({...config, timeout:30.5}).join('；'), /超时/);
    assert.match(connectionErrors({...config, listPath:'data[0].items'}, {mapping:true}).join('；'), /响应列表路径/);
    assert.match(connectionErrors({...config, listPath:'data.missing'}, {mapping:true}).join('；'), /未指向演示目录数组/);
    assert.match(connectionErrors({...config, selectedIds:[]}, {scope:true}).join('；'), /至少选择一项/);
    assert.match(connectionErrors({...config, interval:7}, {rules:true}).join('；'), /同步间隔/);
    await assert.rejects(testConnection({...config, baseUrl:''}), /API 地址/);
    const placeholder = draft('platform-placeholder-address', {baseUrl:'1', resourcePath:'1'});
    assert.deepEqual(connectionErrors(placeholder, {mapping:true, scope:true, rules:true}), []);
    assert.equal((await testConnection(placeholder)).actualConnected, false);
    const saved = save(placeholder);
    assert.equal(saved.endpoint, '1');
    assert.equal(saved.resourcePath, '1');
    const synced = syncPlatformConnection(saved.id);
    assert.equal(synced.errors.length, 0);
    assert.equal(synced.imported.length, 2);
    assert.ok(synced.imported.every(asset => asset.sourceStatus === '已发布'));
    assert.ok(getPlatformConnection(saved.id).lastSyncedAt);
  });
});

test('Agent-only scope imports only the selected Agent with no model binding or dependency', () => {
  const config = draft('platform-mapped-agent', {
    kinds:['agent'], environment:'预发布', department:'智能应用部', selectedIds:['agent'],
    mapping:{...DEFAULT_MAPPING, name:'owner'},
  });
  save(config);
  assert.deepEqual(filteredSourceRows(config).map(row => row.id), ['agent']);
  const preview = previewConnection(config);
  assert.deepEqual(preview.map(row => row.sourceId), ['agent']);
  assert.equal(preview[0].operation,'新增');
  assert.ok(preview.every(row => row.errors.length === 0));
  assert.ok(preview.every(row => row.raw.name === config.owner && row.raw.sourceStatus === '已发布'));
  assert.equal(preview[0].raw.baseModelId, '');
  const result = importConnectionSelection(config);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.imported.map(row => row.kind), ['agent']);
  assert.equal(getAsset(config.id + ':model'),null);
  assert.equal(result.imported[0].baseModelId,'');
  for (const asset of result.imported) {
    assert.equal(asset.name, config.owner);
    assert.equal(asset.sourceStatus, '已发布');
    assert.equal(asset.platformConnectionId, config.id);
    assert.equal(asset.sourceKind, 'enterprise_demo');
    assert.equal(asset.enterpriseVersion, '1.0.0');
    assert.equal(asset.sourceUpdatedAt, '2026-11-24T00:00:00.000Z');
  }
  const repeated = importConnectionSelection(config);
  assert.equal(repeated.errors.length, 0);
  assert.equal(repeated.changed.length, 0);
  assert.equal(listAssetVersions(config.id + ':agent').length, 1);
});

test('Agent resync clears an old platform model binding while keeping source version labels and history', () => {
  const config=draft('platform-unbind-agent',{kinds:['agent'],selectedIds:['agent'],owner:'release-2026.11',mapping:{...DEFAULT_MAPPING,version:'owner'}});
  save(config);
  const raw=previewConnection(config)[0].raw;
  saveAsset({...raw,baseModelId:'mdl-deepseek-flash',baseModelVersion:'V1'});
  const preview=previewConnection(config);
  assert.equal(preview.length,1);assert.equal(preview[0].operation,'更新配置');
  assert.doesNotMatch(preview[0].operation,/V\d+/);
  assert.equal(preview[0].raw.enterpriseVersion,'release-2026.11');
  const result=syncPlatformConnection(config.id);
  assert.equal(result.imported.length,1);assert.equal(result.errors.length,0);
  const latest=getAsset(raw.id);
  assert.equal(latest.baseModelId,'');assert.equal(latest.enterpriseVersion,'release-2026.11');
  assert.equal(getAsset(raw.id,'V1').baseModelId,'mdl-deepseek-flash');
  assert.equal(listAssetVersions(raw.id).length,2);
  assert.equal(getAsset(config.id+':model'),null);
  assert.equal(getPlatformConnection(config.id).lastCount,1);
});

test('sync preserves raw nonstandard enterprise states and ignores obsolete enum conversion rules', () => {
  const legacyRules = {'灰度中':'已停用', '已发布':'未发布'};
  const config = draft('platform-raw-enterprise-status', {
    owner:'灰度中', mapping:{...DEFAULT_MAPPING,status:'owner'}, statusMap:legacyRules,
  });
  assert.equal(Object.hasOwn(config,'statusMap'), false, 'legacy enum rules are not editable connection configuration');
  assert.ok(connectionRecords(config).every(row=>row.status==='已发布'));
  assert.deepEqual(connectionErrors({...config,statusMap:{'灰度中':'未知旧规则'}},{mapping:true,scope:true,rules:true}),[]);
  const preview = previewConnection({...config,statusMap:legacyRules});
  assert.ok(preview.every(row=>row.raw.sourceStatus==='灰度中' && row.errors.length===0));
  const saved = save({...config,statusMap:legacyRules});
  assert.equal(Object.hasOwn(saved,'statusMap'),false);
  const synced = syncPlatformConnection(saved.id);
  assert.equal(synced.errors.length,0);
  assert.equal(synced.imported.length,2);
  assert.ok(synced.imported.every(row=>row.sourceStatus==='灰度中'));
  assert.equal(getAsset(saved.id+':agent').sourceStatus,'灰度中');
  assert.equal(syncPlatformConnection(saved.id).changed.length,0);
});

test('invalid mappings cannot partially import a catalog', () => {
  const unsaved = draft('platform-unsaved-draft');
  assert.throws(() => importConnectionSelection(unsaved), /先保存|连接不存在/);
  assert.equal(getAsset(unsaved.id + ':model'), null);
  const config = draft('platform-invalid-mapping');
  save(config);
  const invalid = {...config, mapping:{...config.mapping, endpoint:'name'}};
  assert.ok(previewConnection(invalid).some(row => row.errors.length));
  assert.throws(() => importConnectionSelection(invalid), /预览存在无效资产/);
  assert.equal(getAsset(config.id + ':model'), null);
  assert.equal(getAsset(config.id + ':agent'), null);
  const collision = {...config, mapping:{...config.mapping, id:'owner'}};
  assert.ok(previewConnection(collision).some(row => /重复/.test(row.errors.join('；'))));
  assert.throws(() => importConnectionSelection(collision), /预览存在无效资产/);
});

test('platform reading credentials never become model invocation credentials or exported data', async () => {
  await withoutNetworkOrScheduler(async () => {
    const marker = 'platform-reading-test-secret';
    const config = draft('platform-credential-isolation', {
      authType:'bearer', credential:marker, credentialRef:'vault://platform/read-only',
    });
    const saved = save(config);
    assert.equal(saved.actualConnected, false);
    assert.equal(saved.mode, 'demo');
    assert.equal(saved.credentialConfigured, true);
    assert.equal(JSON.stringify(saved).includes(marker), false);
    const editable = newConnectionDraft(saved);
    assert.equal(editable.credential, '');
    assert.deepEqual(connectionErrors(editable), []);
    await testConnection(editable);
    const result = syncPlatformConnection(saved.id);
    assert.equal(result.actualConnected, false);
    assert.equal(result.mode, 'demo');
    assert.equal(JSON.stringify(result).includes(marker), false);
    const model = getAsset(saved.id + ':model');
    assert.equal(model.credentialRef, '');
    assert.equal(model.credentialConfigured, false);
    assert.equal('apiKey' in model, false);
    assert.ok(getPlatformConnection(saved.id).lastSyncedAt);
  });
});

test('editing a connection retains mapping, scope, and sync preferences without starting scheduled work', async () => {
  await withoutNetworkOrScheduler(async () => {
    const config = draft('platform-edit-roundtrip', {
      connector:'standard', resourcePath:'/v2/assets', pageMode:'page', listPath:'payload.rows',
      authType:'apikey', credentialRef:'vault://platform/catalog', apiKeyHeader:'X-Enterprise-Catalog-Key',
      timeout:45, mapping:{...DEFAULT_MAPPING, name:'owner'},
      kinds:['agent'], environment:'预发布', department:'智能应用部', selectedIds:['agent'],
      autoInclude:false, notifyChanges:false, interval:60, reconcile:'每周', webhook:true,
    });
    const initial = save(config);
    const edit = newConnectionDraft(getPlatformConnection(initial.id));
    for (const key of ['connector','resourcePath','pageMode','listPath','authType','apiKeyHeader','timeout','mapping','kinds','environment','department','selectedIds','autoInclude','notifyChanges','interval','reconcile','webhook']) {
      assert.deepEqual(edit[key], config[key], key + ' survives edit');
    }
    assert.throws(() => syncPlatformConnection(initial.id), /响应列表路径/);
    assert.equal(getPlatformConnection(initial.id).lastSyncedAt, null);
    edit.listPath = 'data.items';
    edit.name = '编辑后的平台';
    const updated = save(edit);
    assert.equal(updated.id, initial.id);
    assert.equal(updated.createdAt, initial.createdAt);
    const result = syncPlatformConnection(updated.id);
    assert.equal(result.errors.length, 0);
    assert.equal(result.imported.length, 1);
    assert.ok(result.imported.every(row => row.sourceStatus === '已发布' && row.name === config.owner));
    const synced = getPlatformConnection(updated.id);
    assert.equal(synced.lastSyncedAt, result.syncedAt);
    assert.equal(synced.lastImportedAt, result.syncedAt);
    assert.equal(synced.lastCount, 1);
    assert.equal(synced.actualConnected, false);
    assert.equal(syncPlatformConnection(updated.id).changed.length, 0);
  });
});

test('the five-step connection page saves independently and synchronizes exactly its selected Agent scope', async () => {
  const dom = new JSDOM('<main id="app-main"></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', {url:'http://localhost/'});
  const previous = {window:globalThis.window, document:globalThis.document, location:globalThis.location, history:globalThis.history};
  Object.assign(globalThis, {window:dom.window, document:dom.window.document, location:dom.window.location, history:dom.window.history});
  const router = await import('../src/core/router.js');
  const page = await import('../src/pages/platform-connection.js');
  const activeStep = () => document.querySelector('[aria-current="step"]')?.textContent;
  const main = document.getElementById('app-main');
  const render = () => main.innerHTML = router.state().sub.startsWith('connection-') ? page.platformConnectionPage() : '<p>资产接入列表</p>';
  try {
    await withoutNetworkOrScheduler(async () => {
      router.setRenderer(render);
      router.nav('platform','connection-create');
      assert.equal(document.querySelectorAll('.ai-wizard-steps li').length, 5);
      assert.equal(document.querySelector('.pc-page')?.closest('#modal'), null);
      page.actions.pcNext();
      assert.match(document.getElementById('pc-error').textContent, /请先测试连通/);
      page.actions.pcField('name','UI 五步平台');
      page.actions.pcField('owner','试运营');
      page.actions.pcField('baseUrl','1');
      page.actions.pcField('resourcePath','1');
      page.actions.pcField('authType','none');
      await page.actions.pcTest();
      assert.match(document.querySelector('.ai-test-ok').textContent, /演示目录/);
      main.scrollTop = 460;
      page.actions.pcNext();
      assert.match(activeStep(), /映射字段/);
      assert.equal(document.querySelector('[id^="pc-status-"]'),null);
      assert.equal('pcStatusMap' in page.actions,false);
      assert.equal(document.getElementById('pc-map-status').value,'status');
      assert.doesNotMatch(document.querySelector('.ai-wizard-content').textContent,/状态枚举|状态值转换|默认映射可直接使用/);
      assert.equal(main.scrollTop, 0, 'advancing a step reveals its heading and fields');
      main.scrollTop = 280;
      page.actions.pcPrev();
      assert.match(activeStep(), /连接平台/);
      assert.equal(main.scrollTop, 0, 'returning to a step reveals its heading and fields');
      page.actions.pcNext();
      main.scrollTop = 180;
      page.actions.pcMapField('name','owner');
      assert.equal(main.scrollTop, 180, 'editing a field preserves the current step scroll position');
      page.actions.pcMapField('status','owner');
      page.actions.pcNext();
      assert.match(activeStep(), /选择范围/);
      assert.match(document.querySelector('.ai-wizard-content table').textContent,/试运营/);
      assert.doesNotMatch(document.querySelector('.ai-wizard-content').textContent,/依赖|自动补齐|基座模型/);
      page.actions.pcScopeKind('model',false);
      page.actions.pcScopeFilter('environment','预发布');
      page.actions.pcScopeAll(false);
      page.actions.pcNext();
      assert.match(activeStep(), /选择范围/);
      assert.match(document.getElementById('pc-error').textContent, /至少选择一项/);
      page.actions.pcScopeAll(true);
      page.actions.pcNext();
      assert.equal(document.querySelector('.ai-sync-policy'),null);
      assert.doesNotMatch(document.querySelector('.ai-wizard-content').textContent,/首次全量同步|定期增量同步|同步按唯一 ID|尚未接通/);
      page.actions.pcField('interval',60);
      page.actions.pcField('reconcile','每周');
      page.actions.pcField('autoInclude',false);
      page.actions.pcNext();
      assert.match(activeStep(), /预览并同步/);
      assert.doesNotMatch(document.querySelector('.ai-wizard-content').textContent, /依赖补齐|自动补齐基模|新增\s*V\d+|新版本\s*V\d+/);
      assert.match(document.querySelector('.ai-preview-summary').textContent,/1 项资产/);
      const previewTable=[...document.querySelectorAll('.ai-wizard-content table')].find(table=>table.querySelector('thead')?.textContent.includes('处理方式'));
      assert.equal(previewTable.querySelectorAll('tbody tr').length,1);
      assert.equal(previewTable.querySelectorAll('tbody td')[2].textContent,'新增');
      assert.match(document.querySelector('.ai-wizard-content').textContent,/试运营/);
      assert.doesNotMatch(document.querySelector('.ai-wizard-content').textContent,/仍需分别检查演练连接|平台读取凭据不会作为/);
      page.actions.pcSave(false);
      assert.equal(router.state().sub, 'intake');
      const saved = listPlatformConnections().find(row => row.name === 'UI 五步平台');
      assert.ok(saved);
      assert.equal(saved.endpoint, '1');
      assert.equal(saved.resourcePath, '1');
      assert.equal(saved.mapping.name, 'owner');
      assert.equal(saved.mapping.status, 'owner');
      assert.equal(Object.hasOwn(saved,'statusMap'),false);
      assert.deepEqual(saved.kinds, ['agent']);
      assert.deepEqual(saved.selectedIds, ['agent']);
      assert.equal(saved.interval, 60);
      assert.equal(saved.reconcile, '每周');
      assert.equal(saved.lastSyncedAt, null);
      assert.equal(getAsset(saved.id + ':agent'), null, 'save without sync does not import assets');

      router.nav('platform','connection-edit',saved.id);
      assert.equal(document.getElementById('pc-name').value, saved.name);
      assert.equal(document.getElementById('pc-baseUrl').value, saved.endpoint);
      page.actions.pcField('owner','未保存的负责人');
      page.actions.pcCancel();
      assert.equal(router.state().sub, 'connection-edit');
      assert.match(document.getElementById('modal').textContent, /连接配置尚未保存/);
      page.actions.pcStay();
      assert.equal(router.state().sub, 'connection-edit');
      page.actions.pcCancel();
      page.actions.pcDiscard();
      assert.equal(router.state().sub, 'intake');
      assert.equal(getPlatformConnection(saved.id).owner, saved.owner);

      router.nav('platform','connection-edit',saved.id);
      await page.actions.pcTest();
      page.actions.pcNext();
      assert.equal(document.getElementById('pc-map-name').value, 'owner');
      page.actions.pcNext();
      page.actions.pcNext();
      assert.equal(document.getElementById('pc-interval').value, '60');
      assert.equal(document.getElementById('pc-autoInclude').checked, false);
      page.actions.pcNext();
      page.actions.pcSave(true);
      assert.equal(router.state().sub, 'intake');
      assert.ok(getPlatformConnection(saved.id).lastSyncedAt);
      assert.equal(getAsset(saved.id + ':agent').baseModelId, '');
      assert.equal(getAsset(saved.id + ':agent').sourceStatus, '试运营');
      assert.equal(getAsset(saved.id + ':model'),null);
      assert.equal(getPlatformConnection(saved.id).lastCount,1);
    });
  } finally {
    if (router.state().sub.startsWith('connection-')) { page.actions.pcCancel(); page.actions.pcDiscard(); }
    router.setRenderer(null);
    dom.window.close();
    for (const [key,value] of Object.entries(previous)) value === undefined ? delete globalThis[key] : globalThis[key] = value;
  }
});
