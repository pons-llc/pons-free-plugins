'use strict';

const { crc32 } = require('../js/lib/crc32');

const toBytes = (str) => new Uint8Array(Buffer.from(str, 'utf8'));

describe('crc32', () => {
  test('標準チェック値("123456789" -> 0xCBF43926)と一致する', () => {
    expect(crc32(toBytes('123456789'))).toBe(0xcbf43926);
  });

  test('空バイト列は0を返す', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  test('内容が違えば異なる値になる', () => {
    expect(crc32(toBytes('abc'))).not.toBe(crc32(toBytes('abd')));
  });

  test('同じ内容なら常に同じ値になる(決定的)', () => {
    expect(crc32(toBytes('テスト'))).toBe(crc32(toBytes('テスト')));
  });
});
