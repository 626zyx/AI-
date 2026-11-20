/* 结果包打包：按文件清单从站点目录读取文件，生成不压缩（store）的 zip 并下载。
 * 只依赖浏览器原生 fetch / Blob，不引第三方库。接后端后可改为直接下载后端生成的 zip，调用方不变。
 * files：[{ url: 站点内路径, name: zip 内路径 }] */
import * as UI from './ui.js';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* 文件名一律 UTF-8，置通用位标志第 11 位，中文文件名在解压工具里不乱码 */
function buildZip(entries) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nm = enc.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nm.length, true);
    parts.push(local.buffer, nm, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, nm.length, true);
    cd.setUint32(42, offset, true);
    central.push(cd.buffer, nm);
    offset += 30 + nm.length + data.length;
  }
  const cdSize = central.reduce((n, b) => n + b.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

export async function downloadZip(zipName, files) {
  if (!files.length) return UI.toast('没有可打包的产物文件');
  UI.toast('正在打包结果…');
  const entries = [];
  const missing = [];
  for (const f of files) {
    try {
      const r = await fetch(encodeURI(f.url));
      if (!r.ok) throw new Error(r.status);
      entries.push({ name: f.name, data: new Uint8Array(await r.arrayBuffer()) });
    } catch {
      missing.push(f.name);
    }
  }
  if (!entries.length) return UI.toast('结果文件读取失败，请通过本地服务打开 demo');
  const url = URL.createObjectURL(buildZip(entries));
  const a = document.createElement('a');
  a.href = url; a.download = zipName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  UI.toast(missing.length ? `已导出，${missing.length} 个文件读取失败` : `已导出 ${entries.length} 个文件`);
}
