'use strict';

const FieldMapping = require('../js/lib/field-mapping');

const matchedRecord = {
  name: { type: 'SINGLE_LINE_TEXT', value: '山田太郎' },
  address: { type: 'SINGLE_LINE_TEXT', value: '東京都新宿区' },
  tags: { type: 'CHECK_BOX', value: ['A', 'B'] },
};

describe('FieldMapping.buildFieldValues', () => {
  test('copies each mapped field value from the matched record', () => {
    const values = FieldMapping.buildFieldValues(matchedRecord, [
      { sourceFieldCode: 'name', targetFieldCode: 'customer_name' },
      { sourceFieldCode: 'address', targetFieldCode: 'customer_address' },
    ]);
    expect(values).toEqual({
      customer_name: '山田太郎',
      customer_address: '東京都新宿区',
    });
  });

  test('passes through non-string values as-is (e.g. CHECK_BOX arrays)', () => {
    const values = FieldMapping.buildFieldValues(matchedRecord, [
      { sourceFieldCode: 'tags', targetFieldCode: 'copied_tags' },
    ]);
    expect(values.copied_tags).toEqual(['A', 'B']);
  });

  test('falls back to an empty string when the matched record lacks the field', () => {
    const values = FieldMapping.buildFieldValues(matchedRecord, [
      { sourceFieldCode: 'not_exist', targetFieldCode: 'customer_name' },
    ]);
    expect(values).toEqual({ customer_name: '' });
  });

  test('clears every mapped target field to an empty string when no record matched', () => {
    const values = FieldMapping.buildFieldValues(null, [
      { sourceFieldCode: 'name', targetFieldCode: 'customer_name' },
      { sourceFieldCode: 'address', targetFieldCode: 'customer_address' },
    ]);
    expect(values).toEqual({ customer_name: '', customer_address: '' });
  });

  test('ignores mapping entries without a targetFieldCode', () => {
    const values = FieldMapping.buildFieldValues(matchedRecord, [
      { sourceFieldCode: 'name', targetFieldCode: '' },
    ]);
    expect(values).toEqual({});
  });

  test('returns an empty object when fieldMappings is empty or missing', () => {
    expect(FieldMapping.buildFieldValues(matchedRecord, [])).toEqual({});
    expect(FieldMapping.buildFieldValues(matchedRecord, undefined)).toEqual({});
  });
});
