'use strict';

const CryptoCodec = require('../js/lib/crypto-codec');

// jest.setup.js が global.crypto に Node の webcrypto を注入している。実際のブラウザでは
// window.crypto が同じインターフェースを提供する。

describe('CryptoCodec', () => {
  const cryptoObj = global.crypto;

  test('deriveKey()した鍵でencryptField()→decryptField()すると元の平文に戻る', async () => {
    const saltBase64 = CryptoCodec.generateSaltBase64(cryptoObj);
    const key = await CryptoCodec.deriveKey({
      cryptoObj,
      passphrase: 'correct-horse-battery-staple',
      saltBase64,
      iterations: 1000, // テストなので反復回数は本番値(600000)より小さくして高速化する
    });

    const { ivBase64, ctBase64 } = await CryptoCodec.encryptField({
      cryptoObj,
      key,
      plaintext: '機密情報です。123',
    });

    const decrypted = await CryptoCodec.decryptField({
      cryptoObj,
      key,
      ivBase64,
      ctBase64,
    });

    expect(decrypted).toBe('機密情報です。123');
  });

  test('空文字列の平文でもラウンドトリップする', async () => {
    const saltBase64 = CryptoCodec.generateSaltBase64(cryptoObj);
    const key = await CryptoCodec.deriveKey({
      cryptoObj,
      passphrase: 'passphrase',
      saltBase64,
      iterations: 1000,
    });

    const { ivBase64, ctBase64 } = await CryptoCodec.encryptField({
      cryptoObj,
      key,
      plaintext: '',
    });
    const decrypted = await CryptoCodec.decryptField({
      cryptoObj,
      key,
      ivBase64,
      ctBase64,
    });

    expect(decrypted).toBe('');
  });

  test('誤ったパスフレーズから導出した鍵で復号するとDecryptionErrorを投げる', async () => {
    const saltBase64 = CryptoCodec.generateSaltBase64(cryptoObj);
    const correctKey = await CryptoCodec.deriveKey({
      cryptoObj,
      passphrase: 'correct-passphrase',
      saltBase64,
      iterations: 1000,
    });
    const { ivBase64, ctBase64 } = await CryptoCodec.encryptField({
      cryptoObj,
      key: correctKey,
      plaintext: '秘密の値',
    });

    const wrongKey = await CryptoCodec.deriveKey({
      cryptoObj,
      passphrase: 'wrong-passphrase',
      saltBase64,
      iterations: 1000,
    });

    await expect(
      CryptoCodec.decryptField({
        cryptoObj,
        key: wrongKey,
        ivBase64,
        ctBase64,
      }),
    ).rejects.toThrow(CryptoCodec.DecryptionError);
  });

  test('同じ平文・同じ鍵でも暗号化のたびに異なるIV/暗号文になる(IV使い回しの回帰防止)', async () => {
    const saltBase64 = CryptoCodec.generateSaltBase64(cryptoObj);
    const key = await CryptoCodec.deriveKey({
      cryptoObj,
      passphrase: 'passphrase',
      saltBase64,
      iterations: 1000,
    });

    const first = await CryptoCodec.encryptField({
      cryptoObj,
      key,
      plaintext: '同じ平文',
    });
    const second = await CryptoCodec.encryptField({
      cryptoObj,
      key,
      plaintext: '同じ平文',
    });

    expect(first.ivBase64).not.toBe(second.ivBase64);
    expect(first.ctBase64).not.toBe(second.ctBase64);
  });

  test('deriveKey()が返す鍵はextractable:falseである', async () => {
    const saltBase64 = CryptoCodec.generateSaltBase64(cryptoObj);
    const key = await CryptoCodec.deriveKey({
      cryptoObj,
      passphrase: 'passphrase',
      saltBase64,
      iterations: 1000,
    });
    expect(key.extractable).toBe(false);
  });

  test('generateSaltBase64()は呼び出しごとに異なる値を返す', () => {
    const a = CryptoCodec.generateSaltBase64(cryptoObj);
    const b = CryptoCodec.generateSaltBase64(cryptoObj);
    expect(a).not.toBe(b);
  });
});
