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
    method
  }: {
    rpcAddress: string;
    account: Account;
    password: string;
    gasLimit: string;
    gasPrice: string;
    contract: string;
    method: string;
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
      parameters: ['Matus'],
      preExec: true
    });

    const result = response.result;
    if (result !== undefined) {
      const inner = result.Result;

      if (inner !== undefined) {
        return inner;
      }
    }
  }
}
