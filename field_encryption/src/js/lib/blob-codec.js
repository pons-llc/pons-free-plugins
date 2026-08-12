(function (root) {
  'use strict';

  // フィールドに保存する暗号化済み値のエンコード/デコードを担う。保存フォーマットは
  // 「FE1:」+ base64({v, kdf, iter, cipher, salt, iv, ct} をJSON化したもの)。
  // JSON化する値(salt/iv/ctは既にbase64文字列、他は固定の英数字リテラル)は常にASCIIになるため、
  // btoa/atob(ブラウザ)・Buffer(Node/Jest)のどちらでもUnicode変換を気にせず使える。
  const MARKER = 'FE1:';

  class BlobDecodeError extends Error {
    constructor(message) {
      super(message);
      this.name = 'BlobDecodeError';
    }
  }

  const toBase64 = (str) => {
    if (typeof btoa === 'function') {
      return btoa(str);
    }
    return Buffer.from(str, 'utf-8').toString('base64');
  };

  const fromBase64 = (base64) => {
    if (typeof atob === 'function') {
      return atob(base64);
    }
    return Buffer.from(base64, 'base64').toString('utf-8');
  };

  const isEncrypted = (value) =>
    typeof value === 'string' && value.startsWith(MARKER);

  const encode = (envelope) => MARKER + toBase64(JSON.stringify(envelope));

  const decode = (stored) => {
    if (!isEncrypted(stored)) {
      throw new BlobDecodeError(
        '暗号化済みの値ではありません(マーカーがありません)。',
      );
    }
    const base64 = stored.slice(MARKER.length);
    let json;
    try {
      json = fromBase64(base64);
    } catch {
      throw new BlobDecodeError(
        'base64のデコードに失敗しました。データが壊れている可能性があります。',
      );
    }
    let envelope;
    try {
      envelope = JSON.parse(json);
    } catch {
      throw new BlobDecodeError(
        'JSONの解析に失敗しました。データが壊れている可能性があります。',
      );
    }
    if (!envelope || envelope.v !== 1) {
      throw new BlobDecodeError('未対応のフォーマットバージョンです。');
    }
    return envelope;
  };

  const BlobCodec = { MARKER, BlobDecodeError, isEncrypted, encode, decode };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlobCodec;
  } else {
    root.FieldEncryption = root.FieldEncryption || {};
    root.FieldEncryption.BlobCodec = BlobCodec;
  }
})(typeof window !== 'undefined' ? window : globalThis);
