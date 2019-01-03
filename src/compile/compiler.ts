import * as fs from 'fs';
import * as path from 'path';
import { compile, CompilerType, reverseBuffer } from 'ontology-ts-test';
import { ensureDirExist } from '../utils/fileSystem';
import { Address } from 'ontology-ts-crypto';
import { Abi } from '../abi/abiTypes';

export class Compiler {
  static constructAbiName(contractPath: string) {
    const splitPath = path.parse(contractPath);
    const savePath = path.join(splitPath.dir, 'build', splitPath.base);

    if (savePath.endsWith('.py')) {
      return savePath.replace('.py', '_abi.json');
    } else {
      return savePath.replace('.cs', '_abi.json');
    }
  }

  static constructAvmName(contractPath: string) {
    const splitPath = path.parse(contractPath);
    const savePath = path.join(splitPath.dir, 'build', splitPath.base);

    if (savePath.endsWith('.py')) {
      return savePath.replace('.py', '.avm');
    } else {
      return savePath.replace('.cs', '.avm');
    }
  }

  static constructFuncMapName(contractPath: string) {
    const splitPath = path.parse(contractPath);
    const savePath = path.join(splitPath.dir, 'build', splitPath.base);

    if (savePath.endsWith('.py')) {
      return savePath.replace('.py', '_funcMap.json');
    } else {
      return savePath.replace('.cs', '__funcMap.json');
    }
  }

  static constructDebugName(contractPath: string) {
    const splitPath = path.parse(contractPath);
    const savePath = path.join(splitPath.dir, 'build', splitPath.base);

    if (savePath.endsWith('.py')) {
      return savePath.replace('.py', '_debug.json');
    } else {
      return savePath.replace('.cs', '__debug.json');
    }
  }

  async compileContract(contractPath: string, useV2: boolean) {
    const result = await this.compileContractInPlace(contractPath, useV2);

    const abiPath = Compiler.constructAbiName(contractPath);
    const avmPath = Compiler.constructAvmName(contractPath);

    ensureDirExist(path.parse(avmPath).dir);

    fs.writeFileSync(avmPath, result.avm.toString('hex'));
    fs.writeFileSync(abiPath, result.abi);

    if (result.debug !== undefined) {
      const debugPath = Compiler.constructDebugName(contractPath);
      fs.writeFileSync(debugPath, JSON.stringify(result.debug));
    }

    if (result.funcMap !== undefined) {
      const funcMapPath = Compiler.constructFuncMapName(contractPath);
      fs.writeFileSync(funcMapPath, JSON.stringify(result.funcMap));
    }

    return result;
  }

  async compileContractIncremental(contractPath: string, useV2: boolean) {
    const abiPath = Compiler.constructAbiName(contractPath);
    const avmPath = Compiler.constructAvmName(contractPath);
    const debugPath = Compiler.constructDebugName(contractPath);
    const funcMapPath = Compiler.constructFuncMapName(contractPath);

    ensureDirExist(path.parse(avmPath).dir);

    try {
      const sourceStats = fs.statSync(contractPath);
      const abiStats = fs.statSync(abiPath);
      const avmStats = fs.statSync(avmPath);
      const debugStats = fs.statSync(debugPath);
      const funcMapStats = fs.statSync(funcMapPath);

      const usedV2 = usedPythonV2Compiler(abiPath);

      if (
        sourceStats.mtimeMs > abiStats.mtimeMs ||
        sourceStats.mtimeMs > avmStats.mtimeMs ||
        sourceStats.mtimeMs > debugStats.mtimeMs ||
        sourceStats.mtimeMs > funcMapStats.mtimeMs ||
        usedV2 === undefined || // wrong ABI
        usedV2 !== useV2 // used different compiler version
      ) {
        // if outdated
        return this.compileContract(contractPath, useV2);
      }
    } catch (e) {
      // fallback to compile
      return this.compileContract(contractPath, useV2);
    }

    const avm = new Buffer(fs.readFileSync(avmPath).toString(), 'hex');

    return {
      abi: fs.readFileSync(abiPath),
      avm,
      debug: JSON.parse(fs.readFileSync(debugPath).toString()),
      funcMap: JSON.parse(fs.readFileSync(funcMapPath).toString()),
      contractHash: reverseBuffer(Address.fromVmCode(avm).toArray()).toString('hex')
    };
  }

  async compileContractInPlace(contractPath: string, useV2: boolean) {
    const code = fs.readFileSync(contractPath);

    let type: CompilerType;
    let url: string;

    if (contractPath.endsWith('.py')) {
      type = 'Python';

      if (useV2) {
        url = 'https://smartxcompiler.ont.io/api/v2.0/python/compile';
      } else {
        url = 'https://smartxcompiler.ont.io/api/beta/python/compile';
      }
    } else if (contractPath.endsWith('.cs')) {
      type = 'CSharp';
      url = 'https://smartxcompiler.ont.io/api/v1.0/csharp/compile';
    } else {
      throw new Error('Compile Error: Contract type is unknown.');
    }

    // disable SSL verify because of misconfigured compiler server
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const result = await compile({ code, type, url });
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

    return {
      avm: result.avm,
      abi: result.abi,
      contractHash: result.hash,
      debug: result.debug,
      funcMap: result.funcMap
    };
  }
}

function usedPythonV2Compiler(fileName: string) {
  if (!fs.existsSync(fileName)) {
    return undefined;
  }

  try {
    const f = fs.readFileSync(fileName, 'utf8');
    const abi = JSON.parse(f) as Abi;

    const compilerVersion: string | undefined = abi.CompilerVersion;

    return compilerVersion !== undefined ? compilerVersion.startsWith('2') : false;
  } catch (e) {
    return undefined;
  }
}
