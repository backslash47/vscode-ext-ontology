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

  private debugBlocks: DebugBlock[];

  private lastInstruction: InspectData | undefined;
  private snapshotStackDepth: number;
  private snapshotBlock: DebugBlock | undefined;

  private stepMode: 'no' | 'next' | 'stepIn' | 'stepOut';

  private onOutput: (text: string) => void;
  private onBreakpoint: () => void;

  private onStep: () => void;

  constructor({
    onOutput,
    onBreakpoint,
    onStep
  }: {
    onOutput: (text: string) => void;
    onBreakpoint: () => void;
    onStep: () => void;
  }) {
    this.stateStore = new RuntimeStateStore();
    this.runtime = new ScEnvironment({ store: this.stateStore });

    this.breakpoints = new Map();
    this.breakpointId = 1;

    this.debugBlocks = [];
    this.stepMode = 'no';
    this.snapshotStackDepth = 0;

    this.onOutput = onOutput;
    this.onBreakpoint = onBreakpoint;
    this.onStep = onStep;

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
      this.stepMode = 'no';
    }
  }

  next() {
    if (this.paused !== undefined) {
      this.paused.resolve(true);
      this.paused = undefined;
      this.stepMode = 'next';
    }
  }

  stepIn() {
    if (this.paused !== undefined) {
      this.paused.resolve(true);
      this.paused = undefined;
      this.stepMode = 'stepIn';
    }
  }

  stepOut() {
    if (this.paused !== undefined) {
      this.paused.resolve(true);
      this.paused = undefined;
      this.stepMode = 'stepOut';
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
    return Array.from(this.debugBlocks);
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
    const debug = this.debugInfo.map.find((p) => ip >= p.start && ip <= p.end);

    console.log(ip + ' ' + data.opName);

    // if no debug then skip
    if (debug === undefined) {
      return true;
    }

    this.checkDebugBlocks(data, debug);

    if (debug.start === ip) {
      // check breakpoint on block start
      if (this.checkBreakpoint(debug)) {
        return this.stop(debug, true);
      }
    }

    if (this.stepMode === 'stepIn') {
      // check if block changed
      if (this.snapshotBlock !== debug) {
        return this.stop(debug);
      }
    }

    if (this.stepMode === 'stepOut') {
      // check if block changed and stack depth is lower
      if (this.snapshotBlock !== debug && this.debugBlocks.length < this.snapshotStackDepth) {
        return this.stop(debug);
      }
    }

    if (this.stepMode === 'next') {
      // check if block changed and the stack depth is the same or lower
      if (this.snapshotBlock !== debug && this.debugBlocks.length <= this.snapshotStackDepth) {
        return this.stop(debug);
      }
    }

    return true;
  }

  private stop(debug: DebugBlock, breakpoint?: boolean) {
    if (breakpoint) {
      this.onBreakpoint();
    } else {
      this.onStep();
    }

    this.snapshotBlock = debug;
    this.snapshotStackDepth = this.debugBlocks.length;
    this.paused = new Deferred();
    return this.paused.promise;
  }

  private checkDebugBlocks(instruction: InspectData, block: DebugBlock) {
    const lastBlock = this.debugBlocks.pop();
    if (lastBlock === undefined) {
      this.debugBlocks.push(block);
      return;
    }

    if (lastBlock.file_line_no !== block.file_line_no || lastBlock.file !== block.file) {
      console.log('before: ' + lastBlock.file_line_no, ' after: ' + block.file_line_no);
    }

    const lastInstruction = this.lastInstruction;
    this.lastInstruction = instruction;

    if (lastInstruction === undefined) {
      this.debugBlocks.push(block);
      return;
    }

    if (lastInstruction.opCode === OpCode.CALL) {
      // CALL instruction is part of previous Block
      // keep previous and current block
      this.debugBlocks.push(lastBlock);
      this.debugBlocks.push(block);
    } else if (lastInstruction.opCode === OpCode.RET) {
      // RET is closing previous block, but is also part of current Block
      // remove previous and don't keep current block
    } else {
      // other instructions are part of previous and current block, so keep only one
      this.debugBlocks.push(block);
    }
  }

  private checkBreakpoint(block: DebugBlock) {
    const breakpoints = this.breakpoints.get(this.sourceFile);
    if (breakpoints === undefined) {
      return false;
    }

    return breakpoints.find((b) => b.line === block.file_line_no) !== undefined;
  }
}
