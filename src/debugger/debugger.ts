import {
  ScEnvironment,
  StateStore,
  RuntimeStateStore,
  NotifyEventInfo,
  LogEventInfo,
  InspectData
} from 'ontology-ts-vm';
import { processParams } from '../invoke/invoker';
import { Abi } from '../abi/abiTypes';
import { buildInvokePayload } from 'ontology-ts-test';
import { Debug, FuncMap } from 'ontology-ts-test/lib/types/compiler';
import { Deferred } from '../utils/deferred';
import { OpCode } from 'ontology-ts-crypto';

interface DebugBlock {
  start: number;
  end: number;
  file: number;
  method: string;
  line: number;
  file_line_no: number;
}

interface Breakpoint {
  id: number;
  line: number;
  verified: boolean;
}

export class Debugger {
  private runtime: ScEnvironment;
  private stateStore: StateStore;

  private paused: Deferred<boolean> | undefined;

  private abi!: Abi;
  private sourceFile!: string;
  private debugInfo!: Debug;
  private funcMap!: FuncMap;
  private contractHash!: string;

  private breakpointId: number;

  private breakpoints: Map<string, Breakpoint[]>;

  private stackFrames: DebugBlock[];
  private awaitCall: boolean;

  private onOutput: (text: string) => void;
  private onBreakpoint: () => void;

  constructor({ onOutput, onBreakpoint }: { onOutput: (text: string) => void; onBreakpoint: () => void }) {
    this.stateStore = new RuntimeStateStore();
    this.runtime = new ScEnvironment({ store: this.stateStore });

    this.breakpoints = new Map();
    this.breakpointId = 1;

    this.stackFrames = [];
    this.awaitCall = false;

    this.onOutput = onOutput;
    this.onBreakpoint = onBreakpoint;

    this.onNotify = this.onNotify.bind(this);
    this.onLog = this.onLog.bind(this);
    this.onInspect = this.onInspect.bind(this);
  }

  init({
    avm,
    abi,
    sourceFile,
    contractHash,
    debugInfo,
    funcMap
  }: {
    abi: Buffer;
    avm: Buffer;
    sourceFile: string;
    contractHash: string;
    debugInfo: Debug;
    funcMap: FuncMap;
  }) {
    this.contractHash = contractHash;
    this.abi = JSON.parse(abi.toString('utf8'));
    this.runtime.deployContract(avm);

    this.debugInfo = debugInfo;
    this.funcMap = funcMap;
    this.sourceFile = sourceFile;
  }

  async start(method: string, data: any[]) {
    const abiFunction = this.findMethod(method);

    if (abiFunction === undefined) {
      throw new Error(`Method ${method} was not found in ABI file.`);
    }
    const abiParameters = abiFunction.parameters;

    const parameters = processParams(abiParameters, data);
    const scriptCode = buildInvokePayload(this.contractHash, method, parameters);

    return this.runtime.execute(scriptCode, {
      enableGas: false,
      enableSecurity: false,
      notificationCallback: this.onNotify,
      logCallback: this.onLog,
      inspect: this.onInspect
    });
  }

  continue() {
    if (this.paused !== undefined) {
      this.paused.resolve(true);
      this.paused = undefined;
    }
  }

  setBreakpoint(path: string, line: number) {
    const bp: Breakpoint = { verified: true, line, id: this.breakpointId++ };
    let bps = this.breakpoints.get(path);
    if (!bps) {
      bps = [];
      this.breakpoints.set(path, bps);
    }
    bps.push(bp);

    return bp;
  }

  getStackFrames() {
    return this.stackFrames;
  }

  private findMethod(method: string) {
    return this.abi.functions.find((f) => f.name === method);
  }

  private onNotify(event: NotifyEventInfo) {
    this.onOutput(`Notify: ${JSON.stringify(event.states)}`);
  }

  private onLog(event: LogEventInfo) {
    this.onOutput(`Log: ${JSON.stringify(event.message)}`);
  }

  private async onInspect(data: InspectData) {
    const ip = data.instructionPointer;
    const breakDebug = this.debugInfo.map.find((p) => p.start === ip);
    const debug = this.debugInfo.map.find((p) => ip >= p.start && ip <= p.end);

    console.log(ip + ' ' + data.opName);

    // if no debug then skip
    if (debug === undefined) {
      return true;
    }

    this.checkStackframes(data, debug);

    // if no debug then skip breakpoint check
    if (breakDebug !== undefined) {
      const breakpoint = this.checkBreakpoint(breakDebug.file_line_no);
      if (breakpoint !== undefined) {
        this.paused = new Deferred();
        this.onBreakpoint();
        return this.paused.promise;
      }
    }

    return true;
  }

  private checkStackframes(data: InspectData, block: DebugBlock) {
    if (data.opCode === OpCode.CALL) {
      this.awaitCall = true;
    }

    const lastBlock = this.stackFrames.pop();
    if (lastBlock === undefined) {
      this.stackFrames.push(block);
      return;
    }

    if (this.awaitCall) {
      // keep calling block and called block
      this.stackFrames.push(lastBlock);
      this.stackFrames.push(block);
      this.awaitCall = false;
    } else {
      // keep only newest block
      this.stackFrames.push(block);
    }
  }

  private checkBreakpoint(fileLine: number) {
    const breakpoints = this.breakpoints.get(this.sourceFile);
    if (breakpoints === undefined) {
      return;
    }

    return breakpoints.find((b) => b.line === fileLine);
  }
}
