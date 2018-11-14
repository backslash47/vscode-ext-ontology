import 'babel-polyfill';
import * as vscode from 'vscode';
import { compile } from './compile/compileCmd';
import { deploy } from './deploy/deployCmd';
import { AbiMethodsProvider } from './abi/abiMethodsProvider';
import { createDoubleClickCommand } from './utils/doubleClickCommand';
import { invoke } from './invoke/invokeCmd';
import { DebugConfigurationProvider } from './debugger/debugConfigurationProvider';

export function activate(context: vscode.ExtensionContext) {
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
      return invoke(context, outputChannel, ...args);
    })
  );

  const outputChannel = vscode.window.createOutputChannel('Ontology');

  const methodsView = vscode.window.registerTreeDataProvider('ontology.methods', abiMethodsProvider);

  const debugConfigurationProvider = vscode.debug.registerDebugConfigurationProvider(
    'ontology',
    new DebugConfigurationProvider()
  );

  context.subscriptions.push(compileCmd);
  context.subscriptions.push(deployCmd);
  context.subscriptions.push(methodsView);
  context.subscriptions.push(refreshCmd);
  context.subscriptions.push(invokeCmd);
  context.subscriptions.push(invokeClickCmd);
  context.subscriptions.push(outputChannel);
  context.subscriptions.push(debugConfigurationProvider);
}

// this method is called when your extension is deactivated
export function deactivate() {}
