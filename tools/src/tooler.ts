import * as bigInt from 'big-integer';
import { Account, Address, PrivateKey, Serialize } from 'ontology-ts-crypto';
import { reverseBuffer } from 'ontology-ts-test';

// tslint:disable:object-literal-key-quotes

export class Tooler {
  str2hex(str: string) {
    return new Buffer(str).toString('hex');
  }

  hex2str(hex: string) {
    return new Buffer(hex, 'hex').toString();
  }

  address2Hex(address: string) {
    return Address.fromBase58(address)
      .toArray()
      .toString('hex');
  }

  hex2Address(hex: string) {
    return new Address(hex).toBase58();
  }

  num2hex(num: string) {
    return Serialize.bigIntToBytes(bigInt(num)).toString('hex');
  }

  hex2num(hex: string) {
    return Serialize.bigIntFromBytes(new Buffer(hex, 'hex')).toString();
  }

  hexReverse(hex: string) {
    return reverseBuffer(new Buffer(hex, 'hex')).toString('hex');
  }

  hex2array(hex: string) {
    const buffer = new Buffer(hex, 'hex');
    const arr = Array.from(buffer);

    const content = arr.map((b) => `0x${b.toString(16).toUpperCase()}`).join(', ');

    return `{${content}}`;
  }

  array2hex(content: string) {
    content = content.trim();
    if (!content.startsWith('{') || !content.endsWith('}')) {
      return '';
    }
    content = content.substr(1, content.length - 2);

    const items = content.split(',');
    const arr = items.map((i) => Number(i.trim()));

    return new Buffer(arr).toString('hex');
  }

  randomPrivateKey() {
    return PrivateKey.random().key.toString('hex');
  }

  async decryptPrivateKey(key: string, address: string, salt: string, n: string = '16384', password: string) {
    const account = Account.deserializeJson(
      {
        address,
        algorithm: 'ECDSA',
        'enc-alg': 'aes-256-gcm',
        hash: 'sha256',
        isDefault: true,
        key,
        label: 'label',
        lock: false,
        parameters: {
          curve: 'P-256'
        },
        publicKey: '03f631f975560afc7bf47902064838826ec67794ddcdbcc6f0a9c7b91fc8502583',
        salt,
        signatureScheme: 'SHA256withECDSA'
      },
      {
        r: 8,
        p: 8,
        keyLength: 64,
        N: Number(n)
      }
    );

    const sk = await account.decryptKey(password);

    return sk.key.toString('hex');
  }
}
