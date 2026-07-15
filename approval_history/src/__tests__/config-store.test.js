'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore', () => {
  test('未保存(null)の場合はfieldCodesがnullの既定値を返す', () => {
    expect(ConfigStore.load(null)).toEqual({ fieldCodes: null });
    expect(ConfigStore.load(undefined)).toEqual({ fieldCodes: null });
  });

  test('保存済みのfieldCodesをJSONとして読み戻せる', () => {
    const fieldCodes = {
      table: 'approval_history_table',
      statusBefore: 'status_before',
      statusAfter: 'status_after',
      executedBy: 'executed_by',
      executedByTitle: 'executed_by_title',
      executedAt: 'executed_at',
    };
    const saved = { fieldCodes: JSON.stringify(fieldCodes) };

    expect(ConfigStore.load(saved)).toEqual({ fieldCodes });
  });

  test('壊れたJSONが保存されていても例外にせずnullとして扱う', () => {
    expect(ConfigStore.load({ fieldCodes: '{invalid' })).toEqual({
      fieldCodes: null,
    });
  });

  test('serializeで文字列化し、loadで往復できる', () => {
    const config = {
      fieldCodes: {
        table: 'approval_history_table_2',
        statusBefore: 'status_before',
        statusAfter: 'status_after',
        executedBy: 'executed_by',
        executedByTitle: 'executed_by_title',
        executedAt: 'executed_at',
      },
    };

    const serialized = ConfigStore.serialize(config);
    expect(ConfigStore.load(serialized)).toEqual(config);
  });

  test('isConfiguredはfieldCodes.tableがあるときのみtrue', () => {
    expect(ConfigStore.isConfigured({ fieldCodes: null })).toBe(false);
    expect(ConfigStore.isConfigured({ fieldCodes: { table: '' } })).toBe(false);
    expect(
      ConfigStore.isConfigured({
        fieldCodes: { table: 'approval_history_table' },
      }),
    ).toBe(true);
  });
});
