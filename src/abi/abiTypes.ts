export interface Abi {
  CompilerVersion: string;
  hash: string;
  entrypoint: string;
  events: any[];
  functions: AbiFunction[];
}

export interface AbiFunction {
  name: string;
  parameters: AbiParamter[];
  returntype: AbiType;
}

export interface AbiParamter {
  name: string;
  type: AbiType;
}

export type AbiType = 'String' | 'Integer' | 'Array' | 'Boolean' | 'ByteArray' | 'Struct';
