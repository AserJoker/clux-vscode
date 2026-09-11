// 冒烟测试：用 vscode-textmate 引擎加载 clux grammar，
// 对典型 clux 代码做一次词法着色，断言关键 scope 出现。
// 运行：node scripts/highlight-check.js
'use strict';

const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const vsco = require('vscode-oniguruma');
const wasmBin = vsco.loadWASM;

(async () => {
  await vsco.loadWASM(
    fs.readFileSync(
      path.join(__dirname, '..', 'node_modules', 'vscode-oniguruma', 'release', 'onig.wasm')
    )
  );
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({ createOnigScanner: (s) => new vsco.OnigScanner(s), createOnigString: (s) => new vsco.OnigString(s) }),
    loadGrammar: async () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'syntaxes', 'clux.tmLanguage.json'), 'utf8')),
  });
  const grammar = await registry.loadGrammar('source.clux');
  if (!grammar) { console.error('FAIL: grammar not loaded'); process.exit(1); }

  const sample = [
    '// 行注释',
    '/* 块注释 */',
    'func fib(n: i32): i32 {',
    '    if n <= 1 { return n; }',
    '    return fib(n - 1) + fib(n - 2);',
    '}',
    'var x: i32 = 0xFFu8;',
    'var y = 3.14e10f64;',
    'var s = "a\\tb\\x41";',
    'var c = \'z\';',
    'var ok = true && !false;',
    'var u = undefined;',
    'x += 1;',
    'while x > 0 { x--; }',
    'comptime func add(a: i32, b: i32): i32 { return a + b; }',
    'comptime var SUM = add(1, 2);',
  ].join('\n');

  const lines = sample.split('\n');
  const expected = [
    'comment.line.double-slash.clux',
    'comment.block.clux',
    'storage.type.function.clux',
    'entity.name.function.clux',
    'storage.type.primitive.clux',
    'keyword.control.clux',
    'constant.numeric.clux',
    'string.quoted.double.clux',
    'constant.character.escape.clux',
    'string.quoted.single.clux',
    'constant.language.clux',
    'keyword.operator.clux',
    'storage.type.clux',
    'variable.other.clux',
    'storage.modifier.clux',
  ];

  const found = new Set();
  const seen = new Set();
  let state = null;
  for (const line of lines) {
    const r = grammar.tokenizeLine(line, state);
    state = r.ruleStack;
    for (const t of r.tokens) {
      for (const s of t.scopes) seen.add(s);
    }
  }
  const missing = expected.filter((s) => !seen.has(s));
  if (missing.length > 0) {
    console.error('MISSING scopes:', missing.join(', '));
    console.error('seen scopes:', [...seen].join('\n'));
    process.exit(1);
  }
  console.log('OK: all', expected.length, 'expected scopes produced.');
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
