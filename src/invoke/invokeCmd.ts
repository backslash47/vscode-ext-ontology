import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { AbiFunction, Abi } from '../abi/abiTypes';
import { Invoker, processParams } from './invoker';
import { loadNetwork, loadInvokeGasConfig, loadWallet, loadDefaultPayer, loadAccount } from '../config/config';
import { inputExistingPassword } from '../utils/password';
import { fileNameFromPath } from '../utils/fileSystem';
import { Account } from 'ontology-ts-crypto';
import { Compiler } from '../compile/compiler';

export async function invoke(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel,
  abi?: Abi,
  method?: AbiFunction
) {
  if (abi === undefined || method === undefined) {
    return;
  }

  const editor = vscode.window.activeTextEditor;

  if (editor === undefined) {
    vscode.window.showErrorMessage('Open ABI file (_abi.json) file first.');
    return;
  }

  let uri = editor.document.uri;
  let fileName = uri.fsPath;

  if (fileName.endsWith('.py') || fileName.endsWith('.cs')) {
    // try to find ABI file
    const abiPath = Compiler.constructAbiName(fileName);

    if (fs.existsSync(abiPath)) {
      fileName = abiPath;
      uri = vscode.Uri.file(fileName);
    }
  }

  if (!fileName.endsWith('_abi.json')) {
    vscode.window.showErrorMessage('Open ABI file (_abi.json) file first.');
    return;
  }

  try {
    const panel = vscode.window.createWebviewPanel(
      `invoke_${fileNameFromPath(fileName)}_${method.name}`,
      `Invoke ${method.name}`,
      {
        viewColumn: vscode.ViewColumn.One
      },
      {
        retainContextWhenHidden: true,
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
      }
    );

    let content = constructWebView();
    const onDiskPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'dialog.css'));
    const cssSrc = onDiskPath.with({ scheme: 'vscode-resource' });

    content = content.replace('${cssSrc}', cssSrc.toString());

    panel.webview.html = content;

    await panel.webview.postMessage({ command: 'init', parameters: method.parameters });

    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'submit':
          return await invokeSubmit(channel, uri!, abi, method, message.data);
        case 'debug':
          return await invokeDebug(channel, uri!, abi, method, message.data);
      }
    });
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : e);
    return;
  }
}

function constructWebView() {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'resources', 'invoke.html'), 'utf8');
}

function findSourceFile(abiFile: string) {
  const abiFileName = path.basename(abiFile);
  const abiDirName = path.dirname(abiFile);

  if (!abiFileName.endsWith('_abi.json')) {
    throw new Error('ABI file has wrong name.');
  }

  const pyName = abiFileName.replace('_abi.json', '.py');
  const pyFileName = path.join(abiDirName, '..', pyName);

  if (!fs.existsSync(pyFileName)) {
    throw new Error('Python source file does not exist.');
  }

  return pyFileName;
}

async function invokeDebug(channel: vscode.OutputChannel, uri: vscode.Uri, abi: Abi, method: AbiFunction, data: any) {
  const abiFile = uri.fsPath;
  const sourceFile = findSourceFile(abiFile);

  const config: vscode.DebugConfiguration = {
    type: 'ontology',
    name: 'Launch',
    request: 'launch',
    sourceFile,
    method: method.name,
    data
  };
  return vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(uri), config);
}

async function invokeSubmit(channel: vscode.OutputChannel, uri: vscode.Uri, abi: Abi, method: AbiFunction, data: any) {
  const preExec = data.preExec === 'on';

  try {
    let account: Account | undefined;
    let password: string | undefined;
    if (!preExec) {
      const wallet = loadWallet(uri);
      const defaultPayer = loadDefaultPayer();

      const addresses = wallet.accounts.map((a) => a.address).map((a) => a.toBase58());
      let selectedAddress: string | undefined;

      if (defaultPayer === undefined) {
        selectedAddress = await vscode.window.showQuickPick(addresses, {
          canPickMany: false,
          ignoreFocusOut: true,
          placeHolder: 'Select payer address'
        });
      } else {
        selectedAddress = defaultPayer;
      }

      if (selectedAddress === undefined) {
        return;
      }

      account = loadAccount(wallet, selectedAddress);

      password = await inputExistingPassword('Please input payer account password: ');

      if (password === undefined) {
        return;
      }

      await account.decryptKey(password);
    }

    const rpcAddress = loadNetwork();
    const gasConfig = loadInvokeGasConfig();

    const invoker = new Invoker();
    vscode.window.showInformationMessage(`Invoking ${method.name}...`);

    channel.appendLine(`Invoking ${method.name}...`);
    channel.show();

    const result = await invoker.invoke({
      rpcAddress,
      contract: abi.hash,
      method: method.name,
      account,
      password,
      gasLimit: gasConfig.gasLimit,
      gasPrice: gasConfig.gasPrice,
      parameters: processParams(method.parameters, data),
      preExec
    });

    if (result !== undefined) {
      if (preExec) {
        channel.appendLine(`Invocation was successful. Result: ${result}`);
      } else {
        channel.appendLine(`Invocation was submitted. Transaction: ${result}`);
      }

      channel.appendLine('');
    } else {
      channel.appendLine('Invocation was successful. No result was returned.');
      channel.appendLine('');
    }

    vscode.window.showInformationMessage(`Invoke complete!`);
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : e);
  }

  return;
}
