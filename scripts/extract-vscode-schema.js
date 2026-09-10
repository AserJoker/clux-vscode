// 从 VSCode workbench.desktop.main.js 提取 language-configuration schema（临时工具）
'use strict';
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(
  'D:/Program Files/Microsoft VS Code/645f29cc31/resources/app/out/vs/workbench/workbench.desktop.main.js',
  'utf8'
);
const start = s.indexOf('t2n={', 3769800);
if (start < 0) { console.error('marker not found'); process.exit(1); }
// 扫描器需同时识别 " ' ` 三种字符串字面量（schema 含模板字面量 default:`;:.,=}])> \n\t`）
let depth = 0, inStr = null, esc = false, i;
for (i = start + 4; i < s.length; i++) {
  const ch = s[i];
  if (inStr) {
    if (esc) esc = false;
    else if (ch === '\\') esc = true;
    else if (ch === inStr) inStr = null;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) break; }
}
const objCode = s.slice(start + 4, i + 1);
// bundle 内 description 被压缩为 i18n 调用 d(14425,null)，注入 stub
const schema = new Function('d', 'return ' + objCode)((id) => 'desc#' + id);
const out = path.join(__dirname, 'vscode-lang-schema.json');
fs.writeFileSync(out, JSON.stringify(schema, null, 1));
console.log('extracted to', out);
console.log('top keys:', Object.keys(schema).join(','));
const c = schema.properties.comments;
console.log('comments props:', Object.keys(c.properties).join(','));
console.log('lineComment schema:', JSON.stringify(c.properties.lineComment));
console.log('blockComment schema:', JSON.stringify(c.properties.blockComment));
