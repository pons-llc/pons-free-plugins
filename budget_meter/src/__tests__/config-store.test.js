const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns default values (empty rows, no allowed groups) when nothing is saved', () => {
    expect(ConfigStore.load(null)).toEqual({
      rows: [],
      allViewsGroupCodes: [],
    });
  });

  test('does not throw when getConfig() returns undefined', () => {
    expect(() => ConfigStore.load(undefined)).not.toThrow();
  });

  test('parses JSON-encoded rows and allViewsGroupCodes from the saved payload', () => {
    const saved = {
      rows: JSON.stringify([
        {
          viewId: '1102',
          viewName: '一覧1',
          targetFieldCode: '金額',
          budget: 100000,
          warningThresholdPct: 80,
          dangerThresholdPct: 100,
          label: '',
        },
      ]),
      allViewsGroupCodes: JSON.stringify(['kanri_group', 'admins']),
    };
    const config = ConfigStore.load(saved);
    expect(config.rows).toHaveLength(1);
    expect(config.rows[0].viewId).toBe('1102');
    expect(config.rows[0].budget).toBe(100000);
    expect(config.allViewsGroupCodes).toEqual(['kanri_group', 'admins']);
  });

  test('falls back to defaults when the saved JSON is malformed', () => {
    const config = ConfigStore.load({
      rows: '{not valid json',
      allViewsGroupCodes: 'also not valid',
    });
    expect(config.rows).toEqual([]);
    expect(config.allViewsGroupCodes).toEqual([]);
  });
});

describe('ConfigStore.serialize', () => {
  test('JSON-encodes rows and allViewsGroupCodes', () => {
    const config = {
      rows: [
        {
          viewId: '1102',
          viewName: '一覧1',
          targetFieldCode: '金額',
          budget: 100000,
          warningThresholdPct: 80,
          dangerThresholdPct: 100,
          label: '',
        },
      ],
      allViewsGroupCodes: ['admins'],
    };
    const serialized = ConfigStore.serialize(config);
    expect(JSON.parse(serialized.rows)).toEqual(config.rows);
    expect(JSON.parse(serialized.allViewsGroupCodes)).toEqual(['admins']);
  });

  test('round-trips through load after serialize', () => {
    const config = {
      rows: [
        {
          viewId: '1102',
          viewName: '一覧1',
          targetFieldCode: '金額',
          budget: 50000,
          warningThresholdPct: 70,
          dangerThresholdPct: 90,
          label: '費目A予算',
        },
      ],
      allViewsGroupCodes: ['g1', 'g2'],
    };
    expect(ConfigStore.load(ConfigStore.serialize(config))).toEqual(config);
  });
});
