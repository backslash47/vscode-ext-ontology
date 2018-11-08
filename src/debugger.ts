import {
    Address,
    LogCallback,
    NotificationCallback,
    RuntimeStateStore,
    ScEnvironment,
    StateStore
  } from 'ontology-ts-vm';
  
  export { RuntimeStateStore };
  
  export class Debugger {
    instructionPointer: number;
    private env: ScEnvironment;
    private readonly addressBuffer: Buffer;
    private readonly address: Address;
    private readonly lineMappings: {};
    private readonly onStop?: (data: any) => void = undefined;
    private readonly notificationCallback?: NotificationCallback;
    private readonly logCallback?: LogCallback;
    private breakpoints: number[] = [];
    private stopAtInstructionPointer?: number;
    private stopAfterLine?: number;
    private stopAfterInstructionPointer?: number;
    private resolve?: (value: boolean) => void = undefined;
    private history: any[] = [];
  
    constructor(
      contract: Buffer,
      lineMappings: any = {},
      onStop?: (data: any) => void,
      store?: StateStore,
      notificationCallback?: NotificationCallback,
      logCallback?: LogCallback
    ) {
      this.instructionPointer = 0;
      this.env = new ScEnvironment({store});
      this.addressBuffer = this.env.deployContract(contract);
      this.address = Address.parseFromBytes(this.addressBuffer);
      this.lineMappings = lineMappings;
      this.onStop = onStop;
      this.notificationCallback = notificationCallback;
      this.logCallback = logCallback;
    }
  
    addOpcodeBreakpoint(pointer: number) {
      if (!this.breakpoints.includes(pointer)) {
        this.breakpoints.push(pointer);
      }
    }
  
    addLineBreakpoint(line: number) {
      // @ts-ignore
      const pointer: any = this.lineMappings[line];
      if (pointer !== undefined) {
        this.addOpcodeBreakpoint(pointer.start);
      }
    }
  
    removeOpcodeBreakpoint(pointer: number) {
      const index = this.breakpoints.indexOf(pointer);
      if (index > -1) {
        this.breakpoints.splice(index, 1);
      }
    }
  
    removeLineBreakpoint(line: number) {
      // @ts-ignore
      const pointer: any = this.lineMappings[line];
      if (pointer !== undefined) {
        this.removeOpcodeBreakpoint(pointer.start);
      }
    }
  
    continue() {
      if (this.resolve !== undefined) {
        const resolve = this.resolve;
        this.resolve = undefined;
        resolve(true);
      }
    }
  
    stop() {
      if (this.resolve !== undefined) {
        const resolve = this.resolve;
        this.resolve = undefined;
        resolve(false);
      }
    }
  
    stepOverOpcode() {
      this.stopAfterInstructionPointer = this.instructionPointer;
      this.continue();
    }
  
    stepOverLine() {
      this.stopAfterLine = this.getCurrentLine();
      this.continue();
    }
  
    runToLine(line: number) {
      // @ts-ignore
      const pointer: any = this.lineMappings[line];
      if (pointer !== undefined) {
        this.stopAtInstructionPointer = pointer.start;
        this.continue();
      }
    }
  
    async execute(args: Buffer[]) {
      const call = Buffer.concat([...args, new Buffer([103]), this.addressBuffer]);
      return await this.env.execute(call, {
        inspect: async (data) => {
          if (!data.contractAddress.equals(this.address)) {
            return true;
          }
          if (data.opCode === 97) {
            return true;
          }
          this.instructionPointer = data.instructionPointer;
          const evaluationStack = [];
          for (let i = 0; i < data.evaluationStack.count(); i++) {
            evaluationStack.push(data.evaluationStack.peek(i)!.toString());
          }
          this.history.push({instructionPointer: data.instructionPointer, opName: data.opName, evaluationStack});
          const currentLine = this.getCurrentLine();
          if (this.breakpoints.includes(data.instructionPointer) ||
            this.stopAtInstructionPointer === data.instructionPointer ||
            (currentLine !== null && this.stopAfterLine !== null && currentLine !== this.stopAfterLine) ||
            (this.stopAfterInstructionPointer !== null && data.instructionPointer !== this.stopAfterInstructionPointer)) {
            this.stopAtInstructionPointer = undefined;
            this.stopAfterLine = undefined;
            this.stopAfterInstructionPointer = undefined;
            if (this.onStop !== undefined) {
              this.onStop({
                instructionPointer: this.instructionPointer,
                line: currentLine,
                evaluationStack: data.evaluationStack,
                altStack: data.altStack,
                history: this.history
              });
            }
            return new Promise<boolean>((resolve) => {
              this.resolve = resolve;
            });
          }
          return true;
        },
        enableSecurity: false,
        enableGas: false,
        notificationCallback: this.notificationCallback,
        logCallback: this.logCallback
      });
    }
  
    private getCurrentLine() {
      const entries: Array<[string, any]> = Object.entries(this.lineMappings);
      for (const [line, pointer] of entries) {
        if (pointer.start <= this.instructionPointer && this.instructionPointer <= pointer.end) {
          return parseInt(line, 10);
        }
      }
    }
  }