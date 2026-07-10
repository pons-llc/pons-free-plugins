'use strict';

const RowMapper = require('../js/lib/row-mapper');

const matchedRow = {
  id: '1',
  value: {
    result: { type: 'SINGLE_LINE_TEXT', value: 'OK' },
    inspection_date: { type: 'DATE', value: '2024-03-01' },
    checked_items: { type: 'CHECK_BOX', value: ['配線', '外観'] },
  },
};

describe('RowMapper.buildFieldValues', () => {
  test('copies each mapped column value from the matched row', () => {
    const values = RowMapper.buildFieldValues(matchedRow, [
      { subtableColumnCode: 'result', targetFieldCode: 'latest_result' },
      { subtableColumnCode: 'inspection_date', targetFieldCode: 'latest_date' },
    ]);
    expect(values).toEqual({
      latest_result: 'OK',
      latest_date: '2024-03-01',
    });
  });

  test('passes through non-string values as-is (e.g. CHECK_BOX arrays)', () => {
    const values = RowMapper.buildFieldValues(matchedRow, [
      {
        subtableColumnCode: 'checked_items',
        targetFieldCode: 'latest_checked_items',
      },
    ]);
    expect(values.latest_checked_items).toEqual(['配線', '外観']);
  });

  test('falls back to an empty string when the matched row lacks the column', () => {
    const values = RowMapper.buildFieldValues(matchedRow, [
      { subtableColumnCode: 'not_exist', targetFieldCode: 'latest_result' },
    ]);
    expect(values).toEqual({ latest_result: '' });
  });

  test('clears every mapped target field to an empty string when no row matched', () => {
    const values = RowMapper.buildFieldValues(null, [
      { subtableColumnCode: 'result', targetFieldCode: 'latest_result' },
      { subtableColumnCode: 'inspection_date', targetFieldCode: 'latest_date' },
    ]);
    expect(values).toEqual({ latest_result: '', latest_date: '' });
  });

  test('ignores mapping entries without a targetFieldCode', () => {
    const values = RowMapper.buildFieldValues(matchedRow, [
      { subtableColumnCode: 'result', targetFieldCode: '' },
    ]);
    expect(values).toEqual({});
  });

  test('returns an empty object when fieldMappings is empty or missing', () => {
    expect(RowMapper.buildFieldValues(matchedRow, [])).toEqual({});
    expect(RowMapper.buildFieldValues(matchedRow, undefined)).toEqual({});
  });
});
