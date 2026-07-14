'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validLookup = (overrides) =>
  Object.assign(
    {
      corporateNumberFieldCode: 'corporate_number',
      companyNameFieldCode: 'company_name',
      numberButtonSpaceElementId: 'space_number',
      nameButtonSpaceElementId: 'space_name',
      fieldMappings: [{ attribute: 'name', targetFieldCode: 'name_output' }],
    },
    overrides,
  );

describe('ConfigValidation.validateLookups', () => {
  test('空配列は許可する', () => {
    expect(ConfigValidation.validateLookups([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('配列でない値は拒否する', () => {
    expect(ConfigValidation.validateLookups(null).valid).toBe(false);
  });

  test('正しく設定された設定行を許可する', () => {
    expect(ConfigValidation.validateLookups([validLookup()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('法人番号フィールド・法人名フィールドは必須', () => {
    expect(
      ConfigValidation.validateLookups([
        validLookup({ corporateNumberFieldCode: '' }),
      ]).valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateLookups([
        validLookup({ companyNameFieldCode: '' }),
      ]).valid,
    ).toBe(false);
  });

  test('ボタン設置スペース(2種類とも)は必須', () => {
    expect(
      ConfigValidation.validateLookups([
        validLookup({ numberButtonSpaceElementId: '' }),
      ]).valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateLookups([
        validLookup({ nameButtonSpaceElementId: '' }),
      ]).valid,
    ).toBe(false);
  });

  test('同一設定行内でボタン設置スペースが重複していれば拒否する', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        numberButtonSpaceElementId: 'space_same',
        nameButtonSpaceElementId: 'space_same',
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('異なる設定行間でボタン設置スペースが重複していれば拒否する', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ numberButtonSpaceElementId: 'space_1' }),
      validLookup({
        corporateNumberFieldCode: 'corporate_number2',
        companyNameFieldCode: 'company_name2',
        numberButtonSpaceElementId: 'space_1',
        nameButtonSpaceElementId: 'space_name2',
        fieldMappings: [
          { attribute: 'representative_name', targetFieldCode: 'rep2' },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('異なる設定行間で別々のボタン設置スペースなら許可する', () => {
    const result = ConfigValidation.validateLookups([
      validLookup(),
      validLookup({
        corporateNumberFieldCode: 'corporate_number2',
        companyNameFieldCode: 'company_name2',
        numberButtonSpaceElementId: 'space_number2',
        nameButtonSpaceElementId: 'space_name2',
        fieldMappings: [
          { attribute: 'representative_name', targetFieldCode: 'rep2' },
        ],
      }),
    ]);
    expect(result.valid).toBe(true);
  });

  test('フィールドマッピングが1件も無い場合は拒否する', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ fieldMappings: [] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('フィールドマッピングは属性・出力先フィールドの両方が必要', () => {
    expect(
      ConfigValidation.validateLookups([
        validLookup({
          fieldMappings: [{ attribute: '', targetFieldCode: 'name_output' }],
        }),
      ]).valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateLookups([
        validLookup({
          fieldMappings: [{ attribute: 'name', targetFieldCode: '' }],
        }),
      ]).valid,
    ).toBe(false);
  });

  test('未知の属性キーは拒否する', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        fieldMappings: [
          { attribute: 'unknown_attr', targetFieldCode: 'name_output' },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('出力先フィールドが複数マッピング間で重複していれば拒否する', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        fieldMappings: [
          { attribute: 'name', targetFieldCode: 'dup' },
          { attribute: 'kana', targetFieldCode: 'dup' },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('異なる設定行間でも出力先フィールドが重複していれば拒否する', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        fieldMappings: [{ attribute: 'name', targetFieldCode: 'dup' }],
      }),
      validLookup({
        corporateNumberFieldCode: 'corporate_number2',
        companyNameFieldCode: 'company_name2',
        numberButtonSpaceElementId: 'space_number2',
        nameButtonSpaceElementId: 'space_name2',
        fieldMappings: [{ attribute: 'kana', targetFieldCode: 'dup' }],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('出力先フィールドが法人番号フィールドと重複していれば拒否する', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        fieldMappings: [
          { attribute: 'name', targetFieldCode: 'corporate_number' },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('出力先フィールドが法人名フィールドと重複していれば拒否する', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        fieldMappings: [{ attribute: 'name', targetFieldCode: 'company_name' }],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  describe('fieldInfoByCodeによる型チェック', () => {
    test('文字列(1行)フィールドは許可する', () => {
      const result = ConfigValidation.validateLookups([validLookup()], {
        corporate_number: { type: 'SINGLE_LINE_TEXT' },
        company_name: { type: 'SINGLE_LINE_TEXT' },
        name_output: { type: 'SINGLE_LINE_TEXT' },
      });
      expect(result.valid).toBe(true);
    });

    test('法人番号フィールドが文字列(1行)以外なら拒否する', () => {
      const result = ConfigValidation.validateLookups([validLookup()], {
        corporate_number: { type: 'NUMBER' },
      });
      expect(result.valid).toBe(false);
    });

    test('法人名フィールドが文字列(1行)以外なら拒否する', () => {
      const result = ConfigValidation.validateLookups([validLookup()], {
        company_name: { type: 'NUMBER' },
      });
      expect(result.valid).toBe(false);
    });

    test('出力先フィールドが文字列(1行)以外なら拒否する', () => {
      const result = ConfigValidation.validateLookups([validLookup()], {
        name_output: { type: 'NUMBER' },
      });
      expect(result.valid).toBe(false);
    });

    test('fieldInfoByCodeが無い場合は型チェックをスキップする', () => {
      const result = ConfigValidation.validateLookups([validLookup()]);
      expect(result.valid).toBe(true);
    });
  });
});
