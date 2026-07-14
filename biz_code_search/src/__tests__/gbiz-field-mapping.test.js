'use strict';

const { buildFieldValues } = require('../js/lib/gbiz-field-mapping');

describe('buildFieldValues', () => {
  const mappings = [
    { attribute: 'name', targetFieldCode: 'target_name' },
    { attribute: 'representative_name', targetFieldCode: 'target_rep' },
    { attribute: 'capital_stock', targetFieldCode: 'target_capital' },
  ];

  test('法人情報がある場合、各属性の値を出力先フィールドへマッピングする', () => {
    const hojinInfo = {
      name: 'サイボウズ株式会社',
      representative_name: '山田太郎',
      capital_stock: 100000000,
    };
    expect(buildFieldValues(hojinInfo, mappings)).toEqual({
      target_name: 'サイボウズ株式会社',
      target_rep: '山田太郎',
      target_capital: '100000000',
    });
  });

  test('法人情報がnullの場合、すべて空文字列にする', () => {
    expect(buildFieldValues(null, mappings)).toEqual({
      target_name: '',
      target_rep: '',
      target_capital: '',
    });
  });

  test('該当属性の値がnull/undefinedの場合は空文字列にする', () => {
    const hojinInfo = { name: 'テスト株式会社' };
    expect(buildFieldValues(hojinInfo, mappings)).toEqual({
      target_name: 'テスト株式会社',
      target_rep: '',
      target_capital: '',
    });
  });

  test('数値0は空文字列にせず"0"として扱う', () => {
    const hojinInfo = { capital_stock: 0 };
    expect(buildFieldValues(hojinInfo, mappings)).toEqual({
      target_name: '',
      target_rep: '',
      target_capital: '0',
    });
  });

  test('mappingsが空配列の場合は空オブジェクトを返す', () => {
    expect(buildFieldValues({ name: 'x' }, [])).toEqual({});
  });

  test('targetFieldCodeが無いmappingは無視する', () => {
    const brokenMappings = [{ attribute: 'name', targetFieldCode: '' }];
    expect(buildFieldValues({ name: 'x' }, brokenMappings)).toEqual({});
  });
});
