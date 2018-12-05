import { readFileSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export async function tools(context: vscode.ExtensionContext) {
  try {
    const panel = vscode.window.createWebviewPanel(
      `tools`,
      `Tools`,
      {
        viewColumn: vscode.ViewColumn.One
      },
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'media')),
          vscode.Uri.file(path.join(context.extensionPath, 'tools', 'lib'))
        ]
      }
    );

    let content = constructWebView();
    const cssOnDiskPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'dialog.css'));
    const cssSrc = cssOnDiskPath.with({ scheme: 'vscode-resource' });

    const jsOnDiskPath = vscode.Uri.file(path.join(context.extensionPath, 'tools', 'lib', 'browser.js'));
    const jsSrc = jsOnDiskPath.with({ scheme: 'vscode-resource' });

    content = content.replace('${cssSrc}', cssSrc.toString());
    content = content.replace('${jsSrc}', jsSrc.toString());

    panel.webview.html = content;
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : e);
    return;
  }
}

function constructWebView() {
  return readFileSync(path.join(__dirname, '..', '..', 'resources', 'tools.html'), 'utf8');
}
