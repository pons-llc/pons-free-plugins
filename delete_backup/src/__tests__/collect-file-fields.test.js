'use strict';

const { collectFileFields } = require('../js/lib/collect-file-fields');

describe('collectFileFields', () => {
  test('FILEタイプのフィールドが無ければ空配列を返す', () => {
    const record = {
      文字列1行: { type: 'SINGLE_LINE_TEXT', value: 'テスト' },
      数値: { type: 'NUMBER', value: '1' },
    };
    expect(collectFileFields(record)).toEqual([]);
  });

  test('1つのFILEフィールド内の複数ファイルをフィールドコード付きで抽出する', () => {
    const record = {
      添付ファイル: {
        type: 'FILE',
        value: [
          {
            fileKey: 'k1',
            name: 'a.txt',
            contentType: 'text/plain',
            size: '10',
          },
          {
            fileKey: 'k2',
            name: 'b.png',
            contentType: 'image/png',
            size: '20',
          },
        ],
      },
    };
    expect(collectFileFields(record)).toEqual([
      {
        fieldCode: '添付ファイル',
        fileKey: 'k1',
        name: 'a.txt',
        contentType: 'text/plain',
        size: '10',
      },
      {
        fieldCode: '添付ファイル',
        fileKey: 'k2',
        name: 'b.png',
        contentType: 'image/png',
        size: '20',
      },
    ]);
  });

  test('複数のFILEフィールドを、レコード内のフィールド順に結合して返す', () => {
    const record = {
      添付A: {
        type: 'FILE',
        value: [
          {
            fileKey: 'k1',
            name: 'a.txt',
            contentType: 'text/plain',
            size: '1',
          },
        ],
      },
      文字列1行: { type: 'SINGLE_LINE_TEXT', value: 'x' },
      添付B: {
        type: 'FILE',
        value: [
          {
            fileKey: 'k2',
            name: 'b.txt',
            contentType: 'text/plain',
            size: '2',
          },
        ],
      },
    };
    const result = collectFileFields(record);
    expect(result.map((f) => f.fieldCode)).toEqual(['添付A', '添付B']);
    expect(result.map((f) => f.fileKey)).toEqual(['k1', 'k2']);
  });

  test('FILEフィールドの値が空配列の場合は何も追加しない', () => {
    const record = {
      添付ファイル: { type: 'FILE', value: [] },
    };
    expect(collectFileFields(record)).toEqual([]);
  });

  test('recordがnull/undefinedでも空配列を返す', () => {
    expect(collectFileFields(null)).toEqual([]);
    expect(collectFileFields(undefined)).toEqual([]);
  });
});
