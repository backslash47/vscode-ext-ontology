import * as vscode from 'vscode';

import { AbiFunction, Abi } from '../abi/abiTypes';
import { Invoker } from './invoker';
import { loadNetwork, loadInvokeGasConfig, loadWallet, loadDefaultPayer, loadAccount } from '../config/config';
import { inputExistingPassword } from '../utils/password';

export async function invoke(abi?: Abi, method?: AbiFunction) {
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

  const invoker = new Invoker();

  try {
    const rpcAddress = loadNetwork();
    const gasConfig = loadInvokeGasConfig();
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

    const account = loadAccount(wallet, selectedAddress);

    const password = await inputExistingPassword('Please input payer account password: ');

    if (password === undefined) {
      return;
    }

    await account.decryptKey(password);

    vscode.window.showInformationMessage(`Invoking ${method.name}...`);

    const outputChannel = vscode.window.createOutputChannel('Ontology');
    outputChannel.clear();
    outputChannel.appendLine(`Invoking ${method.name}...`);
    outputChannel.show();

    const result = await invoker.invoke({
      rpcAddress,
      contract: abi.hash,
      method: method.name,
      account,
      password,
      gasLimit: gasConfig.gasLimit,
      gasPrice: gasConfig.gasPrice
    });

    if (result !== undefined) {
      outputChannel.appendLine(`Invocation was successful. Result: ${result}`);
    } else {
      outputChannel.appendLine('Invocation was successful. No result was returned.');
    }
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : e);
    return;
  }

  vscode.window.showInformationMessage(`Invoke complete!`);
}
