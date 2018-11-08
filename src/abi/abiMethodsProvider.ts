import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Abi, AbiFunction } from './abiTypes';

export class AbiMethodsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  static readAbi(fileName: string) {
    const f = fs.readFileSync(fileName, 'utf8');
    return JSON.parse(f) as Abi;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<Method | undefined> = new vscode.EventEmitter<Method | undefined>();
  readonly onDidChangeTreeData: vscode.Event<Method | undefined> = this._onDidChangeTreeData.event;

  constructor() {
    vscode.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
    vscode.workspace.onDidSaveTextDocument(() => this.onDidSaveTextDocument());

    this.onActiveEditorChanged();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    const editor = vscode.window.activeTextEditor;

    if (editor === undefined) {
      return Promise.resolve([]);
    }

    const fileName = editor.document.fileName;
    if (!fileName.endsWith('_abi.json')) {
      return Promise.resolve([]);
    }

    const abi = AbiMethodsProvider.readAbi(fileName);

    if (element) {
      if (element instanceof Method) {
        const methodName = element.id!;
        const method = abi.functions.find((f) => f.name === methodName);

        if (method === undefined) {
          throw new Error(`Method ${methodName} not found in ABI file.`);
        }

        const params = method.parameters.map((p) => {
          return new Param(method.name, p.name, p.type);
        });
        return Promise.resolve(params);
      } else {
        return Promise.resolve([]);
      }
    } else {
      const methods = abi.functions.map((f) => {
        return new Method(abi, f, vscode.TreeItemCollapsibleState.Collapsed);
      });
      return Promise.resolve(methods);
    }
  }

  private onActiveEditorChanged() {
    this.refresh();
  }

  private onDidSaveTextDocument() {
    this.refresh();
  }
}

class Method extends vscode.TreeItem {
  constructor(abi: Abi, abiFunction: AbiFunction, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(abiFunction.name, collapsibleState);

    this.id = abiFunction.name;
    this.command = {
      command: 'ontology.invoke',
      arguments: [abi, abiFunction],
      title: 'Invoke Smart contract method'
    };
  }

  iconPath = {
    light: path.join(__dirname, '..', '..', 'resources', 'light', 'method.svg'),
    dark: path.join(__dirname, '..', '..', 'resources', 'dark', 'method.svg')
  };

  contextValue = 'method';
}

class Param extends vscode.TreeItem {
  constructor(methodName: string, name: string, type: string, command?: vscode.Command) {
    super(type !== '' ? `${name}: ${type}` : name, vscode.TreeItemCollapsibleState.None);

    this.id = `${methodName}.${name}`;
  }

  iconPath = {
    light: path.join(__dirname, '..', '..', 'resources', 'light', 'field.svg'),
    dark: path.join(__dirname, '..', '..', 'resources', 'dark', 'field.svg')
  };

  contextValue = 'param';
}
