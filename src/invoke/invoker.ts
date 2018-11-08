import { Account } from 'ontology-ts-crypto';
import { initClient, isDeployed, invoke } from 'ontology-ts-test';

export class Invoker {
  async invoke({
    rpcAddress,
    account,
    password,
    gasLimit,
    gasPrice,
    contract,
    method,
    parameters,
    preExec
  }: {
    rpcAddress: string;
    account?: Account;
    password?: string;
    gasLimit: string;
    gasPrice: string;
    contract: string;
    method: string;
    parameters?: any[];
    preExec: boolean;
  }) {
    const client = initClient({ rpcAddress });

    const deployed = await isDeployed({ client, scriptHash: contract });

    if (!deployed) {
      throw new Error('Contract is not deployed.');
    }

    const response = await invoke({
      client,
      account,
      password,
      gasLimit,
      gasPrice,
      contract,
      method,
      parameters,
      preExec,
      wait: false
    });

    const result = response.result;
    if (result !== undefined) {
      if (typeof result === 'string') {
        return result;
      }

      const inner = result.Result;

      if (inner !== undefined) {
        return inner;
      }
    }
  }
}
