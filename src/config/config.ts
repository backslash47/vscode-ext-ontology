import * as fs from 'fs';
import * as vscode from 'vscode';
import { Wallet } from 'ontology-ts-crypto';
import { isNumber } from 'util';

export function loadNetwork() {
  const config = vscode.workspace.getConfiguration('ontology');
  const network = config.get<string>('network.type', 'testNet');

  if (network === 'testNet') {
    return 'http://polaris1.ont.io:20336';
  } else if (network === 'mainNet') {
    return 'http://dappnode1.ont.io:20336';
  } else if (network === 'privateNet') {
    const address = config.get<string>('network.private');
    if (address === undefined) {
      throw new Error('PrivateNet is selected, but no address is set.');
    } else {
      return address;
    }
  } else {
    throw new Error(`Unsupported network '${network}' is selected`);
  }
}

export function loadDeployGasConfig() {
  const config = vscode.workspace.getConfiguration('ontology');
  const gasLimit = config.get<string>('deploy.gasLimit', '20000000');
  const gasPrice = config.get<string>('deploy.gasPrice', '500');

  try {
    if (!isNumber(Number(gasLimit)) || !isNumber(Number(gasPrice))) {
      throw new Error('Gas limit and Gas price must be whole numbers.');
    }
  } catch (e) {
    throw new Error('Gas limit and Gas price must be whole numbers.');
  }

  return { gasLimit, gasPrice };
}

export function loadInvokeGasConfig() {
  const config = vscode.workspace.getConfiguration('ontology');
  const gasLimit = config.get<string>('invoke.gasLimit', '20000000');
  const gasPrice = config.get<string>('invoke.gasPrice', '500');

  try {
    if (!isNumber(Number(gasLimit)) || !isNumber(Number(gasPrice))) {
      throw new Error('Gas limit and Gas price must be whole numbers.');
    }
  } catch (e) {
    throw new Error('Gas limit and Gas price must be whole numbers.');
  }

  return { gasLimit, gasPrice };
}

export function loadWallet(uri: vscode.Uri) {
  const config = vscode.workspace.getConfiguration('ontology');
  let fileName = config.get<string>('wallet');

  if (fileName === undefined || fileName.trim() === '') {
    throw new Error('No wallet specified.');
  }

  const folder = vscode.workspace.getWorkspaceFolder(uri);

  if (folder === undefined) {
    throw new Error('File is outside of current workspace.');
  }

  fileName = fileName.replace('${workspaceFolder}', folder.uri.fsPath);

  try {
    const f = fs.readFileSync(fileName, 'utf8');
    return Wallet.deserializeJson(f);
  } catch (e) {
    throw new Error('Wallet decode error.');
  }
}

export function loadDefaultPayer() {
  const config = vscode.workspace.getConfiguration('ontology');
  const payer = config.get<string>('payer');

  if (payer !== undefined && payer.trim() !== '') {
    return payer;
  }
}

export function loadAccount(wallet: Wallet, address?: string) {
  if (address === undefined) {
    address = wallet.defaultAccountAddress;
  }

  for (const account of wallet.accounts) {
    if (account.address.toBase58() === address) {
      return account;
    }
  }

  throw new Error('Payer account was not found in wallet file.');
}
