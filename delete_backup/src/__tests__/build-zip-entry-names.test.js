'use strict';

const { buildZipEntryNames } = require('../js/lib/build-zip-entry-names');

describe('buildZipEntryNames', () => {
  test('フィールドコードごとのディレクトリにファイル名をそのまま割り当てる', () => {
    const files = [
      { fieldCode: '添付ファイル', name: 'a.txt' },
      { fieldCode: '添付ファイル', name: 'b.png' },
    ];
    const result = buildZipEntryNames(files);
    expect(result.map((f) => f.entryName)).toEqual([
      'files/添付ファイル/a.txt',
      'files/添付ファイル/b.png',
    ]);
    // 元のプロパティ(fieldCode等)も保持する。
    expect(result[0].fieldCode).toBe('添付ファイル');
  });

  test('同一フィールド内でファイル名が重複した場合は連番を付けて回避する', () => {
    const files = [
      { fieldCode: '添付ファイル', name: 'a.txt' },
      { fieldCode: '添付ファイル', name: 'a.txt' },
      { fieldCode: '添付ファイル', name: 'a.txt' },
    ];
    const result = buildZipEntryNames(files);
    expect(result.map((f) => f.entryName)).toEqual([
      'files/添付ファイル/a.txt',
      'files/添付ファイル/a (2).txt',
      'files/添付ファイル/a (3).txt',
    ]);
  });

  test('拡張子が無いファイル名でも連番を末尾に付けられる', () => {
    const files = [
      { fieldCode: '添付ファイル', name: 'README' },
      { fieldCode: '添付ファイル', name: 'README' },
    ];
    const result = buildZipEntryNames(files);
    expect(result.map((f) => f.entryName)).toEqual([
      'files/添付ファイル/README',
      'files/添付ファイル/README (2)',
    ]);
  });

  test('異なるフィールドコードなら同じファイル名でも衝突しない', () => {
    const files = [
      { fieldCode: '添付A', name: 'a.txt' },
      { fieldCode: '添付B', name: 'a.txt' },
    ];
    const result = buildZipEntryNames(files);
    expect(result.map((f) => f.entryName)).toEqual([
      'files/添付A/a.txt',
      'files/添付B/a.txt',
    ]);
  });

  test('空配列を渡すと空配列を返す', () => {
    expect(buildZipEntryNames([])).toEqual([]);
  });
});
