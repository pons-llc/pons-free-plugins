'use strict';

const TableDisabler = require('../js/lib/table-disabler');

describe('disableAllRows', () => {
  test('既存の全行の内包フィールドをdisabledにする', () => {
    const table = {
      type: 'SUBTABLE',
      value: [
        {
          id: '1',
          value: {
            status_before: { type: 'SINGLE_LINE_TEXT', value: '未処理' },
            executed_by: { type: 'USER_SELECT', value: [] },
          },
        },
        {
          id: '2',
          value: {
            status_before: { type: 'SINGLE_LINE_TEXT', value: '承認済' },
            executed_by: { type: 'USER_SELECT', value: [] },
          },
        },
      ],
    };

    TableDisabler.disableAllRows(table);

    expect(table.value[0].value.status_before.disabled).toBe(true);
    expect(table.value[0].value.executed_by.disabled).toBe(true);
    expect(table.value[1].value.status_before.disabled).toBe(true);
    expect(table.value[1].value.executed_by.disabled).toBe(true);
  });

  test('行が0件でも例外にしない', () => {
    const table = { type: 'SUBTABLE', value: [] };
    expect(() => TableDisabler.disableAllRows(table)).not.toThrow();
  });

  test('テーブル自体がundefinedでも例外にしない(フィールド未作成時)', () => {
    expect(() => TableDisabler.disableAllRows(undefined)).not.toThrow();
  });
});
