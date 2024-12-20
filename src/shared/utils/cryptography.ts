import CryptoJS from 'crypto-js';

export const encryptData = (message: string, secret: string): string => {
  return CryptoJS.AES.encrypt(message, secret).toString();
};

export const decryptData = (ciphertext: string, secret: string): string => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secret);
  return bytes.toString(CryptoJS.enc.Utf8);
};
