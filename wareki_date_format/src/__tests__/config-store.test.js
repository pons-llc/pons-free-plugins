const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('rawSaved === null (kintone.plugin.app.getConfig() returned nothing) yields defaults, not a crash', () => {
    expect(ConfigStore.load(null)).toEqual({ pairs: [] });
  });

  test('rawSaved === undefined yields defaults', () => {
    expect(ConfigStore.load(undefined)).toEqual({ pairs: [] });
  });

  test('empty object yields defaults', () => {
    expect(ConfigStore.load({})).toEqual({ pairs: [] });
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
    });
  });

  test('malformed JSON in pairs falls back to the default empty array instead of throwing', () => {
    expect(ConfigStore.load({ pairs: '{not json' })).toEqual({ pairs: [] });
  });
});

describe('ConfigStore.serialize', () => {
  test('serializes pairs to a JSON string suitable for kintone.plugin.app.setConfig()', () => {
    const config = {
      pairs: [
        {
          sourceFieldCode: 'day1',
          targetFieldCode: 'wareki1',
          preset: 'WAREKI_WITH_SEIREKI',
          zenkaku: true,
        },
      ],
    };
    const serialized = ConfigStore.serialize(config);
    expect(typeof serialized.pairs).toBe('string');
    expect(JSON.parse(serialized.pairs)).toEqual(config.pairs);
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
    };
    expect(ConfigStore.load(ConfigStore.serialize(config))).toEqual(config);
  });
});
