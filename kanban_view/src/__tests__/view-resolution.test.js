const { resolveViewConfig } = require('../js/lib/view-resolution');

const viewConfigs = [
  { viewId: 'ALL', label: 'default' },
  { viewId: '123', label: 'specific' },
];

describe('resolveViewConfig', () => {
  test('returns the exact match when event.viewId matches a configured view', () => {
    expect(resolveViewConfig('123', viewConfigs).label).toBe('specific');
  });

  test('falls back to the ALL config when no exact match is found', () => {
    expect(resolveViewConfig('999', viewConfigs).label).toBe('default');
  });

  test('treats a null/undefined viewId as ALL', () => {
    expect(resolveViewConfig(undefined, viewConfigs).label).toBe('default');
  });

  test('coerces a numeric viewId to string before comparing', () => {
    expect(resolveViewConfig(123, viewConfigs).label).toBe('specific');
  });

  test('returns null when there is no exact match and no ALL fallback configured', () => {
    expect(resolveViewConfig('999', [{ viewId: '123' }])).toBeNull();
  });
});
