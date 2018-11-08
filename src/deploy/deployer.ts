import * as fs from 'fs';
import { initClient, isDeployed, reverseBuffer, deploy } from 'ontology-ts-test';
import { Address, Account } from 'ontology-ts-crypto';

export class Deployer {
  static readAvm(fileName: string) {
    const codeBuffer = fs.readFileSync(fileName);
    const codeString = codeBuffer.toString();
    return new Buffer(codeString, 'hex');
  }

  static generateContractAddress(avm: Buffer) {
    return reverseBuffer(Address.fromVmCode(avm).toArray()).toString('hex');
  }

  async deployContract({
    fileName,
    rpcAddress,
    account,
    password,
    gasLimit,
    gasPrice,
    ...rest
  }: {
    fileName: string;
    rpcAddress: string;
    account: Account;
    password: string;
    gasLimit: string;
    gasPrice: string;
    name?: string;
    version?: string;
    author?: string;
    email?: string;
    description?: string;
  }) {
    const avm = Deployer.readAvm(fileName);

    const client = initClient({ rpcAddress });

    const contractAddress = Deployer.generateContractAddress(avm);
    const deployed = await isDeployed({ client, scriptHash: contractAddress });

    if (deployed) {
      throw new Error(`Contract is already deployed at ${contractAddress}.`);
    }

    await deploy({
      client,
      account,
      password,
      code: avm,
      gasLimit,
      gasPrice,
      ...rest
    });
  }
}
