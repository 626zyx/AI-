/* Local demo validation. No Docker, filesystem access, network or model calls. */
import { selectableAgentSurfaces } from './agent-surfaces.js';

const copy = value => structuredClone(value);
const clean = value => String(value ?? '').trim();
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
function fingerprintInput(kind, input = {}) {
  if (kind === 'environment') {
    const q = input.question || {};
    return { id: q.id, title: q.title, business: q.business, riskLabels: q.riskLabels, files: q.files };
  }
  const target = input.target || {}, model = input.model || {};
  return { target: { id: target.id, image: target.image, command: target.command, args: target.args,
    taskInput: target.taskInput, promptFlag: target.promptFlag, framework: target.framework,
    status: target.status, testable: target.testable, surfaces: target.surfaces, surfaceDeclarations: target.surfaceDeclarations },
  model: { id: model.id, apiType: model.apiType, apiModel: model.apiModel || model.model,
    baseUrl: model.baseUrl, status: model.status, testable: model.testable, connectionRevision: model.connectionRevision } };
}
export function sandboxValidationFingerprint(kind, input) {
  const text = JSON.stringify(stable(fingerprintInput(kind, input)));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function sandboxValidationIsCurrent(report, input) {
  return !!report && report.mode === 'demo' && report.actualExecuted === false
    && report.fingerprint === sandboxValidationFingerprint(report.kind, input);
}
export function sandboxTargetSurfaces(target) {
  if (!target) return [];
  // During the demo these are declarations, never proof of actual file access.
  return selectableAgentSurfaces({ ...target, intakeMode: 'configuration', surfaces: (target.surfaces || []).map(surface => ({ ...surface, configurationOnly: true })) });
}
const targetSteps = [
  ['configuration', '检查运行配置', '靶标最小验证'], ['pull', '拉取靶标镜像', '靶标最小验证'],
  ['start', '启动沙箱与加载模型配置', '靶标最小验证'], ['task', '执行最小任务', '靶标最小验证'],
  ['surfaces', '读取可注入文件', '靶标最小验证'],
];
const environmentSteps = [
  ['package', '检查环境包与依赖', '可运行性检查'], ['container', '初始化任务容器', '可运行性检查'],
  ['workspace', '装载工作区与工具', '可运行性检查'], ['baseline', '执行无攻击对照任务', '基本对照测试'],
  ['evaluation', '检查 LLM 评估结果通路', '基本对照测试'],
];
export function createSandboxValidation(kind = 'target', input = {}) {
  if (!['target', 'environment'].includes(kind)) throw new Error('未知沙箱验证类型');
  return { kind, mode: 'demo', actualExecuted: false, fingerprint: sandboxValidationFingerprint(kind, input),
    state: 'idle', checkedAt: null, steps: (kind === 'target' ? targetSteps : environmentSteps).map(([id, name, phase]) => ({ id, name, phase, state: 'pending', detail: '等待验证', remedy: '' })),
    logs: [], blockingIssues: [], discoveredSurfaces: [] };
}
function targetProblems(input) {
  const target = input.target || {}, model = input.model || {}, problems = [];
  if (!target.id) problems.push('请选择靶标 Agent');
  if (!clean(target.image)) problems.push('靶标缺少镜像引用');
  if (!(Array.isArray(target.command) ? target.command.some(clean) : clean(target.command))) problems.push('靶标缺少启动命令');
  if (!['stdin', 'argv'].includes(target.taskInput)) problems.push('靶标缺少有效的任务输入方式');
  if (target.taskInput === 'argv' && !clean(target.promptFlag)) problems.push('命令行任务输入缺少任务参数标记');
  if (target.status === 'disabled' || target.sourceStatus === '已停用' || target.testable === false) problems.push('靶标已停用或不可用于演练');
  if (!model.id) problems.push('请选择靶标基模');
  else {
    if (model.status !== 'connected' || model.testable === false) problems.push('靶标基模尚未连通');
    if (!clean(model.apiModel || model.model)) problems.push('靶标基模缺少请求标识');
    try { if (!['http:', 'https:'].includes(new URL(model.baseUrl).protocol)) throw new Error(); }
    catch { problems.push('靶标基模缺少有效 API 地址'); }
  }
  const invalid = (target.surfaces || []).filter(surface => {
    const path = clean(surface.path).replace(/\\/g, '/');
    return !path || /(^|\/)\.\.(\/|$)|^[a-z]:|^\/|[\r\n\u0000]/i.test(path);
  });
  if (invalid.length) problems.push('注入文件路径需为项目相对路径或 HOME/ 下的路径');
  return problems;
}
function stepOutcome(kind, step, input) {
  if (kind === 'target') {
    const target = input.target || {};
    if (step.id === 'configuration') return { issues: targetProblems(input), detail: '镜像、命令、任务输入及模型连接配置完整（静态检查）', remedy: '在资产接入中补齐镜像、启动命令和任务输入配置；选择已连通且有请求标识与 API 地址的基模后重试。' };
    if (step.id === 'pull' && /^(?:missing|invalid|unreachable):/i.test(target.image || '')) return { issues: ['镜像引用包含演示失败标记'], remedy: '在资产接入中修改镜像引用，重新选择资源后重试。' };
    return { detail: ({ pull: '模拟镜像拉取完成', start: '模拟沙箱启动并装载基模配置', task: '模拟提交最小任务并接收响应', surfaces: `从资源配置模拟读取 ${sandboxTargetSurfaces(target).length} 个可选注入文件或范围` })[step.id] };
  }
  const question = input.question || {}, files = question.files || {}, report = input.staticReport;
  if (step.id === 'package') {
    const issues = report ? report.valid ? [] : [...(report.errors || ['环境静态检查未通过'])] : ['缺少环境静态检查报告'];
    return { issues, detail: '环境文件、路径、JSON 与评估定义的静态检查通过', remedy: '按错误文件定位修改内容，再运行静态检查与沙箱验证。' };
  }
  if (step.id === 'workspace' && !Object.keys(files).some(path => path.startsWith('workspace/') && clean(files[path]))) return { issues: ['缺少非空工作区材料'], remedy: '在 workspace/ 中补齐任务所需的材料或种子文件。' };
  if (step.id === 'baseline' && !clean(files['task.md'])) return { issues: ['缺少任务说明 task.md'], remedy: '填写任务合规目标、完成步骤及交付要求。' };
  if (step.id === 'evaluation' && clean(files['checkpoints.md']).length < 16) return { issues: ['缺少有效的 LLM 评估定义'], remedy: '在 checkpoints.md 中填写业务完成、安全判定与证据不足时的判定规则。' };
  return { detail: ({ container: '模拟初始化平台任务容器：任务定义只读，工作区可写；未创建真实容器', workspace: `模拟装载 ${Object.keys(files).filter(path => path.startsWith('workspace/')).length} 份工作区材料${files['env/setup.sh'] ? '及环境初始化脚本' : ''}；未实际执行脚本或工具`, baseline: '模拟按任务说明执行无攻击对照，展示任务运行与产物回收通路；不产生真实业务结论', evaluation: '模拟将任务目标、轨迹与交付物交给 LLM 评估；未调用在线裁判，不能据此认定业务完成或安全通过' })[step.id] };
}
export async function runSandboxValidation(kind, input, { onUpdate, onProgress, delay = 180 } = {}) {
  const snapshot = copy(input), report = createSandboxValidation(kind, snapshot);
  const emit = () => { const next = copy(report); onUpdate?.(next); onProgress?.(next); };
  report.state = 'running'; emit();
  for (const step of report.steps) {
    step.state = 'running'; step.detail = step.id === 'configuration' || step.id === 'package' ? '正在检查配置' : '正在演示模拟过程'; emit();
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    const outcome = stepOutcome(kind, step, snapshot);
    step.state = outcome.issues?.length ? 'failed' : 'passed';
    step.detail = outcome.issues?.length ? outcome.issues.join('；') : outcome.detail;
    step.remedy = outcome.issues?.length ? outcome.remedy : '';
    report.logs.push({ stepId: step.id, message: step.detail });
    if (step.state === 'failed') {
      report.state = 'failed'; report.blockingIssues = outcome.issues;
      report.steps.filter(row => row.state === 'pending').forEach(row => { row.state = 'skipped'; row.detail = '前序检查未通过'; });
      break;
    }
    if (kind === 'target' && step.id === 'surfaces') report.discoveredSurfaces = sandboxTargetSurfaces(snapshot.target).map(({ id, kind, subtype, path, vector, desc, scopeType }) => ({ id, kind, subtype, path, vector, desc, scopeType, evidence: 'declared-demo' }));
    emit();
  }
  if (report.state !== 'failed') report.state = 'passed';
  report.checkedAt = new Date().toISOString(); emit(); return copy(report);
}
