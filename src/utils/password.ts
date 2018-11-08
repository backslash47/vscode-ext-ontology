import * as vscode from 'vscode';

export async function inputExistingPassword(msg = 'Please input account password') {
  return await vscode.window.showInputBox({ password: true, prompt: msg, ignoreFocusOut: true });
}
