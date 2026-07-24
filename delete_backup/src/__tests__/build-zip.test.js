'use strict';

const { buildZip } = require('../js/lib/build-zip');
const { crc32 } = require('../js/lib/crc32');

const toBytes = (str) => new Uint8Array(Buffer.from(str, 'utf8'));

// テスト用の最小限のZIPパーサー(中央ディレクトリ経由でエントリーを読み出す)。
// build-zip.jsが生成したバイト列が正しいZIP構造になっているかを、外部ライブラリを使わずに
// 自前で検証するためのテストヘルパー。
const parseZip = (bytes) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // EOCD (End Of Central Directory) をバイト列の末尾から探す。
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  expect(eocdOffset).toBeGreaterThanOrEqual(0);

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirSize = view.getUint32(eocdOffset + 12, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  expect(centralDirOffset + centralDirSize).toBe(eocdOffset);

  const entries = [];
  let ptr = centralDirOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    expect(view.getUint32(ptr, true)).toBe(0x02014b50);
    const crc = view.getUint32(ptr + 16, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const uncompressedSize = view.getUint32(ptr + 24, true);
    const nameLength = view.getUint16(ptr + 28, true);
    const extraLength = view.getUint16(ptr + 30, true);
    const commentLength = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);
    const nameStart = ptr + 46;
    const name = Buffer.from(
      bytes.buffer,
      bytes.byteOffset + nameStart,
      nameLength,
    ).toString('utf8');

    // ローカルファイルヘッダー側も突き合わせる。
    expect(view.getUint32(localHeaderOffset, true)).toBe(0x04034b50);
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart =
      localHeaderOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataStart, dataStart + compressedSize);

    entries.push({ name, crc, compressedSize, uncompressedSize, data });
    ptr = nameStart + nameLength + extraLength + commentLength;
  }
  expect(ptr).toBe(centralDirOffset + centralDirSize);

  return { totalEntries, entries };
};

describe('buildZip', () => {
  test('エントリー0件でもEOCDのみの有効なZIPを生成する', () => {
    const zip = buildZip([]);
    const parsed = parseZip(zip);
    expect(parsed.totalEntries).toBe(0);
    expect(parsed.entries).toEqual([]);
  });

  test('複数エントリーを格納(無圧縮)し、名前・CRC・サイズ・データが復元できる', () => {
    const entries = [
      { name: 'record.json', data: toBytes('{"a":1}') },
      { name: 'files/添付ファイル/日本語.txt', data: toBytes('こんにちは') },
    ];
    const zip = buildZip(entries, { date: new Date('2026-07-24T10:00:00Z') });
    const parsed = parseZip(zip);

    expect(parsed.totalEntries).toBe(2);
    expect(parsed.entries.map((e) => e.name)).toEqual([
      'record.json',
      'files/添付ファイル/日本語.txt',
    ]);
    parsed.entries.forEach((entry, i) => {
      expect(entry.crc).toBe(crc32(entries[i].data));
      expect(entry.uncompressedSize).toBe(entries[i].data.length);
      expect(entry.compressedSize).toBe(entries[i].data.length);
      expect(new Uint8Array(entry.data)).toEqual(entries[i].data);
    });
  });

  test('バイナリデータ(テキストでないファイル)もそのまま格納できる', () => {
    const data = new Uint8Array([0, 1, 2, 255, 254, 253, 128]);
    const zip = buildZip([{ name: 'files/x/binary.bin', data }]);
    const parsed = parseZip(zip);
    expect(new Uint8Array(parsed.entries[0].data)).toEqual(data);
  });
});
