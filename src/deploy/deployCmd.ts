import * as vscode from 'vscode';
import { fileNameFromPath } from '../utils/fileSystem';
import { Deployer } from './deployer';
import { loadNetwork, loadWallet, loadAccount, loadDeployGasConfig, loadDefaultPayer } from '../config/config';
import { inputExistingPassword } from '../utils/password';

export async function deploy(uri?: vscode.Uri) {
  if (uri === undefined) {
    const editor = vscode.window.activeTextEditor;

    if (editor === undefined) {
      vscode.window.showErrorMessage('Open Compiled smart contract (.avm) file first.');
      return;
    }

    uri = editor.document.uri;
    if (!uri.fsPath.endsWith('.avm')) {
      vscode.window.showErrorMessage('Only NEO VM (.avm) Smart contracts are supported.');
      return;
    }
  }
  const fileName = uri.fsPath;

  const deployer = new Deployer();

  try {
    const rpcAddress = loadNetwork();
    const gasConfig = loadDeployGasConfig();
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

    vscode.window.showInformationMessage(`Deploying ${fileNameFromPath(fileName)}...`);

    await deployer.deployContract({
      fileName,
      rpcAddress,
      account,
      password,
      gasLimit: gasConfig.gasLimit,
      gasPrice: gasConfig.gasPrice
    });
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : e);
    return;
  }

  vscode.window.showInformationMessage(`Deploy complete!`);
}
