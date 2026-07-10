const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('rawSaved === null (kintone.plugin.app.getConfig() returned nothing) yields defaults, not a crash', () => {
    expect(ConfigStore.load(null)).toEqual({ pairs: [], eras: [] });
  });

  test('rawSaved === undefined yields defaults', () => {
    expect(ConfigStore.load(undefined)).toEqual({ pairs: [], eras: [] });
  });

  test('empty object yields defaults', () => {
    expect(ConfigStore.load({})).toEqual({ pairs: [], eras: [] });
  });

  test('parses a previously-saved pairs JSON string', () => {
    const saved = {
      pairs: JSON.stringify([
        {
          sourceFieldCode: 'day1',
          targetFieldCode: 'wareki1',
          preset: 'WAREKI_ONLY',
          zenkaku: false,
        },
      ]),
    };
    expect(ConfigStore.load(saved)).toEqual({
      pairs: [
        {
          sourceFieldCode: 'day1',
          targetFieldCode: 'wareki1',
          preset: 'WAREKI_ONLY',
          zenkaku: false,
        },
      ],
      eras: [],
    });
  });

  test('parses a previously-saved eras JSON string', () => {
    const saved = {
      eras: JSON.stringify([{ name: '和新', startDate: '2040-03-01' }]),
    };
    expect(ConfigStore.load(saved)).toEqual({
      pairs: [],
      eras: [{ name: '和新', startDate: '2040-03-01' }],
    });
  });

  test('malformed JSON in pairs falls back to the default empty array instead of throwing', () => {
    expect(ConfigStore.load({ pairs: '{not json' })).toEqual({
      pairs: [],
      eras: [],
    });
  });

  test('malformed JSON in eras falls back to the default empty array instead of throwing', () => {
    expect(ConfigStore.load({ eras: '{not json' })).toEqual({
      pairs: [],
      eras: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes pairs/eras to JSON strings suitable for kintone.plugin.app.setConfig()', () => {
    const config = {
      pairs: [
        {
          sourceFieldCode: 'day1',
          targetFieldCode: 'wareki1',
          preset: 'WAREKI_WITH_SEIREKI',
          zenkaku: true,
        },
      ],
      eras: [{ name: '和新', startDate: '2040-03-01' }],
    };
    const serialized = ConfigStore.serialize(config);
    expect(typeof serialized.pairs).toBe('string');
    expect(typeof serialized.eras).toBe('string');
    expect(JSON.parse(serialized.pairs)).toEqual(config.pairs);
    expect(JSON.parse(serialized.eras)).toEqual(config.eras);
  });

  test('round-trips through load(serialize(config))', () => {
    const config = {
      pairs: [
        {
          sourceFieldCode: 'a',
          targetFieldCode: 'b',
          preset: 'WAREKI_ONLY',
          zenkaku: false,
        },
        {
          sourceFieldCode: 'c',
          targetFieldCode: 'd',
          preset: 'WAREKI_WITH_SEIREKI',
          zenkaku: true,
        },
      ],
      eras: [{ name: '和新', startDate: '2040-03-01' }],
    };
    expect(ConfigStore.load(ConfigStore.serialize(config))).toEqual(config);
  });
});
