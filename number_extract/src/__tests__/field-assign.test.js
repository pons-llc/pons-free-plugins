'use strict';

const FieldAssign = require('../js/lib/field-assign');

describe('FieldAssign.buildFieldValues', () => {
  test('assigns each extracted number to the target field at the same position', () => {
    const values = FieldAssign.buildFieldValues(
      ['2', '8', '1'],
      ['chome_field', 'banchi_field', 'go_field'],
    );
    expect(values).toEqual({
      chome_field: '2',
      banchi_field: '8',
      go_field: '1',
    });
  });

  test('clears extra target fields with an empty string when there are fewer parts', () => {
    const values = FieldAssign.buildFieldValues(
      ['2'],
      ['chome_field', 'banchi_field'],
    );
    expect(values).toEqual({ chome_field: '2', banchi_field: '' });
  });

  test('discards extra parts when there are more parts than target fields', () => {
    const values = FieldAssign.buildFieldValues(
      ['2', '8', '1', '5'],
      ['a', 'b'],
    );
    expect(values).toEqual({ a: '2', b: '8' });
  });

  test('ignores blank entries in the target field list', () => {
    const values = FieldAssign.buildFieldValues(['2', '8'], ['a', '']);
    expect(values).toEqual({ a: '2' });
  });

  test('returns an empty object when targetFieldCodes is empty or missing', () => {
    expect(FieldAssign.buildFieldValues(['2'], [])).toEqual({});
    expect(FieldAssign.buildFieldValues(['2'], undefined)).toEqual({});
  });
});
