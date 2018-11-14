import * as path from 'path';
import * as vscode from 'vscode';
import {
  DebugSession as VscodeDebugSession,
  InitializedEvent,
  TerminatedEvent,
  OutputEvent,
  StoppedEvent,
  Thread,
  Breakpoint,
  StackFrame,
  Source
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { Compiler } from '../compile/compiler';
import { Debugger } from './debugger';

/**
 * This interface describes the mock-debug specific launch attributes
 * (which are not part of the Debug Adapter Protocol).
 * The schema for these attributes lives in the package.json of the mock-debug extension.
 * The interface should always match this schema.
 */
interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  /** An absolute path to the "program" to debug. */
  sourceFile: string;
  method: string;
  data: any[];
}

export class DebugSession extends VscodeDebugSession {
  // we don't support multiple threads, so we can use a hardcoded ID for the default thread
  private static THREAD_ID = 1;

  private debugger: Debugger;
  private sourceFile: string;

  constructor() {
    super();

    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);

    this.onOutput = this.onOutput.bind(this);
    this.onBreakpoint = this.onBreakpoint.bind(this);

    this.sourceFile = '';
    this.debugger = new Debugger({
      onOutput: this.onOutput,
      onBreakpoint: this.onBreakpoint
    });
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ) {
    this.sendEvent(new InitializedEvent());

    // build and return the capabilities of this debug adapter:
    response.body = response.body || {};

    // the adapter implements the configurationDoneRequest.
    response.body.supportsConfigurationDoneRequest = true;

    // make VS Code to use 'evaluate' when hovering over source
    response.body.supportsEvaluateForHovers = true;

    // make VS Code to show a 'step back' button
    response.body.supportsStepBack = false;

    response.body.supportsRestartRequest = false;

    this.sendResponse(response);
  }

  protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): Promise<void> {
    this.sourceFile = args.sourceFile;

    vscode.window.showInformationMessage('Compiling...');

    const compiler = new Compiler();
    const result = await compiler.compileContractInPlace(args.sourceFile);

    if (result.debug === undefined || result.funcMap === undefined) {
      response.success = false;
      response.message = 'Compiler did not return debug information';
      this.sendResponse(response);
      return;
    }

    vscode.window.showInformationMessage('Compilation complete!');
    this.debugger.init({
      abi: result.abi,
      avm: result.avm,
      sourceFile: this.sourceFile,
      contractHash: result.contractHash,
      debugInfo: result.debug!,
      funcMap: result.funcMap!
    });

    this.sendResponse(response);

    try {
      await this.debugger.start(args.method, args.data);
    } catch (e) {
      this.onOutput(`Error: ${e instanceof Error ? e.message : e}`);
    }

    this.sendEvent(new TerminatedEvent());
  }

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ) {
    const path = args.source.path;
    const lines = args.lines || [];

    if (path === undefined) {
      return;
    }

    // set and verify breakpoint locations
    const actualBreakpoints = lines.map((l) => {
      let { verified, line } = this.debugger.setBreakpoint(path, this.convertClientLineToDebugger(l));
      const bp = <DebugProtocol.Breakpoint>new Breakpoint(verified, this.convertDebuggerLineToClient(line));
      return bp;
    });

    // send back the actual breakpoint positions
    response.body = { breakpoints: actualBreakpoints };
    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    // runtime supports now threads so just return a default thread.
    response.body = {
      threads: [new Thread(DebugSession.THREAD_ID, 'thread 1')]
    };
    this.sendResponse(response);
  }

  protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
    this.debugger.continue();
    this.sendResponse(response);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments
  ): void {
    const stackFrames = this.debugger.getStackFrames();
    const vsStackFrames = stackFrames
      .reverse()
      .map(
        (sf, i) =>
          new StackFrame(
            i,
            sf.method,
            this.createSource(this.sourceFile),
            this.convertDebuggerLineToClient(sf.file_line_no)
          )
      );

    response.body = {
      stackFrames: vsStackFrames,
      totalFrames: vsStackFrames.length
    };
    this.sendResponse(response);
  }

  private onOutput(text: string) {
    const e = new OutputEvent(`${text}\n`);
    this.sendEvent(e);
  }

  private onBreakpoint() {
    this.sendEvent(new StoppedEvent('breakpoint', DebugSession.THREAD_ID));
  }

  private createSource(filePath: string): Source {
    return new Source(
      path.basename(filePath),
      this.convertDebuggerPathToClient(filePath),
      undefined,
      undefined,
      'ontology-adapter-data'
    );
  }
}
