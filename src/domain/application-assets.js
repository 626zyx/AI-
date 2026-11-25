import { listAssets, listAssetVersions, getPlatformConnection } from './asset-intake.js';
import { registerApplicationTargetDirectory } from './application-target.js';

registerApplicationTargetDirectory(id => getApplicationAsset(id));

// Settings owns a durable directory of enterprise metadata. Execution configuration
// and existing task snapshots remain in their original stores.
export const APPLICATION_STORAGE_KEY = 'ai-range.application-assets.v1';
export const APPLICATION_STATUSES = ['未发布', '已发布', '已下架', '已停用'];
export const APPLICATION_ADDRESS_TYPES = [
  { value: 'git', label: '代码仓库' }, { value: 'image', label: '容器镜像' },
  { value: 'package', label: '文件包' }, { value: 'object', label: '对象存储' },
  { value: 'other', label: '其他地址' },
];
const copy = value => JSON.parse(JSON.stringify(value));
const clean = value => String(value ?? '').trim();
const now = () => new Date().toISOString();
const encode = value => encodeURIComponent(value).replaceAll("'", '%27');
const identity = (source, id) => `${source ? 'platform:' + encode(source) : 'manual'}:${encode(id)}`;
const metadataFields = ['assetId', 'name', 'enterpriseVersion', 'sourceStatus', 'addressType', 'address', 'sourceUpdatedAt', 'sourceName'];
let fallbackState;

const addressTypeValue = value => {
  const text = clean(value);
  return APPLICATION_ADDRESS_TYPES.find(type => type.value === text.toLowerCase() || type.label === text)?.value || text;
};
export function applicationAddressTypeLabel(value) {
  return APPLICATION_ADDRESS_TYPES.find(type => type.value === addressTypeValue(value))?.label || '其他地址';
}
function inferAddressType(address) {
  const text = clean(address), path = text.split(/[?#]/, 1)[0];
  if (/^(?:s3|oss|cos|gs):\/\//i.test(text)) return 'object';
  if (/\.(?:zip|tar(?:\.(?:gz|bz2|xz|zst))?|tgz|tbz2|txz|gz|bz2|xz|7z|rar|whl|jar|war|deb|rpm|apk)$/i.test(path)) return 'package';
  if (/^(?:git|git\+https?|git\+ssh):\/\//i.test(text) || /(?:^|[/:])[^/]+\.git\/?$/i.test(path)) return 'git';
  try {
    const url = new URL(text), host = url.hostname.toLowerCase();
    if (['http:', 'https:', 'ssh:'].includes(url.protocol) && ['github.com', 'gitlab.com', 'gitee.com', 'bitbucket.org', 'codeberg.org'].some(domain => host === domain || host.endsWith('.' + domain))) return 'git';
  } catch { /* Non-URL image references and unknown locations are valid metadata. */ }
  if (/^git@(?:github\.com|gitlab\.com|gitee\.com|bitbucket\.org|codeberg\.org):[^\s]+$/i.test(text)) return 'git';
  if (/^(?:docker|oci):\/\//i.test(text)) return 'image';
  if (!text.includes('://') && /^(?:[a-z0-9.-]+(?::\d+)?\/)?[a-z0-9._-]+(?:\/[a-z0-9._-]+)+(?:[\:][a-zA-Z0-9_.-]+|@sha256:[a-f0-9]{64})$/.test(text)) return 'image';
  return 'other';
}
function migrateRecord(record, source = record.platformConnectionId) {
  const candidate = addressTypeValue(record.addressType);
  const addressType = APPLICATION_ADDRESS_TYPES.some(type => type.value === candidate) ? candidate : candidate ? 'other' : inferAddressType(record.address);
  return { ...record, addressType, ...(!source ? { sourceName: '手动上传' } : {}) };
}
function migratedState(saved) {
  const assets = saved.assets.map(asset => ({ ...migrateRecord(asset), versions: (asset.versions || []).map(version => migrateRecord(version, asset.platformConnectionId)) }));
  const migrated = { ...saved, assets };
  if (JSON.stringify(migrated) !== JSON.stringify(saved)) persist(migrated);
  return migrated;
}

function storage() {
  return globalThis.localStorage || globalThis.window?.localStorage || null;
}
function persist(state) {
  const target = storage();
  if (target) {
    try { target.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(state)); }
    catch { throw Error('资产信息保存失败，请检查浏览器存储空间后重试'); }
  }
  fallbackState = copy(state);
}
function snapshot(asset) {
  const { versions, ...fields } = asset;
  return copy(fields);
}
function legacyDirectory() {
  const assets = listAssets().filter(asset => asset.kind === 'agent' || asset.platformConnectionId);
  return assets.map(asset => {
    const source = clean(asset.platformConnectionId);
    const enterpriseId = source ? clean(asset.sourceRecordId || asset.id) : asset.id;
    const connection = source ? getPlatformConnection(source) : null;
    const versions = listAssetVersions(asset.id).map(version => ({
      id: identity(source, enterpriseId), assetId: enterpriseId,
      name: version.name, enterpriseVersion: clean(version.enterpriseVersion || version.version),
      sourceStatus: version.sourceStatus || '未发布',
      address: clean(version.address || version.runtimeEndpoint || version.image || version.baseUrl),
      sourceUpdatedAt: version.sourceUpdatedAt || version.updatedAt,
      updatedAt: version.updatedAt, createdAt: version.createdAt,
      platformConnectionId: source, sourceName: connection?.name || (source ? asset.source : '手动上传'),
      lastSyncedAt: version.lastSyncedAt || null,
    }));
    return { ...migrateRecord(versions.at(-1)), versions: versions.map(version => migrateRecord(version)) };
  });
}
function state() {
  const target = storage();
  if (target) {
    let raw;
    try { raw = target.getItem(APPLICATION_STORAGE_KEY); }
    catch { throw Error('无法读取已保存的资产信息'); }
    if (raw !== null) {
      let saved;
      try {
        saved = JSON.parse(raw);
        if (saved.schema !== 1 || !Array.isArray(saved.assets)) throw Error();
      } catch { throw Error('已保存的资产信息无法读取，请保留浏览器数据并联系管理员'); }
      return migratedState(saved);
    }
  } else if (fallbackState) return migratedState(copy(fallbackState));
  const initial = { schema: 1, assets: legacyDirectory() };
  persist(initial);
  return initial;
}
function recordErrors(data) {
  const errors = [];
  if (!data.assetId) errors.push('请填写资产 ID');
  else if (data.assetId.length > 120 || /[\u0000-\u001f\u007f]/.test(data.assetId)) errors.push('资产 ID 最长 120 个字符，不能包含控制字符');
  if (!data.name) errors.push('请填写资产名称');
  if (!data.enterpriseVersion) errors.push('请填写版本信息');
  if (!data.sourceStatus) errors.push('请填写发布状态');
  if (!data.addressType) errors.push('请选择地址类型');
  else if (!APPLICATION_ADDRESS_TYPES.some(type => type.value === data.addressType)) errors.push('地址类型需为代码仓库、容器镜像、文件包、对象存储或其他地址');
  if (!data.address) errors.push('请填写资产地址');
  else if (/^(?:javascript|data|vbscript|file):/i.test(data.address.replace(/[\u0000-\u0020]/g, '')) || /[\r\n\u0000]/.test(data.address)) errors.push('请填写有效的资产获取地址');
  if (data.sourceUpdatedAt && !Number.isFinite(Date.parse(data.sourceUpdatedAt))) errors.push('更新时间格式不正确');
  return errors;
}
function metadata(raw, previous = {}) {
  const address = clean(raw.address ?? previous.address);
  const addressType = Object.hasOwn(raw, 'addressType') ? addressTypeValue(raw.addressType)
    : address === previous.address && previous.addressType ? previous.addressType : inferAddressType(address);
  return {
    assetId: clean(raw.assetId ?? raw.sourceRecordId ?? raw.id ?? previous.assetId),
    name: clean(raw.name ?? previous.name),
    enterpriseVersion: clean(raw.enterpriseVersion ?? previous.enterpriseVersion),
    sourceStatus: clean(raw.sourceStatus ?? previous.sourceStatus),
    addressType, address,
    sourceUpdatedAt: clean(raw.sourceUpdatedAt ?? raw.updatedAt ?? previous.sourceUpdatedAt),
  };
}
function putAsset(store, data, source, sourceName, at = now()) {
  const id = identity(source, data.assetId);
  const previous = store.assets.find(asset => asset.id === id);
  const next = { ...previous, ...data, id, platformConnectionId: source, sourceName,
    createdAt: previous?.createdAt || at, updatedAt: previous?.updatedAt || at,
    lastSyncedAt: source ? at : null };
  const changed = !previous || metadataFields.some(field => previous[field] !== next[field]);
  next.versions = copy(previous?.versions || []);
  if (changed) {
    next.updatedAt = at;
    if (!next.sourceUpdatedAt) next.sourceUpdatedAt = at;
    next.versions.push(snapshot(next));
  }
  if (previous) store.assets[store.assets.indexOf(previous)] = next;
  else store.assets.unshift(next);
  return next;
}

export function listApplicationAssets({ source = 'all', query = '', sourceStatus = 'all', addressType = 'all' } = {}) {
  const q = clean(query).toLowerCase();
  return copy(state().assets.map(currentSource).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).filter(asset =>
    (!source || source === 'all' || (source === 'manual' ? !asset.platformConnectionId : asset.platformConnectionId === source)) &&
    (!sourceStatus || sourceStatus === 'all' || asset.sourceStatus === sourceStatus) &&
    (!addressType || addressType === 'all' || asset.addressType === addressTypeValue(addressType)) &&
    (!q || [asset.name, asset.assetId, asset.address, asset.sourceName].join(' ').toLowerCase().includes(q))
  ));
}
function currentSource(asset) {
  const connection = asset.platformConnectionId ? getPlatformConnection(asset.platformConnectionId) : null;
  return connection ? { ...asset, sourceName: connection.name } : asset;
}
export function getApplicationAsset(id) {
  const asset = state().assets.find(row => row.id === id);
  return asset ? copy(currentSource(asset)) : null;
}
export function saveManualApplication(raw, { id } = {}) {
  const store = state();
  const explicit = id ? store.assets.find(asset => asset.id === id) : null;
  if (id && !explicit) throw Error('资产不存在');
  if (explicit?.platformConnectionId || raw.platformConnectionId) throw Error('平台同步资产由来源平台维护，不能编辑');
  const requestedId = clean(raw.assetId ?? raw.id ?? explicit?.assetId);
  const existing = explicit || store.assets.find(asset => !asset.platformConnectionId && asset.assetId === requestedId);
  const data = metadata(raw, existing || {});
  if (!data.assetId) data.assetId = 'app-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9));
  if (existing && data.assetId !== existing.assetId) throw Error('已有资产的 ID 不能修改');
  const errors = recordErrors(data);
  if (errors.length) throw Error(errors.join('；'));
  if (!APPLICATION_STATUSES.includes(data.sourceStatus)) throw Error('请选择有效的发布状态');
  const at = now();
  if (existing && !raw.sourceUpdatedAt && !raw.updatedAt && ['name', 'enterpriseVersion', 'sourceStatus', 'addressType', 'address'].some(field => existing[field] !== data[field])) data.sourceUpdatedAt = at;
  const result = putAsset(store, data, '', '手动上传', at);
  persist(store);
  return copy(result);
}
export function deleteApplicationAsset(id) {
  const store = state(), index = store.assets.findIndex(asset => asset.id === id);
  if (index < 0) throw Error('资产不存在');
  const [deleted] = store.assets.splice(index, 1);
  persist(store);
  return copy(deleted);
}
export function syncApplicationAssets(connection, records) {
  if (!clean(connection?.id) || !clean(connection?.name)) throw Error('平台连接不存在');
  if (!Array.isArray(records)) throw Error('资产清单格式不正确');
  const store = state(), imported = [], errors = [], seen = new Set(), at = now();
  records.forEach((raw, index) => {
    const assetId = clean(raw.sourceRecordId ?? raw.assetId ?? raw.id);
    const previous = store.assets.find(asset => asset.id === identity(connection.id, assetId));
    const data = metadata({ ...raw, assetId }, previous || {});
    const issues = recordErrors(data);
    if (seen.has(assetId)) issues.push('同一批次资产 ID 重复');
    seen.add(assetId);
    if (issues.length) errors.push({ row: index + 1, errors: issues });
    else imported.push(putAsset(store, data, connection.id, connection.name, at));
  });
  persist(store);
  return copy({ imported, errors });
}

const CSV_FIELDS = ['assetId', 'name', 'enterpriseVersion', 'sourceStatus', 'address', 'addressType', 'updatedAt'];
const CSV_ALIASES = { '资产ID': 'assetId', '资产 ID': 'assetId', '资产名称': 'name', '版本信息': 'enterpriseVersion', '企业版本': 'enterpriseVersion', '发布状态': 'sourceStatus', '企业发布状态': 'sourceStatus', '资产地址': 'address', '地址类型': 'addressType', '更新时间': 'updatedAt' };
export const APPLICATION_CSV_TEMPLATE = '\uFEFF资产 ID,资产名称,版本信息,发布状态,地址类型,资产地址,更新时间\r\n' +
  'business-agent-1,业务智能体1镜像,1.0.0,已发布,容器镜像,registry.example.com/business/agent:1.0.0,\r\n' +
  'business-service-2,业务应用2代码包,2.0.0,未发布,文件包,https://assets.example.com/business-service-2.zip,\r\n';
function parseCsv(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  if (!source.trim()) throw Error('请上传 CSV 文件');
  if (/^[\[{]/.test(source.trimStart())) throw Error('批量上传仅支持 CSV 文件');
  const rows = []; let row = [], value = '', quoted = false, closed = false;
  function finishCell() { row.push(value); value = ''; closed = false; }
  function finishRow() { finishCell(); if (row.some(cell => cell.trim())) rows.push(row); row = []; }
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { value += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else value += char;
    } else if (char === ',') finishCell();
    else if (char === '\r' || char === '\n') { if (char === '\r' && source[index + 1] === '\n') index++; finishRow(); }
    else if (char === '"' && !value && !closed) quoted = true;
    else if (char === '"' || closed) throw Error('CSV 引号格式不正确');
    else value += char;
  }
  if (quoted) throw Error('CSV 引号未闭合');
  if (row.length || value || closed) finishRow();
  if (rows.length < 2) throw Error('CSV 需要表头和至少一项资产');
  const headers = rows.shift().map(value => CSV_ALIASES[clean(value)] || clean(value));
  if (new Set(headers).size !== headers.length) throw Error('CSV 表头重复');
  if (headers.some(header => !CSV_FIELDS.includes(header))) throw Error('CSV 包含不支持的字段，请使用资产 CSV 模板');
  if (CSV_FIELDS.slice(0, 5).some(header => !headers.includes(header))) throw Error('CSV 缺少资产 ID、名称、版本、发布状态或地址字段');
  if (rows.length > 1000) throw Error('单次请上传 1—1000 项资产');
  return rows.map((cells, index) => ({ row: index + 1, raw: Object.fromEntries(headers.map((header, column) => [header, cells[column] || ''])), malformed: cells.length !== headers.length }));
}
export function previewApplicationCsv(text) {
  const current = state().assets, parsed = parseCsv(text);
  const counts = new Map();
  parsed.forEach(({ raw }) => counts.set(clean(raw.assetId), (counts.get(clean(raw.assetId)) || 0) + 1));
  return parsed.map(({ row, raw, malformed }) => {
    const existing = current.find(asset => !asset.platformConnectionId && asset.assetId === clean(raw.assetId));
    const data = metadata({ ...raw, updatedAt: raw.updatedAt || undefined }, existing || {});
    const errors = recordErrors(data);
    if (malformed) errors.push('本行列数与表头不一致');
    if (counts.get(data.assetId) > 1) errors.push('同一批次资产 ID 重复');
    if (!APPLICATION_STATUSES.includes(data.sourceStatus)) errors.push('发布状态需为未发布、已发布、已下架或已停用');
    return { row, data, raw, operation: existing ? '更新' : '新增', errors };
  });
}
export function importApplicationCsv(text) {
  const preview = previewApplicationCsv(text), imported = [], errors = [];
  for (const item of preview) {
    if (item.errors.length) { errors.push({ row: item.row, errors: item.errors }); continue; }
    // Preserve whether the CSV supplied a timestamp. The normalized preview can
    // contain an inherited date, which must not suppress an automatic edit time.
    try { imported.push(saveManualApplication({ ...item.raw, updatedAt: item.raw.updatedAt || undefined })); }
    catch (error) { errors.push({ row: item.row, errors: [error.message] }); }
  }
  return { imported, errors };
}
