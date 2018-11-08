import 'babel-polyfill';
import * as vscode from 'vscode';
import { compile } from './compile/compileCmd';
import { deploy } from './deploy/deployCmd';
import { AbiMethodsProvider } from './abi/abiMethodsProvider';
import { createDoubleClickCommand } from './utils/doubleClickCommand';
import { invoke } from './invoke/invokeCmd';

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "vscode-ext-ontology" is now active!');

  const abiMethodsProvider = new AbiMethodsProvider();

  const compileCmd = vscode.commands.registerCommand('ontology.compile', async (uri: vscode.Uri | undefined) =>
    compile(uri)
  );

  const deployCmd = vscode.commands.registerCommand('ontology.deploy', async (uri: vscode.Uri | undefined) =>
    deploy(context, uri)
  );

  const refreshCmd = vscode.commands.registerCommand('ontology.methods.refresh', () => abiMethodsProvider.refresh());

  const invokeClickCmd = vscode.commands.registerCommand(
    'ontology.invoke.click',
    createDoubleClickCommand((rest) => {
      vscode.commands.executeCommand('ontology.invoke', rest);
    })
  );

  const invokeCmd = vscode.commands.registerCommand(
    'ontology.invoke',
    createDoubleClickCommand(async (args: any[]) => {
      return invoke(...args);
    })
  );

  const methodsView = vscode.window.registerTreeDataProvider('ontology.methods', abiMethodsProvider);

  context.subscriptions.push(compileCmd);
  context.subscriptions.push(deployCmd);
  context.subscriptions.push(methodsView);
  context.subscriptions.push(refreshCmd);
  context.subscriptions.push(invokeCmd);
  context.subscriptions.push(invokeClickCmd);
}

// this method is called when your extension is deactivated
export function deactivate() {}
