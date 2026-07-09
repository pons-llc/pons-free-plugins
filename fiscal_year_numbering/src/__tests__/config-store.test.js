const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('an empty/absent saved config yields the seeded defaults', () => {
    const config = ConfigStore.load({});
    expect(config.fiscalYearDateSource).toBe('CREATED_TIME');
    expect(config.fiscalYearDateField).toBe('');
    expect(config.eraTable).toEqual([{ code: 'R', label: '令和', startYear: 2019 }]);
    expect(config.segments).toEqual([]);
    expect(config.numberFormat).toEqual({ separator: '-', sequenceDigits: 4 });
    expect(config.numberFieldCode).toBe('');
    expect(config.counterAppId).toBe('');
    expect(config.bulkNumberingGroupCode).toBe('');
  });

  test('null/undefined (getConfig() on an unconfigured app) is treated like an empty object, not an error', () => {
    expect(() => ConfigStore.load(null)).not.toThrow();
    expect(ConfigStore.load(null)).toEqual(ConfigStore.load({}));
    expect(() => ConfigStore.load(undefined)).not.toThrow();
  });

  test('a saved config round-trips through serialize/load without data loss', () => {
    const original = {
      fiscalYearDateSource: 'FIELD',
      fiscalYearDateField: 'shorui_bi',
      eraTable: [
        { code: 'R', label: '令和', startYear: 2019 },
        { code: 'X', label: '仮元号', startYear: 2031 },
      ],
      segments: [{ fieldCode: 'buka', order: 1, optionOverrides: { soumu: '総務課' } }],
      numberFormat: { separator: '_', sequenceDigits: 5 },
      numberFieldCode: 'seiban',
      counterAppId: '581',
      bulkNumberingGroupCode: 'kanri_group',
    };
    const serialized = ConfigStore.serialize(original);
    const loaded = ConfigStore.load(serialized);
    expect(loaded).toEqual(original);
  });
});
