const ConfigValidation = require('../js/lib/config-validation');

const numberField = (code, label) => ({ code, label, type: 'NUMBER' });

const baseFormFields = {
  sales: numberField('sales', '売上'),
  profit: numberField('profit', '利益'),
  cost: numberField('cost', '原価'),
  qty: numberField('qty', '数量'),
  name: { code: 'name', label: '名前', type: 'SINGLE_LINE_TEXT' },
  category: { code: 'category', label: '区分', type: 'RADIO_BUTTON' },
  region: { code: 'region', label: '地域', type: 'DROP_DOWN' },
  memo: { code: 'memo', label: 'メモ', type: 'MULTI_LINE_TEXT' },
};

const validConfig = () => ({
  groupingType: 'record',
  groupingFieldCode: '',
  axisFieldCodes: ['sales', 'profit', 'cost'],
  scaleDivisions: 5,
  title: 'タイトル',
  badgeFieldCodes: [],
  maxRecords: 2000,
});

describe('ConfigValidation.validateConfig - axis fields', () => {
  test('accepts exactly 3 NUMBER fields', () => {
    const result = ConfigValidation.validateConfig(
      validConfig(),
      baseFormFields,
    );
    expect(result.valid).toBe(true);
  });

  test('accepts exactly 8 NUMBER fields', () => {
    const config = validConfig();
    const formFields = {
      ...baseFormFields,
      f5: numberField('f5', 'f5'),
      f6: numberField('f6', 'f6'),
      f7: numberField('f7', 'f7'),
      f8: numberField('f8', 'f8'),
    };
    config.axisFieldCodes = [
      'sales',
      'profit',
      'cost',
      'qty',
      'f5',
      'f6',
      'f7',
      'f8',
    ];
    const result = ConfigValidation.validateConfig(config, formFields);
    expect(result.valid).toBe(true);
  });

  test('rejects fewer than 3 axis fields', () => {
    const config = validConfig();
    config.axisFieldCodes = ['sales', 'profit'];
    const result = ConfigValidation.validateConfig(config, baseFormFields);
    expect(result.valid).toBe(false);
    expect(result.errors.join('')).toMatch(/3.*8/);
  });

  test('rejects more than 8 axis fields', () => {
    const config = validConfig();
    config.axisFieldCodes = Array.from({ length: 9 }, (_, i) => `f${i}`);
    const result = ConfigValidation.validateConfig(config, baseFormFields);
    expect(result.valid).toBe(false);
  });

  test('rejects duplicate axis fields', () => {
    const config = validConfig();
    config.axisFieldCodes = ['sales', 'sales', 'profit'];
    const result = ConfigValidation.validateConfig(config, baseFormFields);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('rejects axis fields that are not NUMBER type', () => {
    const config = validConfig();
    config.axisFieldCodes = ['sales', 'profit', 'name'];
    const result = ConfigValidation.validateConfig(config, baseFormFields);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('名前'))).toBe(true);
  });

  test('rejects axis fields that no longer exist on the app', () => {
    const config = validConfig();
    config.axisFieldCodes = ['sales', 'profit', 'gone'];
    const result = ConfigValidation.validateConfig(config, baseFormFields);
    expect(result.valid).toBe(false);
  });
});

describe('ConfigValidation.validateConfig - grouping', () => {
  test('grouping "record" does not require a grouping field', () => {
    const config = validConfig();
    config.groupingType = 'record';
    config.groupingFieldCode = '';
    const result = ConfigValidation.validateConfig(config, baseFormFields);
    expect(result.valid).toBe(true);
  });

  test('grouping "field" requires a grouping field to be selected', () => {
    const config = validConfig();
    config.groupingType = 'field';
    config.groupingFieldCode = '';
    const result = ConfigValidation.validateConfig(config, baseFormFields);
    expect(result.valid).toBe(false);
  });

  test('grouping "field" accepts RADIO_BUTTON or DROP_DOWN fields', () => {
    const config1 = validConfig();
    config1.groupingType = 'field';
    config1.groupingFieldCode = 'category';
    expect(ConfigValidation.validateConfig(config1, baseFormFields).valid).toBe(
      true,
    );

    const config2 = validConfig();
    config2.groupingType = 'field';
    config2.groupingFieldCode = 'region';
    expect(ConfigValidation.validateConfig(config2, baseFormFields).valid).toBe(
      true,
    );
  });

  test('grouping "field" rejects a field that is neither RADIO_BUTTON nor DROP_DOWN', () => {
    const config = validConfig();
    config.groupingType = 'field';
    config.groupingFieldCode = 'name';
    const result = ConfigValidation.validateConfig(config, baseFormFields);
    expect(result.valid).toBe(false);
  });
});

describe('ConfigValidation.validateConfig - scale divisions', () => {
  test.each([2, 5, 10])('accepts %i', (n) => {
    const config = validConfig();
    config.scaleDivisions = n;
    expect(ConfigValidation.validateConfig(config, baseFormFields).valid).toBe(
      true,
    );
  });

  test.each([1, 11, 0, -1])('rejects %i', (n) => {
    const config = validConfig();
    config.scaleDivisions = n;
    expect(ConfigValidation.validateConfig(config, baseFormFields).valid).toBe(
      false,
    );
  });

  test('rejects a non-integer', () => {
    const config = validConfig();
    config.scaleDivisions = 5.5;
    expect(ConfigValidation.validateConfig(config, baseFormFields).valid).toBe(
      false,
    );
  });
});

describe('ConfigValidation.validateConfig - max records', () => {
  test('accepts a positive integer', () => {
    const config = validConfig();
    config.maxRecords = 1;
    expect(ConfigValidation.validateConfig(config, baseFormFields).valid).toBe(
      true,
    );
  });

  test('rejects zero or negative', () => {
    const config = validConfig();
    config.maxRecords = 0;
    expect(ConfigValidation.validateConfig(config, baseFormFields).valid).toBe(
      false,
    );
  });
});
