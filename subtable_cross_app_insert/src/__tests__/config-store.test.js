const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('returns sensible defaults when there is no saved config (getConfig() returned null/undefined)', () => {
    const config = ConfigStore.load(null);
    expect(config.subtableCode).toBe('');
    expect(config.destinationAppId).toBe('');
    expect(config.fieldMappings).toEqual([]);
    expect(config.updateKey).toEqual({
      subtableColumnCode: '',
      destinationFieldCode: '',
    });
    expect(config.condition).toEqual({
      type: 'group',
      conditionOperator: 'AND',
      children: [],
    });
    expect(config.triggerOnSubmit).toBe(true);
    expect(config.triggerOnManual).toBe(false);
    expect(config.manualSpaceElementId).toBe('');
    expect(config.successActionEnabled).toBe(false);
    expect(config.successActionFieldCode).toBe('');
    expect(config.successActionValue).toBe('');
  });

  test('parses a previously-saved config back into structured values', () => {
    const saved = {
      subtableCode: 'items',
      destinationAppId: '123',
      fieldMappings: JSON.stringify([
        {
          sourceType: 'SUBTABLE_COLUMN',
          sourceCode: 'itemCode',
          destinationFieldCode: 'dest_code',
        },
      ]),
      updateKey: JSON.stringify({
        subtableColumnCode: 'itemCode',
        destinationFieldCode: 'dest_code',
      }),
      condition: JSON.stringify({
        type: 'group',
        conditionOperator: 'OR',
        children: [
          {
            type: 'clause',
            fieldCode: 'status',
            operator: 'EQ',
            value: 'done',
          },
        ],
      }),
      triggerOnSubmit: 'false',
      triggerOnManual: 'true',
      manualSpaceElementId: 'Space_0',
      successActionEnabled: 'true',
      successActionFieldCode: 'transferred_flag',
      successActionValue: '転送済み',
    };

    const config = ConfigStore.load(saved);
    expect(config.subtableCode).toBe('items');
    expect(config.destinationAppId).toBe('123');
    expect(config.fieldMappings).toEqual([
      {
        sourceType: 'SUBTABLE_COLUMN',
        sourceCode: 'itemCode',
        destinationFieldCode: 'dest_code',
      },
    ]);
    expect(config.updateKey).toEqual({
      subtableColumnCode: 'itemCode',
      destinationFieldCode: 'dest_code',
    });
    expect(config.condition.conditionOperator).toBe('OR');
    expect(config.triggerOnSubmit).toBe(false);
    expect(config.triggerOnManual).toBe(true);
    expect(config.manualSpaceElementId).toBe('Space_0');
    expect(config.successActionEnabled).toBe(true);
    expect(config.successActionFieldCode).toBe('transferred_flag');
    expect(config.successActionValue).toBe('転送済み');
  });

  test('malformed JSON in a saved field falls back to the default rather than throwing', () => {
    const config = ConfigStore.load({
      fieldMappings: '{not valid json',
      updateKey: 'also not json',
    });
    expect(config.fieldMappings).toEqual([]);
    expect(config.updateKey).toEqual({
      subtableColumnCode: '',
      destinationFieldCode: '',
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('round-trips through load() without loss', () => {
    const original = ConfigStore.load({
      subtableCode: 'items',
      destinationAppId: '123',
      fieldMappings: JSON.stringify([
        {
          sourceType: 'OUTSIDE_FIELD',
          sourceCode: 'customerCode',
          destinationFieldCode: 'dest_customer',
        },
      ]),
      updateKey: JSON.stringify({
        subtableColumnCode: 'itemCode',
        destinationFieldCode: 'dest_code',
      }),
      triggerOnSubmit: 'true',
      triggerOnManual: 'true',
      manualSpaceElementId: 'Space_0',
      successActionEnabled: 'true',
      successActionFieldCode: 'flag',
      successActionValue: 'ok',
    });

    const serialized = ConfigStore.serialize(original);
    const roundTripped = ConfigStore.load(serialized);
    expect(roundTripped).toEqual(original);
  });

  test('serializes each value to the flat string shape kintone.plugin.app.setConfig() expects', () => {
    const config = ConfigStore.load(null);
    const serialized = ConfigStore.serialize(config);
    Object.values(serialized).forEach((value) => {
      expect(typeof value).toBe('string');
    });
  });
});

describe('ConfigStore.isComplete', () => {
  test('is false until the required fields (subtable, destination app, mappings, update key) are all set', () => {
    expect(ConfigStore.isComplete(ConfigStore.load(null))).toBe(false);
  });

  test('is true once subtableCode, destinationAppId, at least one mapping and the update key are set', () => {
    const config = ConfigStore.load({
      subtableCode: 'items',
      destinationAppId: '123',
      fieldMappings: JSON.stringify([
        {
          sourceType: 'SUBTABLE_COLUMN',
          sourceCode: 'itemCode',
          destinationFieldCode: 'dest_code',
        },
      ]),
      updateKey: JSON.stringify({
        subtableColumnCode: 'itemCode',
        destinationFieldCode: 'dest_code',
      }),
    });
    expect(ConfigStore.isComplete(config)).toBe(true);
  });
});
