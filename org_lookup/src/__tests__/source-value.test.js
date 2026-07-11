'use strict';

const SourceValue = require('../js/lib/source-value');

describe('SourceValue.extractOrgCode', () => {
  test('文字列1行フィールドの値をそのまま返す', () => {
    expect(
      SourceValue.extractOrgCode({ value: 'sales_dept' }, 'SINGLE_LINE_TEXT'),
    ).toBe('sales_dept');
  });

  test('文字列1行フィールドの前後の空白を除去する', () => {
    expect(
      SourceValue.extractOrgCode(
        { value: '  sales_dept  ' },
        'SINGLE_LINE_TEXT',
      ),
    ).toBe('sales_dept');
  });

  test('文字列1行フィールドが空文字列なら空文字列を返す', () => {
    expect(SourceValue.extractOrgCode({ value: '' }, 'SINGLE_LINE_TEXT')).toBe(
      '',
    );
  });

  test('組織選択フィールドは1つ目のcodeを返す', () => {
    expect(
      SourceValue.extractOrgCode(
        { value: [{ code: 'sales_dept' }, { code: 'dev_dept' }] },
        'ORGANIZATION_SELECT',
      ),
    ).toBe('sales_dept');
  });

  test('組織選択フィールドが未選択なら空文字列を返す', () => {
    expect(
      SourceValue.extractOrgCode({ value: [] }, 'ORGANIZATION_SELECT'),
    ).toBe('');
  });

  test('フィールド自体が存在しない場合は空文字列を返す', () => {
    expect(SourceValue.extractOrgCode(undefined, 'SINGLE_LINE_TEXT')).toBe('');
  });
});
