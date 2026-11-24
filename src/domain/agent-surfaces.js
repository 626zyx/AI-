/* User declarations are not executable capabilities until the integration service verifies them. */
import { NATIVE_SURFACE_KINDS, MEMORY_SURFACE_SUBTYPES } from './attack-surfaces.js';
export const AGENT_SURFACE_KINDS = NATIVE_SURFACE_KINDS;

export function normalizeSurfaceDeclarations(rows = []) {
  const result = [], seen = new Set();
  for (const row of rows) {
    const path = String(row.path || '').trim().replace(/\\/g, '/');
    if (!path) continue;
    if (!AGENT_SURFACE_KINDS.includes(row.kind)) throw new Error('请选择注入面分类');
    if (row.subtype && (row.kind !== 'memory' || !MEMORY_SURFACE_SUBTYPES.includes(row.subtype))) throw new Error('请选择有效的记忆文件分类');
    if (/^[a-z]:|^\/|(^|\/)\.{1,2}(\/|$)|[<>*?\r\n\u0000]|\/\//i.test(path) || path.endsWith('/')) throw new Error('注入面请填写项目相对路径或 HOME/ 下的具体文件，不使用目录、通配符或上级路径');
    if (seen.has(path)) throw new Error(`注入面文件重复：${path}`);
    seen.add(path);
    result.push({ kind: row.kind, ...(row.subtype ? { subtype: row.subtype } : {}), path });
  }
  return result;
}

export function selectableAgentSurfaces(agent) {
  const templates = new Set(['.qwen/skills/<skill-name>/SKILL.md', 'HOME/.deepagents/agent/skills/<skill-name>/SKILL.md']);
  return (agent?.surfaces || []).filter(surface => AGENT_SURFACE_KINDS.includes(surface.kind) && (surface.verified === true || (agent.intakeMode === 'configuration' && surface.configurationOnly === true)) && surface.id && surface.path &&
    (!/[<>*?]/.test(surface.path) || (surface.scopeType === 'template' && surface.kind === 'skill' && templates.has(surface.path))));
}

export function selectedAgentSurfaces(agent, ids = []) {
  if (!Array.isArray(ids)) throw new Error('请选择有效的注入面文件');
  const available = selectableAgentSurfaces(agent), unique = [...new Set(ids)];
  const selected = unique.map(id => available.find(surface => surface.id === id));
  if (selected.some(surface => !surface)) throw new Error('所选注入面不属于当前靶标的可用文件配置，请重新选择');
  return selected.map(({ id, kind, subtype, path, vector, desc, scopeType }) => ({ id, kind, ...(subtype ? { subtype } : {}), path, vector, ...(scopeType ? { scopeType } : {}), description: desc || '' }));
}
