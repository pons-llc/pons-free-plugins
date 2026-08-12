const {
  validateViewConfig,
  validateViewConfigs,
} = require('../js/lib/config-validation');

describe('validateViewConfig', () => {
  test('valid when title and start fields are set', () => {
    const result = validateViewConfig({
      titleFieldCode: 'title',
      startFieldCode: 'start',
    });
    expect(result.valid).toBe(true);
  });

  test('invalid when titleFieldCode is missing', () => {
    const result = validateViewConfig({ startFieldCode: 'start' });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/タイトル/);
  });

  test('invalid when startFieldCode is missing', () => {
    const result = validateViewConfig({ titleFieldCode: 'title' });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/開始日時/);
  });

  test('invalid when start and end fields are the same', () => {
    const result = validateViewConfig({
      titleFieldCode: 'title',
      startFieldCode: 'd1',
      endFieldCode: 'd1',
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateViewConfigs', () => {
  test('flags duplicate viewIds', () => {
    const result = validateViewConfigs([
      { viewId: 'ALL', titleFieldCode: 't', startFieldCode: 's' },
      { viewId: 'ALL', titleFieldCode: 't', startFieldCode: 's' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/重複/);
  });

  test('valid for a well-formed list of distinct views', () => {
    const result = validateViewConfigs([
      { viewId: 'ALL', titleFieldCode: 't', startFieldCode: 's' },
      { viewId: '5', titleFieldCode: 't', startFieldCode: 's' },
    ]);
    expect(result.valid).toBe(true);
  });

  test('valid for an empty list', () => {
    expect(validateViewConfigs([])).toEqual({ valid: true, errors: [] });
  });
});
