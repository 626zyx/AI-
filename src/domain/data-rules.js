/* 数据等级规则：用户定义数据等级与命中范围。命中结果回填资产状态的数据等级，
 * 并同步到消息提醒。替代原「风险管理」。demo 数据，不做真实扫描。 */
import { RISK_LABEL } from './constants.js';

/* 命中维度沿用题库的风险资源分类，作为可勾选的数据类别 */
export const DATA_DIMENSIONS = Object.entries(RISK_LABEL)
  .filter(([key]) => key !== 'unclassified')
  .map(([key, value]) => ({ key, label: value.label }));

export const LEVEL_TONES = [
  ['red', '红 · 最高'], ['amber', '橙 · 高'], ['blue', '蓝 · 中'], ['green', '绿 · 低'],
];

const listeners = new Set();
export function subscribeDataRules(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((fn) => fn());
let seq = 100;

const rules = [
  { id: 'dl-4', name: 'L4 · 绝密', tone: 'red', enabled: true, dims: ['credentials', 'personal'], keywords: 'API Key, 身份证, 私钥', note: '认证凭据与个人敏感信息' },
  { id: 'dl-3', name: 'L3 · 机密', tone: 'amber', enabled: true, dims: ['financial', 'intellectual', 'legal'], keywords: '并购, 未公开财务, 诉讼', note: '商业财务、未公开战略与法律材料' },
  { id: 'dl-2', name: 'L2 · 内部', tone: 'blue', enabled: true, dims: ['internal', 'security'], keywords: '内部流程, 架构弱点', note: '内部运营与安全防御信息' },
  { id: 'dl-1', name: 'L1 · 公开', tone: 'green', enabled: false, dims: [], keywords: '', note: '对外可公开内容' },
];

export const listDataRules = () => rules.map((r) => ({ ...r }));
export const getDataRule = (id) => { const r = rules.find((x) => x.id === id); return r ? { ...r } : null; };

export function saveDataRule(form) {
  const name = (form.name || '').trim();
  if (!name) throw new Error('请填写等级名称');
  const data = {
    name, tone: form.tone || 'blue', enabled: form.enabled !== false,
    dims: Array.isArray(form.dims) ? form.dims : [], keywords: (form.keywords || '').trim(), note: (form.note || '').trim(),
  };
  if (form.id) { const r = rules.find((x) => x.id === form.id); if (!r) throw new Error('规则不存在'); Object.assign(r, data); }
  else rules.unshift({ id: 'dl-' + (++seq), ...data });
  emit();
}

export function toggleDataRule(id) {
  const r = rules.find((x) => x.id === id);
  if (!r) throw new Error('规则不存在');
  r.enabled = !r.enabled; emit();
}
