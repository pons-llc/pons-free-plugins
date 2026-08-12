const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns an empty viewConfigs array when getConfig() returns null', () => {
    expect(ConfigStore.load(null)).toEqual({ viewConfigs: [] });
  });

  test('returns an empty viewConfigs array when saved.viewConfigs is missing', () => {
    expect(ConfigStore.load({})).toEqual({ viewConfigs: [] });
  });

  test('returns an empty array when the saved JSON is malformed', () => {
    expect(ConfigStore.load({ viewConfigs: '{not valid json' })).toEqual({
      viewConfigs: [],
    });
  });

  test('parses saved JSON and fills in missing keys with defaults', () => {
    const saved = {
      viewConfigs: JSON.stringify([{ viewId: '5', titleFieldCode: 'title' }]),
    };
    const result = ConfigStore.load(saved);
    expect(result.viewConfigs).toHaveLength(1);
    expect(result.viewConfigs[0]).toMatchObject({
      viewId: '5',
      titleFieldCode: 'title',
      startFieldCode: '',
      defaultViewUnit: 'week',
      layoutDirection: 'vertical',
      enableDragDrop: false,
      hoverFieldCodes: [],
    });
  });

  test('normalizes an empty/missing viewId to "ALL"', () => {
    const saved = { viewConfigs: JSON.stringify([{ viewId: '' }, {}]) };
    const result = ConfigStore.load(saved);
    expect(result.viewConfigs[0].viewId).toBe('ALL');
    expect(result.viewConfigs[1].viewId).toBe('ALL');
  });
});

describe('ConfigStore.serialize', () => {
  test('round-trips through load()', () => {
    const original = {
      viewConfigs: [
        {
          viewId: 'ALL',
          viewName: '',
          titleFieldCode: 'title',
          startFieldCode: 'start',
          endFieldCode: '',
          groupFieldCode: '',
          hoverFieldCodes: ['memo'],
          defaultViewUnit: 'day',
          layoutDirection: 'horizontal',
          enableDragDrop: true,
        },
      ],
    };
    const serialized = ConfigStore.serialize(original);
    expect(typeof serialized.viewConfigs).toBe('string');
    const reloaded = ConfigStore.load(serialized);
    expect(reloaded).toEqual(original);
  });
});
