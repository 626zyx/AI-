/* Enterprise connections consume a fixed asset protocol. The demo uses a local
 * catalog and never sends credentials or requests to a remote API. */
import { getPlatformConnection, listPlatformConnections, savePlatformConnection, recordPlatformSync } from './asset-intake.js';
import { listApplicationAssets, syncApplicationAssets } from './application-assets.js';

const clean = value => String(value ?? '').trim();
const STORAGE_KEY = 'ai-range-platform-connections-v1';
let connectionSerial = 0;

function fullAddress(existing) {
  const base = clean(existing.baseUrl || existing.endpoint);
  const path = clean(existing.resourcePath);
  return path ? base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '') : base;
}

export function newConnectionDraft(existing = {}) {
  return {
    ...(existing.id ? {id:existing.id} : {}),
    name:clean(existing.name), baseUrl:fullAddress(existing), credential:'',
    credentialConfigured:Boolean(existing.credentialConfigured || existing.credentialRef),
  };
}

export function connectionErrors(connection) {
  const errors = [];
  if (!clean(connection.name)) errors.push('请填写平台名称');
  if (!clean(connection.baseUrl)) errors.push('请填写 API 地址');
  else {
    try {
      const url = new URL(clean(connection.baseUrl));
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw Error();
    } catch { errors.push('请填写有效的 HTTP 或 HTTPS API 地址'); }
  }
  return errors;
}

export function connectionRecords() {
  return [
    {sourceRecordId:'agent', name:'业务智能体1镜像', enterpriseVersion:'1.0.0', sourceStatus:'已发布', addressType:'image', address:'registry.example.com/business/agent-1:1.0.0', sourceUpdatedAt:'2026-11-24T00:00:00.000Z'},
    {sourceRecordId:'application-code', name:'业务应用2代码包', enterpriseVersion:'1.0.0', sourceStatus:'未发布', addressType:'package', address:'https://artifacts.example.com/business-app-2/v1.0.0.zip', sourceUpdatedAt:'2026-11-24T00:00:00.000Z'},
  ];
}

export async function testConnection(connection) {
  const errors = connectionErrors(connection);
  if (errors.length) throw Error(errors.join('；'));
  return {mode:'demo', actualConnected:false, checkedAt:new Date().toISOString(), count:connectionRecords(connection).length};
}

function connectionMetadata(row) {
  return {
    id:row.id, name:row.name, createdAt:row.createdAt, endpoint:fullAddress(row), resourcePath:'',
    credentialConfigured:Boolean(row.credentialConfigured), authType:row.credentialConfigured ? 'bearer' : 'none',
    state:row.state, lastSyncedAt:row.lastSyncedAt ?? null, lastImportedAt:row.lastImportedAt ?? null, lastCount:row.lastCount,
  };
}
// Only public connection metadata is durable. Commit storage before changing the
// in-memory connection so a failed save cannot leave a seemingly saved row.
function persistConnections(rows = listPlatformConnections()) {
  try {
    const storage = globalThis.localStorage || globalThis.window?.localStorage;
    if (!storage) {
      if (typeof window === 'undefined') return; // Non-browser domain checks.
      throw Error();
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(rows.map(connectionMetadata)));
  } catch { throw Error('平台连接保存失败，请检查浏览器存储空间后重试'); }
}

function restoreConnections() {
  try {
    if (typeof localStorage === 'undefined') return;
    const rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (!row || typeof row !== 'object' || connectionErrors({name:row.name, baseUrl:row.endpoint}).length) continue;
      savePlatformConnection({id:row.id, name:row.name, endpoint:row.endpoint, resourcePath:'',
        credentialConfigured:Boolean(row.credentialConfigured), authType:row.credentialConfigured ? 'bearer' : 'none',
        createdAt:row.createdAt,state:row.state || 'connected', lastSyncedAt:row.lastSyncedAt, lastImportedAt:row.lastImportedAt, lastCount:row.lastCount});
    }
  } catch { /* An invalid saved list must not prevent the settings page from opening. */ }
}

export function saveConnection(connection) {
  const errors = connectionErrors(connection);
  if (errors.length) throw Error(errors.join('；'));
  const configured = Boolean(clean(connection.credential) || connection.credentialConfigured);
  const id = connection.id || 'platform-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + ++connectionSerial);
  if (!/^[\w.:-]{1,100}$/.test(id)) throw Error('平台连接 ID 格式不正确');
  const payload = {
    id, name:clean(connection.name),
    endpoint:clean(connection.baseUrl).replace(/\/+$/, ''), resourcePath:'', authType:configured ? 'bearer' : 'none',
    credential:clean(connection.credential), credentialConfigured:configured, state:'connected',
  };
  const previous = getPlatformConnection(id);
  payload.createdAt=previous?.createdAt||new Date().toISOString();
  const next = {...previous, ...payload, baseUrl:payload.endpoint};
  persistConnections([...listPlatformConnections().filter(row => row.id !== id), next]);
  return savePlatformConnection(payload);
}

export function syncPlatformConnection(id) {
  const connection = getPlatformConnection(id);
  if (!connection) throw Error('平台连接不存在');
  if (connection.state !== 'connected') throw Error('平台尚未连通，请先测试连通后再同步');
  const errors = connectionErrors(newConnectionDraft(connection));
  if (errors.length) throw Error(errors.join('；'));
  // Fail before asset writes when the browser cannot retain connection records.
  persistConnections();
  const before = new Map(listApplicationAssets({source:id}).map(asset => [asset.id, asset.versions.length]));
  const result = syncApplicationAssets(connection, connectionRecords(connection));
  if (result.errors.length) throw Error('部分资产未同步，请检查平台返回的资产信息');
  const syncedAt = new Date().toISOString();
  const updated = {...connection, lastSyncedAt:syncedAt, lastImportedAt:syncedAt, lastCount:result.imported.length};
  try { persistConnections(listPlatformConnections().map(row => row.id === id ? updated : row)); }
  catch { throw Error('资产已保存，但同步记录保存失败，请检查浏览器存储空间后重试同步'); }
  recordPlatformSync(id, result.imported, syncedAt);
  const changed = result.imported.filter(asset => before.get(asset.id) !== asset.versions.length);
  return {...result, changed, mode:'demo', actualConnected:false, syncedAt};
}

restoreConnections();
