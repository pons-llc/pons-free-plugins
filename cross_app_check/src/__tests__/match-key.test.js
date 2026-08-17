const MatchKey = require('../js/lib/match-key');

describe('normalizeKey', () => {
  test('文字列は前後の空白だけ落とす', () => {
    expect(MatchKey.normalizeKey('  A-001 ', 'SINGLE_LINE_TEXT')).toBe('A-001');
  });

  test('文字列フィールドでは先頭ゼロを保持する(宛名番号を壊さない)', () => {
    expect(MatchKey.normalizeKey('007', 'SINGLE_LINE_TEXT')).toBe('007');
    expect(MatchKey.normalizeKey('7', 'SINGLE_LINE_TEXT')).toBe('7');
    expect(MatchKey.normalizeKey('007', 'SINGLE_LINE_TEXT')).not.toBe(
      MatchKey.normalizeKey('7', 'SINGLE_LINE_TEXT'),
    );
  });

  test('数値フィールドでは 1 と 01 と 1.0 を同一視する', () => {
    expect(MatchKey.normalizeKey('01', 'NUMBER')).toBe('1');
    expect(MatchKey.normalizeKey('1.0', 'NUMBER')).toBe('1');
    expect(MatchKey.normalizeKey(1, 'NUMBER')).toBe('1');
  });

  test('数値フィールドに数値でない値が入っていたら空扱い', () => {
    expect(MatchKey.normalizeKey('あ', 'NUMBER')).toBe('');
  });

  test('null/undefined/空文字/空白のみは空文字を返す', () => {
    expect(MatchKey.normalizeKey(null, 'SINGLE_LINE_TEXT')).toBe('');
    expect(MatchKey.normalizeKey(undefined, 'SINGLE_LINE_TEXT')).toBe('');
    expect(MatchKey.normalizeKey('', 'SINGLE_LINE_TEXT')).toBe('');
    expect(MatchKey.normalizeKey('   ', 'SINGLE_LINE_TEXT')).toBe('');
  });

  test('配列(複数値フィールド)は突合キーにできないので空扱い', () => {
    expect(MatchKey.normalizeKey(['a', 'b'], 'CHECK_BOX')).toBe('');
  });
});

describe('extractKey', () => {
  const record = {
    宛名番号: { type: 'SINGLE_LINE_TEXT', value: ' A-001 ' },
    空欄: { type: 'SINGLE_LINE_TEXT', value: '' },
  };

  test('レコードからキーを取り出して正規化する', () => {
    expect(MatchKey.extractKey(record, '宛名番号', 'SINGLE_LINE_TEXT')).toBe(
      'A-001',
    );
  });

  test('存在しないフィールドコードは空文字', () => {
    expect(MatchKey.extractKey(record, '無い', 'SINGLE_LINE_TEXT')).toBe('');
  });

  test('レコードやフィールドコードが無くても落ちない', () => {
    expect(MatchKey.extractKey(null, '宛名番号', 'SINGLE_LINE_TEXT')).toBe('');
    expect(MatchKey.extractKey(record, '', 'SINGLE_LINE_TEXT')).toBe('');
  });
});

describe('indexRecordsByKey', () => {
  const records = [
    { $id: { value: '1' }, key: { value: 'A' } },
    { $id: { value: '2' }, key: { value: 'B' } },
    { $id: { value: '3' }, key: { value: 'A' } },
    { $id: { value: '4' }, key: { value: '' } },
  ];

  test('同じキーのレコードを配列にまとめる', () => {
    const index = MatchKey.indexRecordsByKey(
      records,
      'key',
      'SINGLE_LINE_TEXT',
    );
    expect(index.get('A')).toHaveLength(2);
    expect(index.get('B')).toHaveLength(1);
  });

  test('キーが空のレコードは索引に入れない', () => {
    const index = MatchKey.indexRecordsByKey(
      records,
      'key',
      'SINGLE_LINE_TEXT',
    );
    expect(index.has('')).toBe(false);
    expect(index.size).toBe(2);
  });

  test('レコードが無くても空のMapを返す', () => {
    expect(
      MatchKey.indexRecordsByKey(null, 'key', 'SINGLE_LINE_TEXT').size,
    ).toBe(0);
  });
});

describe('選択可能なフィールドタイプ', () => {
  test('突合キーに使えるのは単一値のフィールドだけ', () => {
    expect(MatchKey.isSelectableKeyType('SINGLE_LINE_TEXT')).toBe(true);
    expect(MatchKey.isSelectableKeyType('NUMBER')).toBe(true);
    expect(MatchKey.isSelectableKeyType('CHECK_BOX')).toBe(false);
    expect(MatchKey.isSelectableKeyType('USER_SELECT')).toBe(false);
    expect(MatchKey.isSelectableKeyType('SUBTABLE')).toBe(false);
  });

  test('提出日に使えるのは日付系のフィールド', () => {
    expect(MatchKey.isSelectableDateType('DATE')).toBe(true);
    expect(MatchKey.isSelectableDateType('DATETIME')).toBe(true);
    expect(MatchKey.isSelectableDateType('SINGLE_LINE_TEXT')).toBe(false);
  });
});
