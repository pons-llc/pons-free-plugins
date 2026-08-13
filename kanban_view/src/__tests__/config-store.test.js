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
      groupMode: 'FIELD',
      groupFieldCode: '',
      assigneeMode: 'USER_FIELD',
      assigneeFieldCode: '',
      dueFieldCode: '',
      badgeFieldCode: '',
      hoverFieldCodes: [],
    });
  });

  test('normalizes an empty/missing viewId to "ALL"', () => {
    const saved = { viewConfigs: JSON.stringify([{ viewId: '' }, {}]) };
    const result = ConfigStore.load(saved);
    expect(result.viewConfigs[0].viewId).toBe('ALL');
    expect(result.viewConfigs[1].viewId).toBe('ALL');
  });

  test('rejects an unknown groupMode/assigneeMode and falls back to defaults', () => {
    const saved = {
      viewConfigs: JSON.stringify([
        { groupMode: 'BOGUS', assigneeMode: 'BOGUS' },
      ]),
    };
    const result = ConfigStore.load(saved);
    expect(result.viewConfigs[0].groupMode).toBe('FIELD');
    expect(result.viewConfigs[0].assigneeMode).toBe('USER_FIELD');
  });

  test('preserves an explicit STATUS/STATUS_ASSIGNEE mode', () => {
    const saved = {
      viewConfigs: JSON.stringify([
        { groupMode: 'STATUS', assigneeMode: 'STATUS_ASSIGNEE' },
      ]),
    };
    const result = ConfigStore.load(saved);
    expect(result.viewConfigs[0].groupMode).toBe('STATUS');
    expect(result.viewConfigs[0].assigneeMode).toBe('STATUS_ASSIGNEE');
  });

  test('defaults hoverFieldCodes to an empty array when missing or malformed', () => {
    const saved = {
      viewConfigs: JSON.stringify([{}, { hoverFieldCodes: 'not-an-array' }]),
    };
    const result = ConfigStore.load(saved);
    expect(result.viewConfigs[0].hoverFieldCodes).toEqual([]);
    expect(result.viewConfigs[1].hoverFieldCodes).toEqual([]);
  });
});

describe('ConfigStore.serialize', () => {
  test('round-trips through load()', () => {
    const original = {
      viewConfigs: [
        {
          viewId: 'ALL',
          viewName: '',
          groupMode: 'STATUS',
          groupFieldCode: '',
          assigneeMode: 'STATUS_ASSIGNEE',
          assigneeFieldCode: '',
          titleFieldCode: 'title',
          dueFieldCode: 'due',
          badgeFieldCode: 'priority',
          hoverFieldCodes: ['memo'],
        },
      ],
    };
    const serialized = ConfigStore.serialize(original);
    expect(typeof serialized.viewConfigs).toBe('string');
    const reloaded = ConfigStore.load(serialized);
    expect(reloaded).toEqual(original);
  });
});
