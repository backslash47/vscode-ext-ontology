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
  Source,
  Scope,
  Handles
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { Compiler } from '../compile/compiler';
import { Debugger } from './debugger';
import * as VM from 'ontology-ts-vm';

// Type describing the variable complex object
type ChildrenType = VM.StackItem[] | Map<VM.StackItem | string, VM.StackItem | undefined>;

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

  private variableHandles: Handles<string>;
  private sourceFile: string;

  constructor() {
    super();

    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);

    this.onOutput = this.onOutput.bind(this);
    this.onBreakpoint = this.onBreakpoint.bind(this);
    this.onStep = this.onStep.bind(this);

    this.sourceFile = '';
    this.debugger = new Debugger({
      onOutput: this.onOutput,
      onBreakpoint: this.onBreakpoint,
      onStep: this.onStep
    });
    this.variableHandles = new Handles();
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
    response.body.supportsEvaluateForHovers = false;

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

  protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
    this.debugger.next();
    this.sendResponse(response);
  }

  protected stepInRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
    this.debugger.stepIn();
    this.sendResponse(response);
  }

  protected stepOutRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
    this.debugger.stepOut();
    this.sendResponse(response);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments
  ): void {
    const stackFrames = this.debugger.getStackFrames();
    const vsStackFrames = stackFrames.map(
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

  protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
    const frameIndex = args.frameId;
    const scopes: Scope[] = [];
    scopes.push(new Scope('Local', this.variableHandles.create(`${frameIndex}`), false));

    response.body = {
      scopes: scopes
    };
    this.sendResponse(response);
  }

  protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments) {
    const variableReference = this.variableHandles.get(args.variablesReference);

    const [head, ...tail] = variableReference.split('.');

    const variables = this.debugger.getVariables(Number(head));
    const vsVariables = this.getVariablesDeep([head], tail, variables);

    response.body = {
      variables: vsVariables
    };
    this.sendResponse(response);
  }

  protected getVariablesDeep(
    parentHead: string[],
    parentTail: string[],
    children: ChildrenType
  ): DebugProtocol.Variable[] {
    const [head, ...tail] = parentTail;

    if (head === undefined) {
      // we already parsed whole tree, so return parent

      if (Array.isArray(children)) {
        // in case of Array use index as variable name
        return children.map((value, index) => {
          return this.createVariable(String(index), value, parentHead.join('.'));
        });
      } else if (children instanceof Map) {
        // in case of Map, return with proper variable name
        return Array.from<[VM.StackItem | string, VM.StackItem | undefined]>(children.entries()).map(([key, value]) => {
          if (typeof key !== 'string') {
            key = key.getByteArray().toString();
          }

          return this.createVariable(key, value, parentHead.join('.'));
        });
      }
    }

    let item: VM.StackItem | undefined;

    if (Array.isArray(children)) {
      const index = Number(head);
      if (index < children.length) {
        item = children[index];
      }
    } else if (children instanceof Map) {
      for (let [key, value] of children) {
        if (typeof key !== 'string') {
          key = key.getByteArray().toString();
        }

        if (key === head) {
          item = value;
          break;
        }
      }
    }

    if (item === undefined || !(VM.isMapType(item) || VM.isArrayType(item))) {
      // item was not found or is of wrong type
      return [];
    }

    return this.getVariablesDeep([...parentHead, head], tail, item.value);
  }

  private createVariable(name: string, item: VM.StackItem | undefined, refPrefix: string) {
    let variablesReference = 0;

    if (item !== undefined && (VM.isMapType(item) || VM.isArrayType(item))) {
      variablesReference = this.variableHandles.create(`${refPrefix}.${name}`);
    }

    return {
      name,
      type: this.getVariableType(item),
      value: this.getVariableValue(item),
      variablesReference
    };
  }

  private getVariableType(variable: VM.StackItem | undefined) {
    if (variable === undefined) {
      return 'undefined';
    }

    if (VM.isArrayType(variable)) {
      return 'array';
    } else if (VM.isBooleanType(variable)) {
      return 'bool';
    } else if (VM.isIntegerType(variable)) {
      return 'integer';
    } else if (VM.isByteArrayType(variable)) {
      return 'string';
    } else if (VM.isMapType(variable)) {
      return 'map';
    } else if (VM.isStructType(variable)) {
      return 'struct';
    } else {
      return 'unknown';
    }
  }

  private getVariableValue(variable: VM.StackItem | undefined) {
    if (variable === undefined) {
      return 'undefined';
    }

    if (VM.isArrayType(variable)) {
      return 'Array';
    } else if (VM.isBooleanType(variable)) {
      return String(variable.value);
    } else if (VM.isIntegerType(variable)) {
      return variable.value.toString();
    } else if (VM.isByteArrayType(variable)) {
      return variable.value.toString();
    } else if (VM.isMapType(variable)) {
      return 'Map';
    } else if (VM.isStructType(variable)) {
      return 'Struct';
    } else {
      return 'unknown';
    }
  }

  private onOutput(text: string) {
    const e = new OutputEvent(`${text}\n`);
    this.sendEvent(e);
  }

  private onBreakpoint() {
    this.sendEvent(new StoppedEvent('breakpoint', DebugSession.THREAD_ID));
  }

  private onStep() {
    this.sendEvent(new StoppedEvent('step', DebugSession.THREAD_ID));
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
