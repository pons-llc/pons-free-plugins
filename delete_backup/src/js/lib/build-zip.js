(function (root) {
  'use strict';

  // ZIPファイルを自前生成する(外部ライブラリを使わない方針、CLAUDE.md開発方針9)。
  // 圧縮アルゴリズム(DEFLATE)は実装せず、格納(STORE、無圧縮)方式のみに対応する
  // (削除バックアップという小〜中規模データ用途であり、正確性を優先してDEFLATE実装を避けた)。
  const Crc32 =
    typeof module !== 'undefined' && module.exports
      ? require('./crc32')
      : root.DeleteBackup.Crc32;

  const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
  const CENTRAL_DIR_HEADER_SIGNATURE = 0x02014b50;
  const EOCD_SIGNATURE = 0x06054b50;
  // 汎用フラグ bit 11 (0x0800): ファイル名をUTF-8として扱う(Language Encoding Flag / EFS)。
  const UTF8_FLAG = 0x0800;
  const VERSION = 20; // 2.0(格納方式のみで十分な最小バージョン)

  const encodeUtf8 = (str) => new TextEncoder().encode(str);

  const concatUint8Arrays = (parts) => {
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    parts.forEach((p) => {
      result.set(p, offset);
      offset += p.length;
    });
    return result;
  };

  // MS-DOS形式の日付・時刻(ZIP仕様が要求する形式)に変換する。
  const toDosDateTime = (date) => {
    const dosTime =
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((date.getSeconds() >> 1) & 0x1f);
    const dosDate =
      (((date.getFullYear() - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0xf) << 5) |
      (date.getDate() & 0x1f);
    return { dosTime, dosDate };
  };

  const uint16le = (value) => {
    const buf = new Uint8Array(2);
    new DataView(buf.buffer).setUint16(0, value, true);
    return buf;
  };

  const uint32le = (value) => {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, value, true);
    return buf;
  };

  // entries: [{ name: string, data: Uint8Array }]
  // opts.date: 全エントリーに使う更新日時(省略時は生成時点のnew Date())
  const buildZip = (entries, opts) => {
    const date = (opts && opts.date) || new Date();
    const { dosTime, dosDate } = toDosDateTime(date);

    const localParts = [];
    const centralParts = [];
    let offset = 0;

    entries.forEach((entry) => {
      const nameBytes = encodeUtf8(entry.name);
      const data = entry.data;
      const crc = Crc32.crc32(data);
      const localHeaderOffset = offset;

      const localHeader = concatUint8Arrays([
        uint32le(LOCAL_FILE_HEADER_SIGNATURE),
        uint16le(VERSION),
        uint16le(UTF8_FLAG),
        uint16le(0), // compression method: store
        uint16le(dosTime),
        uint16le(dosDate),
        uint32le(crc),
        uint32le(data.length), // compressed size == uncompressed size(store)
        uint32le(data.length),
        uint16le(nameBytes.length),
        uint16le(0), // extra field length
        nameBytes,
      ]);
      localParts.push(localHeader, data);
      offset += localHeader.length + data.length;

      const centralHeader = concatUint8Arrays([
        uint32le(CENTRAL_DIR_HEADER_SIGNATURE),
        uint16le(VERSION), // version made by
        uint16le(VERSION), // version needed to extract
        uint16le(UTF8_FLAG),
        uint16le(0), // compression method: store
        uint16le(dosTime),
        uint16le(dosDate),
        uint32le(crc),
        uint32le(data.length),
        uint32le(data.length),
        uint16le(nameBytes.length),
        uint16le(0), // extra field length
        uint16le(0), // comment length
        uint16le(0), // disk number start
        uint16le(0), // internal file attributes
        uint32le(0), // external file attributes
        uint32le(localHeaderOffset),
        nameBytes,
      ]);
      centralParts.push(centralHeader);
    });

    const centralDirOffset = offset;
    const centralDir = concatUint8Arrays(centralParts);
    const centralDirSize = centralDir.length;

    const eocd = concatUint8Arrays([
      uint32le(EOCD_SIGNATURE),
      uint16le(0), // disk number
      uint16le(0), // disk where central directory starts
      uint16le(entries.length), // entries on this disk
      uint16le(entries.length), // total entries
      uint32le(centralDirSize),
      uint32le(centralDirOffset),
      uint16le(0), // comment length
    ]);

    return concatUint8Arrays([...localParts, centralDir, eocd]);
  };

  const BuildZip = { buildZip };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BuildZip;
  } else {
    root.DeleteBackup = root.DeleteBackup || {};
    root.DeleteBackup.BuildZip = BuildZip;
  }
})(typeof window !== 'undefined' ? window : globalThis);
