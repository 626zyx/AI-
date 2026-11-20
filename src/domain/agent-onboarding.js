/* Explicit delivery contract. Credentials are resolved server-side from a model asset. */
import { normalizeSurfaceDeclarations } from './agent-surfaces.js';

export function normalizeAgentCommand(executable, argumentsText = '') {
  const program = String(executable || '').trim();
  if (!program || /[\s\u0000]/.test(program)) throw new Error('启动程序只填写一个程序名或容器内路径，参数请逐行填写');
  const args = String(argumentsText).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (args.some(arg => /\u0000/.test(arg))) throw new Error('启动参数包含无效字符');
  return [program, ...args];
}

export function normalizeImageReference(value) {
  const image = String(value || '').trim();
  // Registry reference, not a web download URL or a local archive path.
  if (!/^(?:[a-z0-9][a-z0-9.-]*(?::\d+)?\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[\w][\w.-]{0,127}|@sha256:[a-fA-F0-9]{64})$/.test(image)) {
    throw new Error('请填写完整镜像地址，包含 :版本标签 或 @sha256:摘要；不填网页地址或压缩包路径');
  }
  return image;
}

export function validateAgentSubmission(data, { models, existing = [] }) {
  const name = String(data.name || '').trim();
  if (!name) throw new Error('请填写智能体名称');
  if (existing.some(agent => agent.id !== data.id && agent.name.trim() === name)) throw new Error('智能体名称已存在');
  const base = models.find(model => model.id === data.baseModelId && model.status === 'connected' && model.roles.includes('智能体基座'));
  if (!base) throw new Error('请选择已接入的基座模型');
  const image = normalizeImageReference(data.image);
  const command = normalizeAgentCommand(data.executable, data.argumentsText);
  if (!['stdin', 'argv', 'file'].includes(data.taskInput)) throw new Error('请选择任务文本传入方式');
  const flag = data.taskInput !== 'stdin' ? String(data.promptFlag || '').trim() : '';
  if (flag && !/^--?[A-Za-z0-9][A-Za-z0-9_-]*$/.test(flag)) throw new Error('任务参数名填写 -p、-n 或 --prompt 等单个参数名；位置参数留空');
  if (flag && command.slice(1).includes(flag)) throw new Error('任务参数名不要重复写入启动参数，平台会自动追加');
  return {
    name, integrationMode: 'custom', framework: 'custom', baseModelId: base.id, image,
    command, taskInput: data.taskInput, promptFlag: flag,
    inputContract: { content: 'task_text', transport: data.taskInput, ...(data.taskInput !== 'stdin' ? { flag: flag || null } : {}) },
    modelConnection: { source: 'model_asset', modelId: base.id, adapter: 'openai_env_v1' },
    surfaceDeclarations: normalizeSurfaceDeclarations(data.surfaceDeclarations), surfaces: [],
    description: String(data.description || '').trim(), status: 'planned',
  };
}
