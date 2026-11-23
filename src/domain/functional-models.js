/* Functional models have their own identity and lifecycle, separate from targets. */
export const FUNCTIONAL_ROLES = ['攻击生成', '裁判', '题库生成', '防护', '文本嵌入', '图像生成', '视觉理解'];
export const FUNCTIONAL_ROLE_LABEL = { 题库生成: '场景生成', 裁判: '裁判模型', 防护: '防护审核' };
export const functionalModels = [
  { id: 'mdl-deepseek-flash', name: 'DeepSeek-V3-Flash', vendor: 'DeepSeek', apiModel: 'deepseek-flash', baseUrl: 'https://api.deepseek.com', roles: ['攻击生成', '裁判', '题库生成'], reasoning: true },
  { id: 'mdl-deepseek-v4-pro', name: 'DeepSeek-V4-Pro', vendor: 'DeepSeek', apiModel: 'deepseek-v4-pro', baseUrl: 'https://api.deepseek.com', roles: ['攻击生成', '裁判'], reasoning: true },
  { id: 'mdl-qwen-guard', name: 'Qwen3Guard', vendor: 'Alibaba', apiModel: 'qwen3guard-gen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', roles: ['防护'], guardStages: ['输入', '输出'], responseFormat: 'label', labelMap: 'safe=允许; unsafe=阻断; controversial=复核' },
  { id: 'mdl-text-embedding', name: 'Text Embedding', vendor: 'Alibaba', apiModel: 'text-embedding-v3', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', roles: ['文本嵌入'] },
].map(model => ({ apiType: 'openai', apiKey: '', status: 'connected', statusLabel: '已连通', functional: true, revision: 1, ...model }));
export function functionalModel(id) { return functionalModels.find(model => model.id === id); }
export function validateFunctionalModel(data) {
  if (!String(data.name || '').trim()) throw new Error('请输入模型名称');
  if (!String(data.apiModel || '').trim()) throw new Error('请输入模型标识');
  let url;
  try { url = new URL(data.baseUrl); } catch { throw new Error('请输入完整的服务地址'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('服务地址须使用 HTTP 或 HTTPS');
  if (functionalModels.some(model => model.id !== data.id && model.name === data.name.trim())) throw new Error('模型名称已存在');
  const roles = (data.roles || []).filter(role => FUNCTIONAL_ROLES.includes(role));
  return { ...data, name: data.name.trim(), apiModel: data.apiModel.trim(), baseUrl: data.baseUrl.trim(), roles };
}
export function saveFunctionalModel(data) {
  const validated = validateFunctionalModel(data), old = functionalModel(data.id);
  const connectionChanged = old && ['baseUrl', 'apiModel', 'apiType', 'apiKey'].some(key => old[key] !== validated[key]);
  const record = { apiType: 'openai', apiKey: '', status: 'planned', ...old, ...validated, functional: true,
    id: old?.id || `fm-${crypto.randomUUID()}`, revision: (old?.revision || 0) + 1 };
  if (connectionChanged) record.status = 'planned';
  record.statusLabel = { connected: '已连通', planned: '待测试', error: '连接失败' }[record.status];
  if (old) Object.assign(old, record); else functionalModels.push(record);
  return old || record;
}
export function checkFunctionalModel(id) {
  const model = functionalModel(id);
  if (!model) throw new Error('模型不存在');
  validateFunctionalModel(model);
  const fail = /invalid|unreachable|fail\./i.test(model.baseUrl);
  model.status = fail ? 'error' : 'connected';
  model.statusLabel = fail ? '连接失败' : '已连通';
  model.lastCheck = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 16);
  model.checkMessage = fail ? '连接超时，请检查服务地址' : '接口与响应格式验证通过';
  return model;
}
export function removeFunctionalModel(id) { const index = functionalModels.findIndex(item => item.id === id); if (index >= 0) functionalModels.splice(index, 1); }
