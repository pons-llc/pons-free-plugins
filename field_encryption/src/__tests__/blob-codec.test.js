'use strict';

const BlobCodec = require('../js/lib/blob-codec');

describe('BlobCodec', () => {
  const envelope = {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iter: 600000,
    cipher: 'AES-256-GCM',
    salt: 'c2FsdA==',
    iv: 'aXY=',
    ct: 'Y2lwaGVydGV4dA==',
  };

  test('encode()はマーカー接頭辞付きのbase64文字列を返す', () => {
    const encoded = BlobCodec.encode(envelope);
    expect(encoded.startsWith('FE1:')).toBe(true);
  });

  test('encode()→decode()はラウンドトリップする', () => {
    const encoded = BlobCodec.encode(envelope);
    expect(BlobCodec.decode(encoded)).toEqual(envelope);
  });

  test('isEncrypted()はマーカーの有無だけで判定する', () => {
    expect(BlobCodec.isEncrypted(BlobCodec.encode(envelope))).toBe(true);
    expect(BlobCodec.isEncrypted('ただの平文です')).toBe(false);
    expect(BlobCodec.isEncrypted('')).toBe(false);
    expect(BlobCodec.isEncrypted(undefined)).toBe(false);
    expect(BlobCodec.isEncrypted(null)).toBe(false);
  });

  test('decode()はマーカーが無い値に対して例外を投げる', () => {
    expect(() => BlobCodec.decode('平文です')).toThrow(
      BlobCodec.BlobDecodeError,
    );
  });

  test('decode()はマーカーはあるがbase64が壊れている値に対して例外を投げる', () => {
    expect(() => BlobCodec.decode('FE1:***invalid-base64***')).toThrow(
      BlobCodec.BlobDecodeError,
    );
  });

  test('decode()はbase64は正しいがJSONが壊れている値に対して例外を投げる', () => {
    const brokenJsonBase64 = Buffer.from('{invalid', 'utf-8').toString(
      'base64',
    );
    expect(() => BlobCodec.decode(`FE1:${brokenJsonBase64}`)).toThrow(
      BlobCodec.BlobDecodeError,
    );
  });

  test('decode()は未知のバージョンマーカーに対して例外を投げる(将来のフォーマット変更に備える)', () => {
    const base64 = Buffer.from(JSON.stringify(envelope), 'utf-8').toString(
      'base64',
    );
    expect(() => BlobCodec.decode(`FE9:${base64}`)).toThrow(
      BlobCodec.BlobDecodeError,
    );
  });
});
