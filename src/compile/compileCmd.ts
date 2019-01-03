import * as vscode from 'vscode';
import { Compiler } from './compiler';
import { fileNameFromPath } from '../utils/fileSystem';
import { usePythonCompilerVersion2 } from '../config/config';

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

  try {
    const compiler = new Compiler();
    const useV2 = usePythonCompilerVersion2();
    await compiler.compileContract(fileName, useV2);

    vscode.window.showInformationMessage(`Compilation complete!`);
  } catch (e) {
    vscode.window.showErrorMessage(`Compilation error: ${e instanceof Error ? e.message : e}`);
  }
}
