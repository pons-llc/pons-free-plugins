const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns defaults when nothing has been saved yet (getConfig() returned null)', () => {
    const config = ConfigStore.load(null);
    expect(config).toEqual({
      groupingType: 'record',
      groupingFieldCode: '',
      axisFieldCodes: [],
      scaleDivisions: ConfigStore.DEFAULT_SCALE_DIVISIONS,
      title: ConfigStore.DEFAULT_TITLE,
      badgeFieldCodes: [],
      maxRecords: ConfigStore.DEFAULT_MAX_RECORDS,
    });
  });

  test('also tolerates undefined (defensive, matches kintone.plugin.app.getConfig() edge cases)', () => {
    const config = ConfigStore.load(undefined);
    expect(config.groupingType).toBe('record');
  });

  test('parses previously saved values back into their proper types', () => {
    const saved = {
      groupingType: 'field',
      groupingFieldCode: 'category',
      axisFieldCodes: JSON.stringify(['a', 'b', 'c']),
      scaleDivisions: '8',
      title: '売上比較',
      badgeFieldCodes: JSON.stringify(['name']),
      maxRecords: '500',
    };
    const config = ConfigStore.load(saved);
    expect(config).toEqual({
      groupingType: 'field',
      groupingFieldCode: 'category',
      axisFieldCodes: ['a', 'b', 'c'],
      scaleDivisions: 8,
      title: '売上比較',
      badgeFieldCodes: ['name'],
      maxRecords: 500,
    });
  });

  test('falls back to defaults when saved JSON array fields are corrupt, instead of throwing', () => {
    const config = ConfigStore.load({
      axisFieldCodes: 'not valid json',
      badgeFieldCodes: '{"not":"an array"}',
    });
    expect(config.axisFieldCodes).toEqual([]);
    expect(config.badgeFieldCodes).toEqual([]);
  });

  test('coerces any groupingType other than "field" to "record"', () => {
    expect(ConfigStore.load({ groupingType: 'bogus' }).groupingType).toBe(
      'record',
    );
  });

  test('falls back to default scale divisions / max records when not a valid number', () => {
    const config = ConfigStore.load({
      scaleDivisions: 'abc',
      maxRecords: '',
    });
    expect(config.scaleDivisions).toBe(ConfigStore.DEFAULT_SCALE_DIVISIONS);
    expect(config.maxRecords).toBe(ConfigStore.DEFAULT_MAX_RECORDS);
  });
});

describe('ConfigStore.serialize', () => {
  test('round-trips through load/serialize without losing data', () => {
    const original = {
      groupingType: 'field',
      groupingFieldCode: 'category',
      axisFieldCodes: ['sales', 'profit', 'cost'],
      scaleDivisions: 6,
      title: '部門別実績',
      badgeFieldCodes: ['owner'],
      maxRecords: 1000,
    };
    const serialized = ConfigStore.serialize(original);
    const reloaded = ConfigStore.load(serialized);
    expect(reloaded).toEqual(original);
  });

  test('serialized values are all strings (a setConfig() requirement)', () => {
    const serialized = ConfigStore.serialize({
      groupingType: 'record',
      axisFieldCodes: ['a', 'b', 'c'],
    });
    Object.values(serialized).forEach((value) => {
      expect(typeof value).toBe('string');
    });
  });
});

describe('ConfigStore.DEFAULT_MAX_RECORDS', () => {
  test('defaults to 2000 per plugin_idea_plan.md convention (gantt_chart_viewと同じ既定値)', () => {
    expect(ConfigStore.DEFAULT_MAX_RECORDS).toBe(2000);
  });
});

describe('ConfigStore.DEFAULT_SCALE_DIVISIONS', () => {
  test('defaults to 5', () => {
    expect(ConfigStore.DEFAULT_SCALE_DIVISIONS).toBe(5);
  });
});
