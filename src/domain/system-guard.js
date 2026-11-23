/* Platform capabilities are maintained internally and never enter model intake. */
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const GUARD_STAGES = freeze(['输入', '输出']);
const capabilities = freeze([
  { id: 'mdl-qwen-guard', name: 'Qwen3Guard', provider: 'Alibaba', model: 'qwen3guard-gen',
    kind: 'content-review', status: 'ready', stages: ['输入', '输出'],
    verdicts: ['safe', 'controversial', 'unsafe'] },
]);
export const systemCapability = id => capabilities.find(capability => capability.id === id);

export const guardMethods = freeze([
  {
    id: 'grd-content-review', name: '生成式内容审核',
    desc: '对进入靶标的提示词或靶标生成的回复做内容安全审核，判定为安全、有争议、不安全三级。',
    builtin: true, status: 'published', capabilityId: 'mdl-qwen-guard',
    threshold: 'unsafe', action: 'block', failureAction: 'block',
    stages: ['输入', '输出'],
    dims: [
      ['暴力', '暴力行为、武器制作、伤害他人的指导'],
      ['非暴力违法行为', '诈骗、盗窃、黑客攻击、毒品等违法活动'],
      ['色情低俗内容', '色情、性行为描写及低俗内容'],
      ['个人隐私信息', '泄露或索取身份证号、住址、联系方式等个人信息'],
      ['自杀与自残', '鼓励或指导自杀、自残及极端行为'],
      ['不道德行为', '歧视、仇恨言论、霸凌等违背社会公德的内容'],
      ['政治敏感话题', '涉及政治敏感人物、事件的不当内容'],
      ['版权侵犯', '未经授权复制、传播受版权保护的作品'],
      ['越狱攻击', '试图绕过模型安全限制的提示词（仅输入侧）', 'input'],
    ],
  },
]);

export const guardMethod = id => guardMethods.find(method => method.id === id);
export const guardCapability = id => systemCapability(guardMethod(id)?.capabilityId);
