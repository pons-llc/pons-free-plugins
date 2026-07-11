'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validRow = () => ({
  sourceFieldCode: 'org_code',
  trigger: 'SUBMIT',
  buttonSpaceElementId: '',
  outputEditable: false,
  mappings: [{ attribute: 'name', destinationFieldCode: 'out_name' }],
});

describe('ConfigValidation.validateRows', () => {
  test('配列でなければ即エラー', () => {
    const result = ConfigValidation.validateRows(null);
    expect(result.valid).toBe(false);
  });

  test('空配列は有効(設定行が無いだけ)', () => {
    expect(ConfigValidation.validateRows([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('妥当な1行(SUBMIT)は有効', () => {
    expect(ConfigValidation.validateRows([validRow()]).valid).toBe(true);
  });

  test('元フィールド未選択はエラー', () => {
    const row = { ...validRow(), sourceFieldCode: '' };
    const result = ConfigValidation.validateRows([row]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('元フィールド'))).toBe(true);
  });

  test('発動条件がBUTTONなのにスペース未選択はエラー', () => {
    const row = { ...validRow(), trigger: 'BUTTON', buttonSpaceElementId: '' };
    const result = ConfigValidation.validateRows([row]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('スペース'))).toBe(true);
  });

  test('発動条件がBUTTONでスペース選択済みなら有効', () => {
    const row = {
      ...validRow(),
      trigger: 'BUTTON',
      buttonSpaceElementId: 'space_1',
    };
    expect(ConfigValidation.validateRows([row]).valid).toBe(true);
  });

  test('転記項目が0件はエラー', () => {
    const row = { ...validRow(), mappings: [] };
    const result = ConfigValidation.validateRows([row]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('転記項目'))).toBe(true);
  });

  test('不正な属性キーはエラー', () => {
    const row = {
      ...validRow(),
      mappings: [{ attribute: 'unknown', destinationFieldCode: 'out_x' }],
    };
    expect(ConfigValidation.validateRows([row]).valid).toBe(false);
  });

  test('出力先フィールド未選択はエラー', () => {
    const row = {
      ...validRow(),
      mappings: [{ attribute: 'name', destinationFieldCode: '' }],
    };
    expect(ConfigValidation.validateRows([row]).valid).toBe(false);
  });

  test('出力先フィールドが元フィールドと同じならエラー', () => {
    const row = {
      ...validRow(),
      mappings: [{ attribute: 'name', destinationFieldCode: 'org_code' }],
    };
    expect(ConfigValidation.validateRows([row]).valid).toBe(false);
  });

  test('出力先フィールドが複数行で重複していればエラー', () => {
    const rowA = validRow();
    const rowB = {
      ...validRow(),
      mappings: [
        { attribute: 'description', destinationFieldCode: 'out_name' },
      ],
    };
    const result = ConfigValidation.validateRows([rowA, rowB]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('ボタン設置スペースが複数行で重複していればエラー', () => {
    const rowA = {
      ...validRow(),
      trigger: 'BUTTON',
      buttonSpaceElementId: 'space_1',
      mappings: [{ attribute: 'name', destinationFieldCode: 'out_name' }],
    };
    const rowB = {
      ...validRow(),
      trigger: 'BUTTON',
      buttonSpaceElementId: 'space_1',
      mappings: [
        { attribute: 'description', destinationFieldCode: 'out_desc' },
      ],
    };
    const result = ConfigValidation.validateRows([rowA, rowB]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('ボタン設置スペース'))).toBe(
      true,
    );
  });

  test('fieldInfoByCodeを渡すと元フィールドの型を検証する', () => {
    const row = validRow();
    const fieldInfoByCode = { org_code: { type: 'NUMBER' } };
    const result = ConfigValidation.validateRows([row], fieldInfoByCode);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('元フィールドは'))).toBe(true);
  });

  test('fieldInfoByCodeを渡すと出力先フィールドの型を検証する', () => {
    const row = validRow();
    const fieldInfoByCode = {
      org_code: { type: 'SINGLE_LINE_TEXT' },
      out_name: { type: 'NUMBER' },
    };
    const result = ConfigValidation.validateRows([row], fieldInfoByCode);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('出力先フィールドは'))).toBe(
      true,
    );
  });
});
