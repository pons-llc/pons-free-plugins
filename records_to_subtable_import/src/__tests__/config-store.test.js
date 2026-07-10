const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns defaults when saved is null (unconfigured plugin)', () => {
    expect(ConfigStore.load(null)).toEqual(ConfigStore.DEFAULTS);
  });

  test('returns defaults when saved is undefined', () => {
    expect(ConfigStore.load(undefined)).toEqual(ConfigStore.DEFAULTS);
  });

  test('parses JSON-encoded array fields back into arrays', () => {
    const saved = {
      sourceAppId: '10',
      subtableFieldCode: 'imported_rows',
      conditions: JSON.stringify([
        { fieldCode: 'status', operator: '=', value: '対応中' },
      ]),
      fieldMappings: JSON.stringify([
        {
          sourceFieldCode: 'name',
          targetFieldCode: 'name_in_table',
          targetFieldType: 'SINGLE_LINE_TEXT',
        },
      ]),
      maxRecords: '150',
      buttonLabel: '取り込み実行',
    };
    const loaded = ConfigStore.load(saved);
    expect(loaded.sourceAppId).toBe('10');
    expect(loaded.subtableFieldCode).toBe('imported_rows');
    expect(loaded.conditions).toEqual([
      { fieldCode: 'status', operator: '=', value: '対応中' },
    ]);
    expect(loaded.fieldMappings).toEqual([
      {
        sourceFieldCode: 'name',
        targetFieldCode: 'name_in_table',
        targetFieldType: 'SINGLE_LINE_TEXT',
      },
    ]);
    expect(loaded.maxRecords).toBe(150);
    expect(loaded.buttonLabel).toBe('取り込み実行');
  });

  test('falls back to an empty array when a JSON field is malformed', () => {
    const loaded = ConfigStore.load({ conditions: '{not valid json' });
    expect(loaded.conditions).toEqual([]);
  });

  test('falls back to the default maxRecords when it is not a positive number', () => {
    expect(ConfigStore.load({ maxRecords: '0' }).maxRecords).toBe(
      ConfigStore.DEFAULTS.maxRecords,
    );
    expect(ConfigStore.load({ maxRecords: 'not-a-number' }).maxRecords).toBe(
      ConfigStore.DEFAULTS.maxRecords,
    );
  });
});

describe('ConfigStore.serialize', () => {
  test('round-trips through load(serialize(config))', () => {
    const config = {
      sourceAppId: '20',
      subtableFieldCode: 'rows_table',
      conditions: [{ fieldCode: 'amount', operator: '>=', value: '100' }],
      fieldMappings: [
        {
          sourceFieldCode: 'amount',
          targetFieldCode: 'amount_in_table',
          targetFieldType: 'NUMBER',
        },
      ],
      maxRecords: 250,
      buttonLabel: '実行',
    };
    const roundTripped = ConfigStore.load(ConfigStore.serialize(config));
    expect(roundTripped).toEqual(config);
  });

  test('JSON-encodes array fields', () => {
    const serialized = ConfigStore.serialize({
      sourceAppId: '1',
      subtableFieldCode: 't',
      conditions: [],
      fieldMappings: [],
      maxRecords: 300,
      buttonLabel: 'x',
    });
    expect(typeof serialized.conditions).toBe('string');
    expect(typeof serialized.fieldMappings).toBe('string');
    expect(typeof serialized.maxRecords).toBe('string');
  });
});
