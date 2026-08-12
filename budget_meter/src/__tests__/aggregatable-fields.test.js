'use strict';

const {
  isAggregatableField,
  filterAggregatableFields,
} = require('../js/lib/aggregatable-fields');

describe('isAggregatableField', () => {
  test('NUMBERフィールドは対象になる', () => {
    expect(isAggregatableField({ type: 'NUMBER', code: 'n' })).toBe(true);
  });

  test('表示書式が数値のCALCフィールドは対象になる', () => {
    expect(
      isAggregatableField({ type: 'CALC', code: 'c', format: 'NUMBER' }),
    ).toBe(true);
  });

  test('表示書式が数値(カンマ区切り)のCALCフィールドは対象になる', () => {
    expect(
      isAggregatableField({ type: 'CALC', code: 'c', format: 'NUMBER_DIGIT' }),
    ).toBe(true);
  });

  test.each(['DATETIME', 'DATE', 'TIME', 'HOUR_MINUTE', 'DAY_HOUR_MINUTE'])(
    '表示書式が%sのCALCフィールドは対象外になる',
    (format) => {
      expect(isAggregatableField({ type: 'CALC', code: 'c', format })).toBe(
        false,
      );
    },
  );

  test('NUMBER/CALC以外のフィールドは対象外になる', () => {
    expect(isAggregatableField({ type: 'SINGLE_LINE_TEXT', code: 's' })).toBe(
      false,
    );
    expect(isAggregatableField({ type: 'REFERENCE_TABLE', code: 'r' })).toBe(
      false,
    );
  });

  test('未定義・nullは対象外になる', () => {
    expect(isAggregatableField(undefined)).toBe(false);
    expect(isAggregatableField(null)).toBe(false);
  });
});

describe('filterAggregatableFields', () => {
  test('配列から対象フィールドのみ抽出する', () => {
    const fields = [
      { type: 'NUMBER', code: 'n' },
      { type: 'CALC', code: 'c1', format: 'NUMBER' },
      { type: 'CALC', code: 'c2', format: 'DATE' },
      { type: 'SINGLE_LINE_TEXT', code: 's' },
    ];
    expect(filterAggregatableFields(fields)).toEqual([
      { type: 'NUMBER', code: 'n' },
      { type: 'CALC', code: 'c1', format: 'NUMBER' },
    ]);
  });

  test('未定義は空配列を返す', () => {
    expect(filterAggregatableFields(undefined)).toEqual([]);
  });
});
