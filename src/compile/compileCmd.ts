import * as vscode from 'vscode';
import { Compiler } from './compiler';
import { fileNameFromPath } from '../utils/fileSystem';

export async function compile(uri?: vscode.Uri) {
  let fileName: string;

  if (uri === undefined) {
    const editor = vscode.window.activeTextEditor;

    if (editor === undefined) {
      vscode.window.showErrorMessage('Open Smart contract file first.');
      return;
    }

    fileName = editor.document.fileName;
    if (!fileName.endsWith('.py') && !fileName.endsWith('.cs')) {
      vscode.window.showErrorMessage('Only C# (.cs) and Python (.py) Smart contracts are supported.');
      return;
    }
  } else {
    fileName = uri.fsPath;
  }

  vscode.window.showInformationMessage(`Compiling ${fileNameFromPath(fileName)}...`);

  const compiler = new Compiler();
  await compiler.compileContract(fileName);

  vscode.window.showInformationMessage(`Compilation complete!`);
}
