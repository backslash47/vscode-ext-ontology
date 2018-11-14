import {
  DebugConfigurationProvider as VscodeDebugConfigurationProvider,
  DebugConfiguration,
  WorkspaceFolder,
  CancellationToken,
  ProviderResult,
  window
} from 'vscode';
import * as Net from 'net';
import { DebugSession } from './debugSession';

export class DebugConfigurationProvider implements VscodeDebugConfigurationProvider {
  private server?: Net.Server;

  /**
   * Massage a debug configuration just before a debug session is being launched,
   * e.g. add all missing attributes to the debug configuration.
   */
  resolveDebugConfiguration(
    folder: WorkspaceFolder | undefined,
    config: DebugConfiguration,
    token?: CancellationToken
  ): ProviderResult<DebugConfiguration> {
    if (config.sourceFile === undefined) {
      return window.showInformationMessage('Cannot find a program to debug').then((_) => {
        return undefined; // abort launch
      });
    }

    if (!this.server) {
      this.server = Net.createServer((socket) => {
        const session = new DebugSession();
        session.setRunAsServer(true);
        session.start(<NodeJS.ReadableStream>socket, socket);
      }).listen(0);
    }

    const address = this.server.address();
    if (!(typeof address === 'string')) {
      config.debugServer = address.port;
    }

    return config;
  }

  dispose() {
    if (this.server) {
      this.server.close();
    }
  }
}
