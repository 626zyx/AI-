/* 从旧版 demo 提取攻击方法目录、AdvBench 520 题与攻击场景，生成 src/data/catalog.js。
 * 跑法：node _tools/extract_catalog.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const ROOT = path.resolve(import.meta.dirname, '..');
const OLD = path.resolve(ROOT, '..', 'src');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(OLD, 'data/datasets.js'), 'utf8'), ctx);
const W = ctx.window;
/* 参数中文名：取旧版 openrt-methods.js 里 schema 声明的 label */
const src = fs.readFileSync(path.join(OLD, 'modules/policy/openrt-methods.js'), 'utf8');
const labels = {};
for (const m of src.matchAll(/(?:number|select|toggle|text)\('(\w+)',\s*'([^']+)'/g)) labels[m[1]] ??= m[2];
labels.max_iterations ??= '最大优化次数';
const methods = W.OpenRTMethodData.methods
  .filter((m) => !m.blocked)
  .map((m) => ({
    id: m.id, name: m.name, family: m.family, turns: m.turns,
    desc: m.description, generator: !!m.generator, process: !!m.process,
    registry: m.registry, source: m.source.file + ':' + m.source.line,
    params: Object.entries(m.parameters || {})
      .filter(([k]) => labels[k])
      .map(([k, v]) => ({ key: k, label: labels[k], value: v })),
  }));
const sceneOf = {};
for (const [cat, ids] of Object.entries(W.BankSceneData.groups['advbench-520'])) for (const id of ids) sceneOf[id] ??= cat;
const advbench = W.AdvBenchData.map((q) => ({ id: q.id, prompt: q.prompt, scene: sceneOf[q.id] || '' }));
const scenes = W.BankSceneData.categories.map((c) => ({ id: c.id, label: c.label }));
const out = `/* 自动生成：_tools/extract_catalog.mjs 从旧版 demo 提取，勿手改 */
export const methodCatalog = ${JSON.stringify(methods, null, 1)};
export const scenes = ${JSON.stringify(scenes, null, 1)};
export const advbench = ${JSON.stringify(advbench)};
`;
fs.writeFileSync(path.join(ROOT, 'src/data/catalog.js'), out);
console.log('methods', methods.length, 'items', advbench.length, 'unscened', advbench.filter((q) => !q.scene).length);
