(function (root) {
  'use strict';

  // ZIPファイル生成(build-zip.js)用のCRC-32実装(IEEE 802.3、ZIP仕様が要求するものと同じ多項式)。
  // 外部ライブラリを使わない方針(CLAUDE.md開発方針9)のため自前実装する。テーブル方式の標準的な実装。
  const POLYNOMIAL = 0xedb88320;

  const buildTable = () => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? (c >>> 1) ^ POLYNOMIAL : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  };

  const TABLE = buildTable();

  // bytes: Uint8Array(またはUint8Array互換のバイト列)。戻り値は符号なし32bit整数。
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const Crc32 = { crc32 };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Crc32;
  } else {
    root.NotebooklmExport = root.NotebooklmExport || {};
    root.NotebooklmExport.Crc32 = Crc32;
  }
})(typeof window !== 'undefined' ? window : globalThis);
