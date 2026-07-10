'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validLayout = (overrides) =>
  Object.assign(
    {
      spaceElementId: 'Space_0',
      defaultTabIndex: 0,
      tabs: [
        { label: '基本情報', itemCodes: ['name'] },
        { label: '詳細情報', itemCodes: ['note'] },
      ],
    },
    overrides,
  );

describe('ConfigValidation.validateLayouts', () => {
  test('accepts an empty array', () => {
    expect(ConfigValidation.validateLayouts([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('rejects a non-array value', () => {
    expect(ConfigValidation.validateLayouts(null).valid).toBe(false);
  });

  test('accepts a well-formed layout', () => {
    expect(ConfigValidation.validateLayouts([validLayout()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('requires spaceElementId', () => {
    const result = ConfigValidation.validateLayouts([
      validLayout({ spaceElementId: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires at least one tab', () => {
    const result = ConfigValidation.validateLayouts([
      validLayout({ tabs: [] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires each tab to have a non-empty label', () => {
    const result = ConfigValidation.validateLayouts([
      validLayout({ tabs: [{ label: '', itemCodes: ['name'] }] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('accepts a tab with no assigned items', () => {
    const result = ConfigValidation.validateLayouts([
      validLayout({ tabs: [{ label: '空タブ', itemCodes: [] }] }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });
});
