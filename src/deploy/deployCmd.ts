import * as vscode from 'vscode';
import { fileNameFromPath } from '../utils/fileSystem';
import { Deployer } from './deployer';
import { loadNetwork, loadWallet, loadAccount, loadDeployGasConfig, loadDefaultPayer } from '../config/config';
import { inputExistingPassword } from '../utils/password';
import { readFileSync } from 'fs';
import * as path from 'path';
import { Account } from 'ontology-ts-crypto';

export async function deploy(context: vscode.ExtensionContext, uri?: vscode.Uri) {
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

  try {
    const panel = vscode.window.createWebviewPanel(
      `deploy_${fileNameFromPath(fileName)}`,
      `Deploy ${fileNameFromPath(fileName)}`,
      {
        viewColumn: vscode.ViewColumn.One
      },
      { enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))] }
    );

    let content = constructWebView();
    const onDiskPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'dialog.css'));
    const cssSrc = onDiskPath.with({ scheme: 'vscode-resource' });

    content = content.replace('${cssSrc}', cssSrc.toString());

    panel.webview.html = content;
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'submit':
          return await deploySubmit(uri!, fileName, panel, message.data);
      }
    });
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : e);
    return;
  }
}

function constructWebView() {
  return readFileSync(path.join(__dirname, '..', '..', 'resources', 'deploy.html'), 'utf8');
}

async function deploySubmit(uri: vscode.Uri, fileName: string, panel: vscode.WebviewPanel, data: any) {
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

  const rpcAddress = loadNetwork();
  const gasConfig = loadDeployGasConfig();

  const deployer = new Deployer();
  vscode.window.showInformationMessage(`Deploying ${fileNameFromPath(fileName)}...`);

  try {
    await deployer.deployContract({
      fileName,
      rpcAddress,
      account,
      password,
      gasLimit: gasConfig.gasLimit,
      gasPrice: gasConfig.gasPrice,
      ...data
    });

    // close panel only if everything is good
    panel.dispose();

    vscode.window.showInformationMessage(`Deploy complete!`);
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : e);
  }

  return;
}
