'use strict';

const FieldSpecBuilder = require('../js/lib/field-spec-builder');

describe('FieldSpecBuilder.buildFieldSpecs', () => {
  test('新規フィールドコードを既定の命名規則で採番する', () => {
    const rows = [{ sourceFieldCode: 'start_at', bandWidthMinutes: 60 }];
    const { resolvedRows, propertiesToAdd, warnings } =
      FieldSpecBuilder.buildFieldSpecs(rows, {
        existingFields: {},
        fieldLabelByCode: { start_at: '開始日時' },
      });

    expect(warnings).toEqual([]);
    expect(resolvedRows[0].dropdownFieldCode).toBe('start_at_timeband');
    expect(resolvedRows[0].numberFieldCode).toBe('start_at_timeband_num');

    expect(propertiesToAdd.start_at_timeband.type).toBe('DROP_DOWN');
    expect(propertiesToAdd.start_at_timeband.label).toBe('開始日時(時間帯)');
    expect(Object.keys(propertiesToAdd.start_at_timeband.options)).toHaveLength(
      24,
    );

    expect(propertiesToAdd.start_at_timeband_num.type).toBe('NUMBER');
    expect(propertiesToAdd.start_at_timeband_num.label).toBe(
      '開始日時(時間帯・数値)',
    );
  });

  test('既存フィールドが同じコード・同じ型なら再利用し作成対象から除外する(冪等)', () => {
    const rows = [{ sourceFieldCode: 'start_at', bandWidthMinutes: 60 }];
    const existingFields = {
      start_at_timeband: { type: 'DROP_DOWN' },
      start_at_timeband_num: { type: 'NUMBER' },
    };
    const { resolvedRows, propertiesToAdd, warnings } =
      FieldSpecBuilder.buildFieldSpecs(rows, { existingFields });

    expect(resolvedRows[0].dropdownFieldCode).toBe('start_at_timeband');
    expect(resolvedRows[0].numberFieldCode).toBe('start_at_timeband_num');
    expect(propertiesToAdd).toEqual({});
    expect(warnings).toEqual([]);
  });

  test('既存フィールドが同じコードだが型が異なる場合は連番を付けて回避する', () => {
    const rows = [{ sourceFieldCode: 'start_at', bandWidthMinutes: 60 }];
    const existingFields = {
      start_at_timeband: { type: 'SINGLE_LINE_TEXT' },
    };
    const { resolvedRows, propertiesToAdd, warnings } =
      FieldSpecBuilder.buildFieldSpecs(rows, { existingFields });

    expect(resolvedRows[0].dropdownFieldCode).toBe('start_at_timeband_2');
    expect(propertiesToAdd.start_at_timeband_2.type).toBe('DROP_DOWN');
    expect(propertiesToAdd.start_at_timeband).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });

  test('複数行それぞれのフィールドを独立して採番する', () => {
    const rows = [
      { sourceFieldCode: 'a', bandWidthMinutes: 60 },
      { sourceFieldCode: 'b', bandWidthMinutes: 30 },
    ];
    const { resolvedRows, propertiesToAdd } = FieldSpecBuilder.buildFieldSpecs(
      rows,
      {
        existingFields: {},
      },
    );
    expect(resolvedRows[0].dropdownFieldCode).toBe('a_timeband');
    expect(resolvedRows[1].dropdownFieldCode).toBe('b_timeband');
    expect(Object.keys(propertiesToAdd.b_timeband.options)).toHaveLength(48);
  });

  test('ラベルが無い場合はフィールドコードをラベル代わりに使う', () => {
    const rows = [{ sourceFieldCode: 'start_at', bandWidthMinutes: 60 }];
    const { propertiesToAdd } = FieldSpecBuilder.buildFieldSpecs(rows, {
      existingFields: {},
      fieldLabelByCode: {},
    });
    expect(propertiesToAdd.start_at_timeband.label).toBe('start_at(時間帯)');
  });
});
