// 用 VSCode 1.136 实际 schema 校验 language-configuration.json（临时工具）
'use strict';
const fs = require('fs');
const path = require('path');

(async () => {
const { getLanguageService } = await import('vscode-json-languageservice');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'vscode-lang-schema.json'), 'utf8'));

const ls = getLanguageService({});
ls.configure({
  schemas: [
    { uri: 'file:///language-configuration.json', fileMatch: ['*'], schema },
  ],
});
const docText = fs.readFileSync(
  path.join(__dirname, '..', 'language-configuration.json'),
  'utf8'
);
const textDocument = {
  uri: 'file:///language-configuration.json',
  languageId: 'jsonc',
  version: 1,
  getText: () => docText,
  positionAt: (off) => {
    const pre = docText.slice(0, off);
    const lines = pre.split('\n');
    return { line: lines.length - 1, character: lines[lines.length - 1].length };
  },
  offsetAt: (pos) => {
    const lines = docText.split('\n');
    return lines.slice(0, pos.line).join('\n').length + (pos.line ? 1 : 0) + pos.character;
  },
};

const jsonDoc = ls.parseJSONDocument(textDocument);
const diagnostics = await ls.doValidation(textDocument, jsonDoc);
console.log('diagnostics:', diagnostics.length);
for (const d of diagnostics) {
  console.log(
    `[L${d.range.start.line + 1}:${d.range.start.character + 1}] ${d.severity === 1 ? 'Error' : 'Warn'} ${d.message}`
  );
}
if (diagnostics.length === 0) console.log('PASS: language-configuration.json 符合 VSCode 1.136 schema');
})();
