const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns an empty viewConfigs array when nothing has been saved yet (getConfig() returned null)', () => {
    const config = ConfigStore.load(null);
    expect(config.viewConfigs).toEqual([]);
  });

  test('also tolerates undefined (defensive, matches kintone.plugin.app.getConfig() edge cases)', () => {
    const config = ConfigStore.load(undefined);
    expect(config.viewConfigs).toEqual([]);
  });

  test('parses a previously saved viewConfigs JSON string back into an array', () => {
    const saved = {
      viewConfigs: JSON.stringify([
        {
          viewId: 'ALL',
          viewName: 'すべて(デフォルト)',
          startFieldCode: 'start_date',
          endFieldCode: 'end_date',
          barFieldCodes: ['title'],
          colorFieldCode: 'status',
          groupFieldCode: 'assignee',
          allowedGroupFieldCodes: ['assignee', 'status'],
          enableFullFetch: true,
          maxRecords: 1000,
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.viewConfigs).toHaveLength(1);
    expect(config.viewConfigs[0].startFieldCode).toBe('start_date');
    expect(config.viewConfigs[0].maxRecords).toBe(1000);
  });

  test('falls back to an empty array when the saved JSON is corrupt, instead of throwing', () => {
    const config = ConfigStore.load({ viewConfigs: 'not valid json' });
    expect(config.viewConfigs).toEqual([]);
  });

  test('individual view configs get sane defaults for any missing keys (forward-compat with older saves)', () => {
    const saved = { viewConfigs: JSON.stringify([{ viewId: 'ALL' }]) };
    const config = ConfigStore.load(saved);
    expect(config.viewConfigs[0]).toMatchObject({
      viewId: 'ALL',
      startFieldCode: '',
      endFieldCode: '',
      barFieldCodes: [],
      colorFieldCode: '',
      groupFieldCode: '',
      allowedGroupFieldCodes: [],
      enableFullFetch: true,
      maxRecords: ConfigStore.DEFAULT_MAX_RECORDS,
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('round-trips through load/serialize without losing data', () => {
    const original = {
      viewConfigs: [
        {
          viewId: '1102',
          viewName: '一覧1',
          startFieldCode: 'start_date',
          endFieldCode: 'end_date',
          barFieldCodes: ['title', 'assignee'],
          colorFieldCode: 'status',
          groupFieldCode: 'assignee',
          allowedGroupFieldCodes: ['assignee'],
          enableFullFetch: false,
          maxRecords: 500,
        },
      ],
    };
    const serialized = ConfigStore.serialize(original);
    const reloaded = ConfigStore.load(serialized);
    expect(reloaded).toEqual(original);
  });

  test('serialized values are all strings (a setConfig() requirement)', () => {
    const serialized = ConfigStore.serialize({
      viewConfigs: [{ viewId: 'ALL' }],
    });
    Object.values(serialized).forEach((value) => {
      expect(typeof value).toBe('string');
    });
  });
});

describe('ConfigStore.DEFAULT_MAX_RECORDS', () => {
  test('defaults to 2000 per plugin_idea_plan.md', () => {
    expect(ConfigStore.DEFAULT_MAX_RECORDS).toBe(2000);
  });
});
