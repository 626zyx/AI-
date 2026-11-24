/* The five-step enterprise connector flow is adapted from 3.0 asset-sync.
 * The demo validates configuration and maps a local catalog; it never calls a remote API. */
import { platformCatalog, listAssets, previewAssets, importAssets, getPlatformConnection, recordPlatformSync } from './asset-intake.js';

const copy = value => JSON.parse(JSON.stringify(value));
const clean = value => String(value ?? '').trim();
export const SOURCE_FIELDS = ['id', 'name', 'kind', 'status', 'version', 'endpoint', 'changedAt', 'owner', 'department', 'environment'];
export const DEFAULT_MAPPING = { id:'id', name:'name', kind:'kind', status:'status', version:'version', endpoint:'endpoint', updatedAt:'changedAt' };
export const MAPPING_LABELS = { id:'企业唯一 ID', name:'资产名称', kind:'类型', status:'企业状态', version:'企业版本', endpoint:'地址 / 镜像', updatedAt:'更新时间' };
export const SYNC_INTERVALS = [5, 15, 30, 60, 360];

export function newConnectionDraft(existing = {}) {
  const defaults = {
    name:'', owner:'平台管理员', connector:'rest', baseUrl:'', resourcePath:'/ai-assets',
    authType:'bearer', credential:'', credentialRef:'', credentialConfigured:false,
    apiKeyHeader:'X-API-Key', timeout:30, pageMode:'cursor', listPath:'data.items',
    mapping:{...DEFAULT_MAPPING},
    kinds:['model', 'agent'], environment:'全部', department:'全部', selectedIds:null,
    autoInclude:true, notifyChanges:true, interval:30, reconcile:'每日', webhook:false,
  };
  const saved = copy(existing);
  delete saved.statusMap;
  return {
    ...defaults, ...saved,
    baseUrl:clean(existing.baseUrl || existing.endpoint), credential:'',
    authType:existing.authType || (existing.id && !existing.credentialConfigured && !existing.credentialRef ? 'none' : defaults.authType),
    mapping:{...defaults.mapping, ...existing.mapping},
    kinds:[...(existing.kinds || defaults.kinds)], selectedIds:existing.selectedIds == null ? null : [...existing.selectedIds],
  };
}

export function connectionErrors(c, {mapping = false, scope = false, rules = false} = {}) {
  const errors = [];
  if (!clean(c.name)) errors.push('请填写连接名称');
  if (!clean(c.baseUrl)) errors.push('请填写 API 地址');
  if (!clean(c.resourcePath)) errors.push('请填写资源路径');
  if (!['rest', 'standard'].includes(c.connector)) errors.push('请选择有效连接器');
  if (!['bearer', 'apikey', 'none'].includes(c.authType)) errors.push('请选择有效鉴权方式');
  if (c.authType !== 'none' && !clean(c.credential) && !clean(c.credentialRef) && !c.credentialConfigured) errors.push('请填写平台读取凭据或凭据引用');
  if (c.authType === 'apikey' && !/^[A-Za-z0-9-]+$/.test(clean(c.apiKeyHeader))) errors.push('API Key 请求头名称仅支持字母、数字和短横线');
  if (!Number.isInteger(Number(c.timeout)) || Number(c.timeout) < 5 || Number(c.timeout) > 120) errors.push('连接超时应为 5—120 秒的整数');
  if (!['cursor', 'page', 'none'].includes(c.pageMode)) errors.push('请选择有效分页方式');
  if (mapping) {
    if (!/^[$A-Za-z_][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(clean(c.listPath))) errors.push('请填写响应列表路径，例如 data.items');
    else if (!connectionRecords(c).length) errors.push('响应列表路径未指向演示目录数组，请使用 data.items');
    for (const key of Object.keys(DEFAULT_MAPPING)) if (!SOURCE_FIELDS.includes(c.mapping?.[key])) errors.push('请映射' + MAPPING_LABELS[key]);
  }
  if (scope) {
    if (!c.kinds?.length || c.kinds.some(kind => !['model', 'agent'].includes(kind))) errors.push('请至少选择一种资产类型');
    if (!selectedSourceRows(c).length) errors.push('请至少选择一项当前范围内的资产');
  }
  if (rules) {
    if (!SYNC_INTERVALS.includes(Number(c.interval))) errors.push('请选择有效增量同步间隔');
    if (!['每日', '每周'].includes(c.reconcile)) errors.push('请选择完整核对频率');
  }
  return [...new Set(errors)];
}

function demoCatalog(c) {
  const prefix = (c.id || 'platform-preview') + ':';
  return [
    { id:prefix+'model', sourceRecordId:'catalog-model-01', kind:'model', name:'企业对话模型（演示）', baseUrl:'https://model.example.com/v1', apiModel:'enterprise-chat', sourceStatus:'已发布', owner:c.owner || '平台管理员' },
    { id:prefix+'agent', sourceRecordId:'catalog-agent-01', kind:'agent', name:'企业文档 Agent（演示）', image:'enterprise/document-agent:1.0-demo', command:['document-agent','--auto'], taskInput:'stdin', surfaceDeclarations:[{kind:'instruction',path:'AGENTS.md',description:'声明的项目指令文件'}], sourceStatus:'已发布', owner:c.owner || '平台管理员' },
  ];
}

export function connectionRecords(c) {
  const catalog = c.id ? platformCatalog(c.id) : [];
  const rows = (catalog.length ? catalog : demoCatalog(c)).map(row => ({
    id:row.id.slice((c.id || 'platform-preview').length + 1), name:row.name, kind:row.kind,
    status:row.sourceStatus,
    version:'1.0.0', endpoint:row.baseUrl || row.runtimeEndpoint || row.image,
    changedAt:'2026-11-24T00:00:00.000Z', owner:row.owner,
    department:row.kind === 'model' ? '模型研发部' : '智能应用部', environment:row.kind === 'model' ? '生产' : '预发布',
    asset:copy(row),
  }));
  const response = {data:{items:rows}};
  const parsed = clean(c.listPath || 'data.items').split('.').reduce((value,key) => value && Object.hasOwn(value,key) ? value[key] : undefined, response);
  return Array.isArray(parsed) ? parsed : [];
}

export function filteredSourceRows(c) {
  return connectionRecords(c).filter(row => (c.kinds || []).includes(row.kind)
    && (!c.environment || c.environment === '全部' || row.environment === c.environment)
    && (!c.department || c.department === '全部' || row.department === c.department));
}
export function selectedSourceRows(c) {
  return filteredSourceRows(c).filter(row => c.selectedIds == null || c.selectedIds.includes(row.id));
}
export async function testConnection(c) {
  const errors = connectionErrors(c);
  if (errors.length) throw Error(errors.join('；'));
  return { mode:'demo', actualConnected:false, checkedAt:new Date().toISOString(), count:connectionRecords(c).length, fields:[...SOURCE_FIELDS] };
}

export function previewConnection(c) {
  const selected = selectedSourceRows(c);
  const read = (row, key) => row[c.mapping?.[key] || DEFAULT_MAPPING[key]];
  const importedId = row => `${c.id || 'platform-preview'}:${clean(read(row, 'id'))}`;
  const rawRows = selected.map(row => {
    const data = {...row.asset, id:importedId(row), name:clean(read(row,'name')), kind:clean(read(row,'kind')),
      source:c.name + ' · 演示目录', sourceKind:'enterprise_demo', sourceDataset:'平台连接演示清单',
      sourceRecordId:clean(read(row,'id')), platformConnectionId:c.id || 'platform-preview',
      sourceStatus:read(row,'status'),
      enterpriseVersion:clean(read(row,'version')), sourceUpdatedAt:clean(read(row,'updatedAt')),
    };
    // Platform read credentials must not become target model invocation credentials.
    delete data.credentialRef; delete data.apiKey; delete data.imported;
    if (data.kind === 'model') data.baseUrl = clean(read(row,'endpoint'));
    else if (/^https?:/i.test(clean(read(row,'endpoint')))) data.runtimeEndpoint = clean(read(row,'endpoint'));
    else data.image = clean(read(row,'endpoint'));
    if (data.kind === 'agent') { data.baseModelId = ''; data.baseModelVersion = ''; }
    return data;
  });
  const preview = previewAssets(rawRows), seen = new Set();
  return preview.map((item, index) => {
    const row = selected[index], errors = [...item.errors];
    if (!clean(read(row,'id'))) errors.push('企业唯一 ID 为空');
    if (seen.has(item.id)) errors.push('映射后的企业 ID 重复'); seen.add(item.id);
    if (!item.raw.enterpriseVersion) errors.push('企业版本为空');
    if (!item.raw.sourceUpdatedAt || !Number.isFinite(Date.parse(item.raw.sourceUpdatedAt))) errors.push('更新时间无法识别');
    const existing = listAssets().find(asset => asset.id === item.id);
    const changes = existing ? ['name','sourceStatus','baseUrl','runtimeEndpoint','image','owner'].filter(key => String(existing[key] ?? '') !== String(item.raw[key] ?? '')).map(key => ({field:key,before:existing[key] ?? '—',after:item.raw[key] ?? '—'})) : [];
    const operation = item.operation.replace(/^新增 V\d+$/, '新增').replace(/^新版本 V\d+$/, '更新配置');
    return {...item, operation, errors:[...new Set(errors)], sourceId:row.id, changes};
  });
}

export function importConnectionSelection(c) {
  const errors = connectionErrors(c, {mapping:true, scope:true, rules:true});
  if (errors.length) throw Error(errors.join('；'));
  if (!c.id || !getPlatformConnection(c.id)) throw Error('请先保存连接');
  const rows = previewConnection(c);
  if (rows.some(row => row.errors.length)) throw Error('预览存在无效资产，请修正字段映射后导入');
  return importAssets(rows.map(row => row.raw));
}

export function syncPlatformConnection(id) {
  const saved = getPlatformConnection(id);
  if (!saved) throw Error('平台连接不存在');
  const result = importConnectionSelection(newConnectionDraft(saved));
  if (result.errors.length) throw Error('部分资产未同步：' + result.errors.map(item => item.errors.join('；')).join('；'));
  const syncedAt = new Date().toISOString();
  recordPlatformSync(id, result.imported, syncedAt);
  return {...result, mode:'demo', actualConnected:false, syncedAt};
}
