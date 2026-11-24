/* System guard capabilities follow their official model cards. No model is downloaded by this Demo. */
export const guardCatalog = [
  {
    id: 'grd-content-review', name: '生成式内容审核策略', model: 'Qwen3Guard-Gen-0.6B', provider: 'Qwen', size: '0.6B',
    desc: '审核用户输入与模型回复，识别内容风险及回复中的拒答行为。', builtin: true, stages: ['输入', '输出'],
    verdict: '安全 / 有争议 / 不安全；输出侧另含拒答识别', languages: '官方支持 119 种语言及方言，包含中文和英文。',
    integration: 'Transformers 或 vLLM 部署；按官方对话模板分别审核输入或输入与回复，解析 Safety、Categories 及 Refusal 字段。',
    sourceUrl: 'https://huggingface.co/Qwen/Qwen3Guard-Gen-0.6B',
    dims: [
      ['暴力', '暴力行为、武器制作、伤害他人的指导'], ['非暴力违法行为', '诈骗、盗窃、黑客攻击、毒品等违法活动'],
      ['色情低俗内容', '色情、性行为描写及低俗内容'], ['个人隐私信息', '泄露或索取身份证号、住址、联系方式等个人信息'],
      ['自杀与自残', '鼓励或指导自杀、自残及极端行为'], ['不道德行为', '歧视、仇恨言论、霸凌等违背社会公德的内容'],
      ['政治敏感话题', '涉及政治敏感人物、事件的不当内容'], ['版权侵犯', '未经授权复制、传播受版权保护的作品'],
      ['越狱攻击', '试图绕过模型安全限制的提示词（仅输入侧）', 'input'],
    ], taskCount: 0,
  },
  {
    id: 'grd-llama-guard-3-1b', name: '多维风险内容审核', model: 'Llama Guard 3-1B', provider: 'Meta', size: '1B',
    desc: '审核用户提示词或模型回复，并返回命中的风险类别。', builtin: true, stages: ['输入', '输出'],
    verdict: 'safe / unsafe；不安全时返回 S1–S13 风险类别',
    languages: '官方支持英文、法文、德文、印地文、意大利文、葡萄牙文、西班牙文和泰文；中文效果需单独验证。',
    integration: '使用 Transformers 加载官方模型及聊天模板；输入只含 user 消息，输出审核包含 user 与 assistant 消息，解析安全标签与类别编号。',
    sourceUrl: 'https://github.com/meta-llama/PurpleLlama/blob/main/Llama-Guard3/1B/MODEL_CARD.md',
    dims: [
      ['暴力犯罪', 'S1 · 协助或鼓励暴力犯罪'], ['非暴力犯罪', 'S2 · 协助或鼓励非暴力犯罪'],
      ['性相关犯罪', 'S3 · 性侵、人口贩卖等性相关犯罪'], ['儿童性剥削', 'S4 · 涉及儿童的性剥削内容'],
      ['诽谤', 'S5 · 对个人作出可能损害声誉的虚假陈述'], ['专业建议', 'S6 · 需由持证专业人士提供的高风险建议'],
      ['隐私', 'S7 · 泄露或滥用个人隐私信息'], ['知识产权', 'S8 · 侵犯知识产权'],
      ['大规模杀伤性武器', 'S9 · 协助制造或使用大规模杀伤性武器'], ['仇恨', 'S10 · 针对受保护群体的仇恨内容'],
      ['自杀与自伤', 'S11 · 鼓励或协助自杀、自伤'], ['色情', 'S12 · 露骨性内容'], ['选举误导', 'S13 · 影响投票参与的虚假信息'],
    ], taskCount: 0,
  },
  {
    id: 'grd-shieldgemma-2b', name: '四类内容安全审核', model: 'ShieldGemma 2B', provider: 'Google', size: '2B',
    desc: '按指定的安全政策审核用户输入或模型回复，逐项判断是否违规。', builtin: true, stages: ['输入', '输出'],
    verdict: '逐维度 Yes / No（Yes 表示违规）', languages: '英文模型；中文效果需单独验证。',
    integration: '使用第一代 ShieldGemma 2B 的官方 prompt-only / prompt-response 模板；每次传入一项安全政策。概率判定需读取 Yes/No logits，普通文本接口仅解析 Yes/No。',
    sourceUrl: 'https://gemma.ai/models/shieldgemma/model-card-v1/',
    dims: [
      ['危险内容', '协助造成现实伤害或从事危险活动的内容'], ['骚扰', '针对个人的恶意、恐吓或侮辱内容'],
      ['仇恨言论', '针对受保护群体的贬损或煽动仇恨内容'], ['露骨色情', '露骨性描写或色情内容'],
    ], taskCount: 0,
  },
];
