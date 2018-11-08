import * as vscode from 'vscode';

import { AbiFunction, Abi, AbiParamter } from '../abi/abiTypes';
import { Invoker } from './invoker';
import { loadNetwork, loadInvokeGasConfig, loadWallet, loadDefaultPayer, loadAccount } from '../config/config';
import { inputExistingPassword } from '../utils/password';
import { readFileSync } from 'fs';
import * as path from 'path';
import { fileNameFromPath } from '../utils/fileSystem';
import { Address, Account } from 'ontology-ts-crypto';

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

  const uri = editor.document.uri;
  if (!uri.fsPath.endsWith('_abi.json')) {
    vscode.window.showErrorMessage('Open ABI file (_abi.json) file first.');
    return;
  }

  const fileName = uri.fsPath;

  try {
    const panel = vscode.window.createWebviewPanel(
      `invoke_${fileNameFromPath(fileName)}_${method.name}`,
      `Invoke ${method.name}`,
      {
        viewColumn: vscode.ViewColumn.One
      },
      { enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))] }
    );

    let content = constructWebView(method.parameters);
    const onDiskPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'dialog.css'));
    const cssSrc = onDiskPath.with({ scheme: 'vscode-resource' });

    content = content.replace('${cssSrc}', cssSrc.toString());

    panel.webview.html = content;
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'submit':
          return await invokeSubmit(channel, uri!, abi, method, message.data);
      }
    });
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : e);
    return;
  }
}

function constructWebView(parameters: AbiParamter[]) {
  const mainHtml = readFileSync(path.join(__dirname, '..', '..', 'resources', 'invoke.html'), 'utf8');
  const paramTemplateHtml = readFileSync(path.join(__dirname, '..', '..', 'resources', 'invokeParam.html'), 'utf8');

  const parametersHtml = parameters.map((param) => {
    return paramTemplateHtml.split('${name}').join(param.name);
  });

  const parametersJoinedHtml = parametersHtml.join('');

  return mainHtml.replace('${params}', parametersJoinedHtml);
}

async function invokeSubmit(channel: vscode.OutputChannel, uri: vscode.Uri, abi: Abi, method: AbiFunction, data: any) {
  const preExec = data.preExec === 'on';

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

  try {
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

function processParams(parameters: AbiParamter[], data: any) {
  return parameters.map((parameter) => {
    const value = data[parameter.name];
    const type = data[`${parameter.name}-type`];

    if (type === 'Integer') {
      return Number(value);
    } else if (type === 'Boolean') {
      return Boolean(value);
    } else if (type === 'String') {
      return value;
    } else if (type === 'ByteArray') {
      return new Buffer(value, 'hex');
    } else if (type === 'Address') {
      const address = Address.fromBase58(value);
      return address.toArray();
    }
  });
}
