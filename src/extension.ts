// clux 扩展激活入口。
//
// 当前提供：
//   - 语法高亮（TextMate grammar，声明式，无需激活）
//   - 格式化：调用外部 clux 可执行文件（`clux format -`，stdin → stdout）
//
// 二进制位置由 `clux.binaryPath` 配置项指定（默认 "clux"，走 PATH 查找）。

import * as vscode from 'vscode';
import { execFile } from 'child_process';

const CONFIG_SECTION = 'clux';
const BINARY_PATH_KEY = 'binaryPath';
const FORMAT_TIMEOUT_MS = 15000;

/** 读取 clux 可执行文件路径（默认 "clux"，即从 PATH 查找）。 */
function getBinaryPath(): string {
  const configured = vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<string>(BINARY_PATH_KEY);
  const trimmed = (configured ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'clux';
}

/** 调用 clux 格式化一段源码文本，返回格式化结果。 */
function runCluxFormat(source: string): Promise<string> {
  const binary = getBinaryPath();

  return new Promise<string>((resolve, reject) => {
    const child = execFile(
      binary,
      ['format', '-'],
      {
        timeout: FORMAT_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        // 显式使用 UTF-8，避免 Windows 默认代码页导致中文注释乱码
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        if (error) {
          const reason =
            (stderr && stderr.trim()) ||
            error.message ||
            'unknown error';
          reject(new Error(reason));
          return;
        }
        resolve(stdout);
      }
    );

    if (child.stdin) {
      child.stdin.on('error', () => {
        /* 子进程提前退出时忽略 EPIPE，错误已由回调统一处理 */
      });
      child.stdin.end(source, 'utf8');
    }
  });
}

/** 为 `clux` 语言提供文档格式化（整文档替换为 clux format 的输出）。 */
class CluxFormattingProvider implements vscode.DocumentFormattingEditProvider {
  async provideDocumentFormattingEdits(
    document: vscode.TextDocument
  ): Promise<vscode.TextEdit[]> {
    if (document.getText().trim().length === 0) {
      return [];
    }

    let formatted: string;
    try {
      formatted = await runCluxFormat(document.getText());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(
        `clux format failed: ${message}\n` +
          `Check the "clux.binaryPath" setting (current: ${getBinaryPath()}).`
      );
      return [];
    }

    const original = document.getText();

    // 行尾统一：clux 在 Windows 上经 CRT 文本模式输出 CRLF，在类 Unix 上输出
    // LF，与文档自身的行尾风格未必一致。这里一律规整为文档的行尾风格，
    // 避免格式化时把整个文件的行尾改掉而产生全文件 diff。
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    formatted = formatted.replace(/\r\n|\r|\n/g, eol);

    // 结果与原文一致时返回空编辑，避免制造无意义的历史记录
    if (formatted === original) {
      return [];
    }

    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(original.length)
    );
    return [vscode.TextEdit.replace(fullRange, formatted)];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  // 格式化：仅注册到 clux 语言（.cxs 是汇编文本，clux format 不处理）
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      { language: 'clux' },
      new CluxFormattingProvider()
    )
  );

  // 显式格式化命令（等价于 "Format Document"）
  context.subscriptions.push(
    vscode.commands.registerCommand('clux.formatDocument', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('clux: no active editor.');
        return;
      }
      await vscode.commands.executeCommand('editor.action.formatDocument');
    })
  );

  // 便捷设置二进制路径：弹输入框，写入 workspace 或用户配置
  context.subscriptions.push(
    vscode.commands.registerCommand('clux.setBinaryPath', async () => {
      const current = getBinaryPath();
      const input = await vscode.window.showInputBox({
        title: 'clux binary path',
        prompt:
          'Path to the clux executable (absolute path, or a name on PATH).',
        value: current,
        ignoreFocusOut: true,
      });
      if (input === undefined) return; // 用户取消

      const target = vscode.workspace.workspaceFolders
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;

      await vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .update(BINARY_PATH_KEY, input.trim(), target);

      vscode.window.showInformationMessage(
        `clux: binary path set to "${input.trim()}".`
      );
    })
  );

  // 配置变更时提示（便于用户立即发现路径写错后格式化会失败）
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${CONFIG_SECTION}.${BINARY_PATH_KEY}`)) {
        vscode.window.setStatusBarMessage(
          `clux: binary path → ${getBinaryPath()}`,
          3000
        );
      }
    })
  );
}

export function deactivate(): void {
  // 无需释放资源。
}
