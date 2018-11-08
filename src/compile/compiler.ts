import * as fs from 'fs';
import * as path from 'path';
import { compile, CompilerType } from 'ontology-ts-test';
import { ensureDirExist } from '../utils/fileSystem';

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

  async compileContract(contractPath: string) {
    const code = fs.readFileSync(contractPath);

    let type: CompilerType;
    let url: string;

    if (contractPath.endsWith('.py')) {
      type = 'Python';
      url = 'https://smartxcompiler.ont.io/api/beta/python/compile';
    } else if (contractPath.endsWith('.cs')) {
      type = 'CSharp';
      url = 'https://smartxcompiler.ont.io/api/v1.0/csharp/compile';
    } else {
      throw new Error('Compile Error: Contract type is unknown.');
    }

    const abiSavePath = Compiler.constructAbiName(contractPath);
    const avmSavePath = Compiler.constructAvmName(contractPath);

    // disable SSL verify because of misconfigured compiler server
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const result = await compile({ code, type, url });
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

    ensureDirExist(path.parse(avmSavePath).dir);
    ensureDirExist(path.parse(abiSavePath).dir);

    fs.writeFileSync(avmSavePath, result.avm.toString('hex'));
    fs.writeFileSync(abiSavePath, result.abi);
  }
}
