'use strict';

const FieldAssign = require('../js/lib/field-assign');

describe('FieldAssign.buildFieldValues', () => {
  test('assigns each part to the target field at the same position', () => {
    const values = FieldAssign.buildFieldValues(
      ['2024', '07', '09'],
      ['year_field', 'month_field', 'day_field'],
    );
    expect(values).toEqual({
      year_field: '2024',
      month_field: '07',
      day_field: '09',
    });
  });

  test('clears extra target fields with an empty string when there are fewer parts', () => {
    const values = FieldAssign.buildFieldValues(
      ['2024'],
      ['year_field', 'month_field', 'day_field'],
    );
    expect(values).toEqual({
      year_field: '2024',
      month_field: '',
      day_field: '',
    });
  });

  test('discards extra parts when there are more parts than target fields', () => {
    const values = FieldAssign.buildFieldValues(
      ['2024', '07', '09', '12'],
      ['year_field', 'month_field'],
    );
    expect(values).toEqual({ year_field: '2024', month_field: '07' });
  });

  test('ignores blank entries in the target field list', () => {
    const values = FieldAssign.buildFieldValues(['a', 'b'], ['field_a', '']);
    expect(values).toEqual({ field_a: 'a' });
  });

  test('returns an empty object when targetFieldCodes is empty or missing', () => {
    expect(FieldAssign.buildFieldValues(['a'], [])).toEqual({});
    expect(FieldAssign.buildFieldValues(['a'], undefined)).toEqual({});
  });
});
