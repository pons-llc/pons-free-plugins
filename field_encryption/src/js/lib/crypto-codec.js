(function (root) {
  'use strict';

  // crypto.subtle(Web Crypto API)をDIで受け取り、PBKDF2による鍵導出とAES-GCMによる暗号化/復号を
  // 提供する。cryptoObj自体をDIするのは、Jest(Node)ではNodeのWeb Crypto実装(webcrypto)を、
  // ブラウザ(kintone上)ではwindow.cryptoを、それぞれ呼び出し側から注入して同じロジックを
  // テスト・実行できるようにするため。

  const IV_LENGTH_BYTES = 12; // NIST SP 800-38DがAES-GCMに推奨する96bit
  const SALT_LENGTH_BYTES = 16;
  const KEY_LENGTH_BITS = 256;

  class DecryptionError extends Error {
    constructor(message) {
      super(message);
      this.name = 'DecryptionError';
    }
  }

  const bytesToBase64 = (bytes) => {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    if (typeof btoa === 'function') {
      return btoa(binary);
    }
    return Buffer.from(bytes).toString('base64');
  };

  const base64ToBytes = (base64) => {
    if (typeof atob === 'function') {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    return new Uint8Array(Buffer.from(base64, 'base64'));
  };

  const generateSaltBase64 = (cryptoObj) =>
    bytesToBase64(cryptoObj.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES)));

  // 導出した鍵はextractable:falseで生成し、生の鍵データを取り出せないようにする。
  const deriveKey = async ({
    cryptoObj,
    passphrase,
    saltBase64,
    iterations,
  }) => {
    const keyMaterial = await cryptoObj.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return cryptoObj.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: base64ToBytes(saltBase64),
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH_BITS },
      false,
      ['encrypt', 'decrypt'],
    );
  };

  // IVは呼び出しのたびに新しい乱数を生成する(同一鍵でのIV使い回しは厳禁)。
  const encryptField = async ({ cryptoObj, key, plaintext }) => {
    const iv = cryptoObj.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
    const ciphertext = await cryptoObj.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    return {
      ivBase64: bytesToBase64(iv),
      ctBase64: bytesToBase64(new Uint8Array(ciphertext)),
    };
  };

  // 誤ったパスフレーズから導出した鍵で復号すると、AES-GCMの認証タグ検証に失敗して例外になる。
  // これをそのまま「パスフレーズが正しいかどうか」の判定に利用する(別途検証用データを保存しない)。
  const decryptField = async ({ cryptoObj, key, ivBase64, ctBase64 }) => {
    let plaintextBuffer;
    try {
      plaintextBuffer = await cryptoObj.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(ivBase64) },
        key,
        base64ToBytes(ctBase64),
      );
    } catch {
      throw new DecryptionError(
        '復号に失敗しました。パスフレーズが正しくないか、データが壊れています。',
      );
    }
    return new TextDecoder().decode(plaintextBuffer);
  };

  const CryptoCodec = {
    IV_LENGTH_BYTES,
    SALT_LENGTH_BYTES,
    DecryptionError,
    bytesToBase64,
    base64ToBytes,
    generateSaltBase64,
    deriveKey,
    encryptField,
    decryptField,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoCodec;
  } else {
    root.FieldEncryption = root.FieldEncryption || {};
    root.FieldEncryption.CryptoCodec = CryptoCodec;
  }
})(typeof window !== 'undefined' ? window : globalThis);
