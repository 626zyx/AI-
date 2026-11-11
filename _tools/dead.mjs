/* 死代码扫描：CSS 类无人引用 / JS 导出无人引用 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const walk = (d, out = []) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const files = walk(path.join(ROOT, 'src'));
const css = files.filter((f) => f.endsWith('.css'));
const js = files.filter((f) => f.endsWith('.js'));
const jsText = js.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const htmlText = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const usedClasses = new Set();
for (const t of [jsText, htmlText]) {
  for (const m of t.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).forEach((c) => c && usedClasses.add(c));
  for (const m of t.matchAll(/classList\.(?:add|remove|toggle)\('([^']+)'/g)) usedClasses.add(m[1]);
  for (const m of t.matchAll(/`([a-z-]+) \$\{/g)) usedClasses.add(m[1]);
}

const cssClasses = new Set();
for (const f of css) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\.([a-zA-Z][\w-]*)/g)) cssClasses.add(m[1]);
}
const deadCss = [...cssClasses].filter((c) => !usedClasses.has(c)).sort();

const exported = [];
for (const f of js) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/export (?:const|function|class) ([A-Za-z_$][\w$]*)/g)) exported.push([m[1], f]);
}
const deadExports = exported.filter(([n, f]) => {
  const others = js.filter((x) => x !== f).map((x) => fs.readFileSync(x, 'utf8')).join('\n');
  const own = fs.readFileSync(f, 'utf8');
  const inOwn = (own.match(new RegExp(`\\b${n}\\b`, 'g')) || []).length > 1;
  return !others.includes(n) && !inOwn;
});

console.log(`CSS 类 ${cssClasses.size} 个，未被引用 ${deadCss.length} 个`);
console.log(deadCss.join(' '));
console.log(`\nJS 导出 ${exported.length} 个，未被引用 ${deadExports.length} 个`);
console.log(deadExports.map(([n, f]) => `${path.basename(f)}:${n}`).join(' '));
