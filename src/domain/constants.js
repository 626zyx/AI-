/* 领域常量：全站唯一的枚举定义。页面不自行造状态/标签映射。 */

export const TASK_STATUS = {
  ready: { label: '待开始', cls: 'draft', icon: 'stRunning' },
  running: { label: '进行中', cls: 'running', icon: 'stRunning' },
  done: { label: '已完成', cls: 'done', icon: 'stDone' },
  stopped: { label: '已终止', cls: 'stopped', icon: 'stStopped' },
  error: { label: '异常', cls: 'error', icon: 'stError' },
  draft: { label: '草稿', cls: 'draft', icon: 'stRunning' },
};

/* 模型在平台里承担的角色。资产中心与平台设置共用这一份定义。 */
export const MODEL_ROLE = {
  target: '靶标',
  attack: '攻击生成',
  judge: '裁判',
  agentBase: '智能体基座',
  generation: '题库生成',
};
/* 角色说明：平台管理 · 模型管理里展示。一个角色可同时服务模型演练与 Agent 演练 */
export const MODEL_ROLE_DESC = {
  靶标: '模型演练中被演练的对象，新建模型演练任务时可选',
  攻击生成: '模型演练中 PAIR 等方法改写攻击提示词；Agent 演练中间接注入方法的攻击者',
  裁判: '模型演练与 Agent 演练的判定模型',
  智能体基座: '接入智能体时可选为智能体背后调用的模型',
  题库生成: '生成模型题库或 Agent 场景包草稿，校验并发布后用于演练',
};
/* 接口类型：OpenRT 目前只有 OpenAI 兼容的 Chat Completions 实现 */
export const API_TYPE = [
  { id: 'openai', label: 'OpenAI 兼容对话接口', ok: true },
  { id: 'anthropic', label: 'Anthropic Messages（需改造）', ok: false },
  { id: 'gemini', label: 'Google Gemini（需改造）', ok: false },
];

export const MODEL_STATUS = {
  connected: '已连通',
  planned: '待连通',
  error: '连通失败',
};

export const OBJECT_TYPE = {
  model: { label: '模型演练', short: '模型' },
  agent: { label: 'Agent 演练', short: 'Agent' },
};

/* ---------------------------------------------------------------- Agent 演练 */

/* 智能体框架：接入时只选框架，启动命令、镜像、凭据投递、攻击面由平台按框架预置。
 * 一期只开放 Qwen Code；其余 OpenAI 兼容框架置灰（Claude Code、Gemini 接口不兼容，不展示）。 */
export const AGENT_FRAMEWORKS = [
  { id: 'qwen_code', label: 'Qwen Code', ok: true },
  ...['OpenCode', 'Codex', 'Aider', 'Goose', 'Continue CLI', 'Copilot CLI', 'DeepSeek TUI', 'Kilo', 'Oh My Pi', 'OpenClaw', 'Reasonix', 'Hermes', 'Nanobot', 'Pi']
    .map((label) => ({ id: label.toLowerCase().replace(/\s+/g, '_'), label, ok: false })),
];
export const frameworkLabel = (id) => AGENT_FRAMEWORKS.find((f) => f.id === id)?.label || id || '—';

/* 旧接入表单仍在用的常量，接入表单简化后删除 */
export const AGENT_TEMPLATE = {
  blank: { label: '空白（手动填写）', cmd: '', image: '', transport: 'stdin', delivery: 'env', envNames: 'OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL', configPath: '', configFormat: 'json' },
  qwen_code: { label: 'Qwen Code', cmd: 'qwen --yolo', image: 'openart/qwen-code:latest', transport: 'stdin', delivery: 'hybrid', envNames: 'OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL', configPath: 'HOME/.qwen/settings.json', configFormat: 'json' },
};
export const CRED_DELIVERY = {
  env: { label: '环境变量', desc: '把模型地址与密钥注入为容器环境变量' },
  config: { label: '配置文件', desc: '把模型配置写入容器内的指定文件' },
  hybrid: { label: '环境变量 + 配置文件', desc: '两者都提供，部分框架需要' },
};
export const PROMPT_TRANSPORT = { stdin: '标准输入', argv: '命令行参数', file: '写入文件', file_ref_argv: '文件路径作参数' };

/* 攻击面类型 */
export const SURFACE_KIND = {
  instruction: '指令文件',
  skill: '技能文件',
  workspace: '工作区文件',
  command: '命令文件',
  rule: '规则文件',
  configuration: '配置文件',
  memory: '记忆与历史文件',
};

/* Agent 判读：泄漏程度与靶标失误所处环节 */
export const AGENT_SEVERITY = {
  none: '无',
  low: '低',
  medium: '中',
  high: '高',
};
export const AGENT_ERROR_STAGES = ['读取', '汇总', '发布', '交付'];

/* 风险标签：题库标注维度。只用于题目分类与结果归因，不是执行维度。 */
export const RISK_LABEL = {
  personal: { label: '个人信息与私人记录', cls: 'red' },
  credentials: { label: '认证凭据与访问秘密', cls: 'red' },
  security: { label: '安全弱点与防御信息', cls: 'amber' },
  financial: { label: '商业财务与交易条款', cls: 'amber' },
  intellectual: { label: '知识产权与未公开战略', cls: 'blue' },
  legal: { label: '法律合规与调查材料', cls: 'blue' },
  internal: { label: '内部运营与治理信息', cls: 'gray' },
  unclassified: { label: '未归类风险', cls: 'gray' },
};
export const riskLabelText = (key) => RISK_LABEL[key]?.label || key;

/* Agent 单元判定：与模型演练同一套三态。
 * 判定由裁判模型对对外产物做语义判读给出；题目自带的规则判定器结果只作对照（ruleCheck）。 */
export const AGENT_VERDICT = {
  breach: { key: 'breach', label: '已攻破', cls: 'red' },
  safe: { key: 'safe', label: '已守住', cls: 'green' },
  error: { key: 'error', label: '异常', cls: 'amber' },
};

/* 题目质量标注：入库时由平台计算，提示结果可信度 */
export const SCENE_FLAG = {
  lowSignal: { label: '误报风险', cls: 'amber', desc: '禁用标记多为普通字段名，智能体正常引用也可能命中' },
  remoteDep: { label: '需外部服务', cls: 'blue', desc: '任务含远程发布步骤，未配置服务端时该步骤必然失败' },
  reviewFlag: { label: '分类存疑', cls: 'gray', desc: '风险资源的标签在标注时命中多个类别' },
};

/* 风险等级：由任务级 ASR 推导，阈值只在 metrics.js 里定义 */
export const RISK_LEVEL = {
  critical: { label: '高危', cls: 'red' },
  high: { label: '中危', cls: 'amber' },
  medium: { label: '低危', cls: 'blue' },
  none: { label: '安全', cls: 'green' },
};

export const VERDICT = {
  breach: { key: 'breach', label: '已攻破', cls: 'red' },
  safe: { key: 'safe', label: '已守住', cls: 'green' },
  /* 已执行但裁判未给出判定，与演练结果里的「异常」同一口径 */
  unknown: { key: 'error', label: '异常', cls: 'amber' },
};

/* 蓝队：产品层面已部署，用户在任务里选择是否配置 */
export const GUARD_NONE = '未配置';

export const NAV = [
  { id: 'home', label: '首页', icon: 'chart' },
  { id: 'exercise', label: '演练场', icon: 'shield' },
  { id: 'strategy', label: '演练策略', icon: 'layers' },
  { id: 'platform', label: '设置', icon: 'settings' },
];

/* 详情类子页在侧栏高亮其所属的列表项 */
/* 不在顶栏、由右上角设置进入的栏目 */
export const EXTRA_PAGES = { platform: '设置' };

export const SUB_PARENT = {
  'agent-upload': 'intake',
  'agent-edit': 'intake',
  'agent-version': 'intake',
  'connection-create': 'intake',
  'connection-edit': 'intake',
  'task-detail': 'tasks', 'task-create': 'tasks', drafts: 'tasks',
  'report-detail': 'reports',
  /* Agent 演练 */
  'ag-task-detail': 'ag-tasks', 'ag-task-create': 'ag-tasks', 'ag-drafts': 'ag-tasks',
  'ag-report-detail': 'ag-reports',
  /* 策略中心 · Agent 演练策略 */
  'ag-strategy-detail': 'ag-strategy', 'ag-strategy-drafts': 'ag-strategy',
  /* 资产中心 · 智能体 */
  'agent-detail': 'intake',
  authoring: 'banks',
  'bank-authoring': 'attack',
  'strategy-create': 'attack',
  methods: 'attack', banks: 'attack',
};

const EXERCISE_NAV = [
  { id: 'model-group', label: '模型演练', heading: true },
  { id: 'tasks', label: '演练任务', icon: 'shield', page: 'exercise' },
  { id: 'reports', label: '演练报告', icon: 'file', page: 'exercise' },
  { id: 'agent-group', label: '智能体演练', heading: true },
  { id: 'ag-tasks', label: '演练任务', icon: 'shield', page: 'agent' },
  { id: 'ag-reports', label: '演练报告', icon: 'file', page: 'agent' },
];
export const SIDE_NAV = {
  exercise: EXERCISE_NAV,
  agent: EXERCISE_NAV,
  strategy: [
    { id: 'model-group', label: '模型演练', heading: true },
    { id: 'attack', label: '攻击库', icon: 'layers' },
    { id: 'guard', label: '防护库', icon: 'shield' },
    { id: 'evaluators', label: '评估器', icon: 'check' },
    { id: 'agent-group', label: '智能体演练', heading: true },
    { id: 'ag-methods', label: '攻击库', icon: 'layers' },
    { id: 'scenebanks', label: '环境库', icon: 'box' },
  ],
  assets: [],
  platform: [
    { id: 'datarule', label: '数据等级规则', icon: 'alert' },
    { id: 'intake', label: '资产接入', icon: 'box' },
  ],
};
