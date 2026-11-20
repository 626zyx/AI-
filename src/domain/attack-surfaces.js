/* A shared classification for method capabilities and integration declarations.
 * These are capabilities, not proof that a specific target loads a file.
 * Backend kinds remain the six OpenART kinds; only memory has subtypes. */
export const SURFACE_GROUPS = [
  { id: 'guidance', label: '指令与约束', description: '影响 Agent 对任务的理解和遵循的要求。' },
  { id: 'capabilities', label: '技能与命令', description: '影响 Agent 可调用的能力和处理流程。' },
  { id: 'context', label: '记忆与历史', description: '影响 Agent 使用的长期知识、对话历史和任务状态。' },
  { id: 'runtime', label: '运行配置', description: '影响明确开放的运行行为，不包含平台管理的模型凭据。' },
];

export const SURFACE_TYPES = [
  { id: 'instruction', kind: 'instruction', label: '指令文件', group: 'guidance',
    examples: ['AGENTS.md', 'QWEN.md', 'HOME/.qwen/QWEN.md'], description: '项目或用户指令，规定任务处理要求。',
    loading: '按靶标的指令加载规则读取；实际范围和条件需核验。' },
  { id: 'rule', kind: 'rule', label: '规则文件', group: 'guidance',
    examples: ['.claude/rules/<name>.md', '.continue/rules/<name>.md'], description: '定义行为约束或特定文件、场景下的规则。',
    loading: '可能常驻生效，也可能按路径或条件匹配；以靶标核验为准。' },
  { id: 'skill', kind: 'skill', label: '技能文件', group: 'capabilities',
    examples: ['.qwen/skills/<name>/SKILL.md', '.agents/skills/<name>/SKILL.md'], description: '定义可发现的技能及其工作流程。',
    loading: '发现技能说明不代表已读取或调用正文，正文可按需加载。' },
  { id: 'command', kind: 'command', label: '命令文件', group: 'capabilities',
    examples: ['.opencode/commands/<name>.md', '.claude/commands/<name>.md'], description: '定义 Agent 的自定义命令内容。',
    loading: '通常在对应命令被调用时使用；需核验靶标支持的入口。' },
  { id: 'memory:long_term', kind: 'memory', subtype: 'long_term', label: '长期记忆', group: 'context',
    examples: ['HOME/.deepagents/agent/AGENTS.md', '.opencode/memory/<name>.md'], description: '保存持续使用的知识、偏好和经验；按文件在该靶标中的用途分类。',
    loading: '可能启动时加载或按需检索；Deep Agents 的示例在已测配置中启动加载。' },
  { id: 'memory:conversation', kind: 'memory', subtype: 'conversation', label: '会话历史', group: 'context',
    examples: ['.opencode/sessions/<id>.jsonl'], description: '保存过去的对话、交互和会话上下文。',
    loading: '由支持的会话恢复或历史读取机制加载，格式和会话范围需核验。' },
  { id: 'memory:task_state', kind: 'memory', subtype: 'task_state', label: '任务状态', group: 'context',
    examples: ['任务清单文件（路径由靶标声明）'], description: '保存待办事项、任务计划和进度状态。',
    loading: '由靶标的任务恢复或状态读取机制加载；不将普通业务清单自动归入此类。' },
  { id: 'configuration', kind: 'configuration', label: '配置文件', group: 'runtime',
    examples: ['.reasonix/settings.json'], description: '适配器明确开放的行为配置，不包含平台管理的模型凭据。',
    loading: '按靶标原生配置规则加载；只有明确开放并核验的文件可选择。' },
];

export const NATIVE_SURFACE_KINDS = [...new Set(SURFACE_TYPES.map(type => type.kind))];
export const MEMORY_SURFACE_SUBTYPES = SURFACE_TYPES.filter(type => type.kind === 'memory').map(type => type.subtype);
const legacyMemory = { id: 'memory', kind: 'memory', label: '记忆文件（未细分）', group: 'context', examples: [],
  description: '原记录未区分长期记忆、会话历史和任务状态。', loading: '按靶标已声明的加载机制核验，不根据文件名推断。' };
export function surfaceTypeId(surface = {}) {
  return surface.kind === 'memory' && surface.subtype ? `memory:${surface.subtype}` : surface.kind || '';
}
export function surfaceTypeOf(surface = {}) {
  const id = surfaceTypeId(surface);
  return SURFACE_TYPES.find(type => type.id === id) || (id === 'memory' ? legacyMemory : null);
}
export const surfaceTypeLabel = surface => surfaceTypeOf(surface)?.label || surface?.kind || '—';
export const surfaceGroupOf = surface => SURFACE_GROUPS.find(group => group.id === surfaceTypeOf(surface)?.group) || null;
export function surfaceTypeValue(id) {
  const type = SURFACE_TYPES.find(item => item.id === id) || (id === 'memory' ? legacyMemory : null);
  if (!type) throw new Error('请选择有效的注入面分类');
  return { kind: type.kind, ...(type.subtype ? { subtype: type.subtype } : {}) };
}

/* Full capability catalog retains workspace for historical evidence. Integration
 * and new task selection use the native types above, never workspace files. */
export const ATTACK_SURFACE_CATALOG = [
  { kind: 'workspace', examples: ['README.md', 'docs/guide.md', 'data/records.csv'], description: '任务工作区的业务文档、代码或数据文件' },
  ...SURFACE_TYPES,
];
