const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns default values (empty rows, all triggers off) when nothing is saved', () => {
    expect(ConfigStore.load(null)).toEqual({
      rows: [],
      triggers: { onSubmit: false, onDetailButton: false, onIndexBulk: false },
      bulkGroupCodes: [],
    });
  });

  test('does not throw when getConfig() returns undefined', () => {
    expect(() => ConfigStore.load(undefined)).not.toThrow();
  });

  test('parses JSON-encoded rows, triggers, and bulkGroupCodes from the saved payload', () => {
    const saved = {
      rows: JSON.stringify([
        {
          referenceFieldCode: '関連レコード一覧_0',
          summaryType: 'SUM',
          targetFieldCode: '金額',
          writeFieldCode: '金額合計',
          exclusionCond: '',
        },
      ]),
      triggers: JSON.stringify({
        onSubmit: true,
        onDetailButton: false,
        onIndexBulk: true,
      }),
      bulkGroupCodes: JSON.stringify(['kanri_group', 'admins']),
    };
    const config = ConfigStore.load(saved);
    expect(config.rows).toHaveLength(1);
    expect(config.rows[0].summaryType).toBe('SUM');
    expect(config.triggers).toEqual({
      onSubmit: true,
      onDetailButton: false,
      onIndexBulk: true,
    });
    expect(config.bulkGroupCodes).toEqual(['kanri_group', 'admins']);
  });

  test('falls back to defaults when the saved JSON is malformed', () => {
    const config = ConfigStore.load({
      rows: '{not valid json',
      triggers: 'also not valid',
      bulkGroupCodes: 'not json either',
    });
    expect(config.rows).toEqual([]);
    expect(config.triggers).toEqual({
      onSubmit: false,
      onDetailButton: false,
      onIndexBulk: false,
    });
    expect(config.bulkGroupCodes).toEqual([]);
  });
});

describe('ConfigStore.serialize', () => {
  test('JSON-encodes rows, triggers, and bulkGroupCodes', () => {
    const config = {
      rows: [{ referenceFieldCode: 'r1', summaryType: 'COUNT' }],
      triggers: { onSubmit: true, onDetailButton: true, onIndexBulk: false },
      bulkGroupCodes: ['admins'],
    };
    const serialized = ConfigStore.serialize(config);
    expect(JSON.parse(serialized.rows)).toEqual(config.rows);
    expect(JSON.parse(serialized.triggers)).toEqual(config.triggers);
    expect(JSON.parse(serialized.bulkGroupCodes)).toEqual(['admins']);
  });

  test('round-trips through load after serialize', () => {
    const config = {
      rows: [
        {
          referenceFieldCode: 'r1',
          summaryType: 'AVERAGE',
          targetFieldCode: 'x',
          writeFieldCode: 'y',
          exclusionCond: 'a = 1',
        },
      ],
      triggers: { onSubmit: false, onDetailButton: true, onIndexBulk: true },
      bulkGroupCodes: ['g1', 'g2'],
    };
    expect(ConfigStore.load(ConfigStore.serialize(config))).toEqual(config);
  });
});
