// clux 扩展激活入口。
//
// M1 阶段仅提供语法高亮（TextMate grammar，声明式，无需激活）。
// 本文件为框架骨架：预留语义 token / 诊断 / 补全等语言能力注册点，
// 后续迭代（LSP、语言服务）在此接入。

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  // 预留：语义 token provider 注册点（未来语义高亮 / 类型着色）。
  // context.subscriptions.push(
  //   vscode.languages.registerDocumentSemanticTokensProvider(
  //     { language: 'clux' },
  //     new CluxSemanticTokensProvider(),
  //     legend
  //   )
  // );
  void context;
}

export function deactivate(): void {
  // M1 无可释放资源。
}
