import 'babel-polyfill';
import { Tooler } from './tooler';

(() => {
  const tooler = new Tooler();

  const bHex2str = document.getElementById('hex2str')!;
  const bStr2hex = document.getElementById('str2hex')!;
  const iHexString = document.getElementById('hex-string')! as HTMLInputElement;
  const iString = document.getElementById('string')! as HTMLInputElement;

  bHex2str.addEventListener('click', () => {
    iString.value = tooler.hex2str(iHexString.value);
  });

  bStr2hex.addEventListener('click', () => {
    iHexString.value = tooler.str2hex(iString.value);
  });

  const bHex2address = document.getElementById('hex2address')!;
  const bAddress2hex = document.getElementById('address2hex')!;
  const iScriptHash = document.getElementById('script-hash')! as HTMLInputElement;
  const iAddress = document.getElementById('address')! as HTMLInputElement;

  bHex2address.addEventListener('click', () => {
    iAddress.value = tooler.hex2Address(iScriptHash.value);
  });

  bAddress2hex.addEventListener('click', () => {
    iScriptHash.value = tooler.address2Hex(iAddress.value);
  });

  const bHex2num = document.getElementById('hex2num')!;
  const bNum2hex = document.getElementById('num2hex')!;
  const iNumHexString = document.getElementById('num-hex-string')! as HTMLInputElement;
  const iNumber = document.getElementById('number')! as HTMLInputElement;

  bHex2num.addEventListener('click', () => {
    iNumber.value = tooler.hex2num(iNumHexString.value);
  });

  bNum2hex.addEventListener('click', () => {
    iNumHexString.value = tooler.num2hex(iNumber.value);
  });

  const bBig2little = document.getElementById('big2little')!;
  const bLittle2big = document.getElementById('little2big')!;
  const big = document.getElementById('big')! as HTMLInputElement;
  const little = document.getElementById('little')! as HTMLInputElement;

  bBig2little.addEventListener('click', () => {
    little.value = tooler.hexReverse(big.value);
  });

  bLittle2big.addEventListener('click', () => {
    big.value = tooler.hexReverse(little.value);
  });

  const bHex2arr = document.getElementById('hex2arr')!;
  const bArr2hex = document.getElementById('arr2hex')!;
  const iArrHexString = document.getElementById('arr-hex-string')! as HTMLInputElement;
  const iArray = document.getElementById('array')! as HTMLInputElement;

  bHex2arr.addEventListener('click', () => {
    iArray.value = tooler.hex2array(iArrHexString.value);
  });

  bArr2hex.addEventListener('click', () => {
    iArrHexString.value = tooler.array2hex(iArray.value);
  });
})();
