export declare class Tooler {
    str2hex(str: string): string;
    hex2str(hex: string): string;
    address2Hex(address: string): string;
    hex2Address(hex: string): string;
    num2hex(num: string): string;
    hex2num(hex: string): string;
    hexReverse(hex: string): string;
    randomPrivateKey(): string;
    decryptPrivateKey(key: string, address: string, salt: string, n: string | undefined, password: string): Promise<string>;
}
