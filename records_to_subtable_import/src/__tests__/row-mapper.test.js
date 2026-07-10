const RowMapper = require('../js/lib/row-mapper');

describe('RowMapper.stringifyForTextTarget', () => {
  test('returns an empty string for null/undefined', () => {
    expect(RowMapper.stringifyForTextTarget(null)).toBe('');
    expect(RowMapper.stringifyForTextTarget(undefined)).toBe('');
  });

  test('joins arrays of scalars with a comma', () => {
    expect(RowMapper.stringifyForTextTarget(['選択肢1', '選択肢2'])).toBe(
      '選択肢1, 選択肢2',
    );
  });

  test('joins arrays of {code,name} objects using name', () => {
    expect(
      RowMapper.stringifyForTextTarget([{ code: 'sato', name: 'Noboru Sato' }]),
    ).toBe('Noboru Sato');
  });

  test('extracts name (or code) from a single object', () => {
    expect(
      RowMapper.stringifyForTextTarget({ code: 'sato', name: 'Noboru Sato' }),
    ).toBe('Noboru Sato');
  });

  test('stringifies plain scalars', () => {
    expect(RowMapper.stringifyForTextTarget(123)).toBe('123');
  });
});

describe('RowMapper.mapRecordToRowValue', () => {
  test('maps each field mapping to a {type, value} entry keyed by the target field code', () => {
    const sourceRecord = {
      customer_name: { type: 'SINGLE_LINE_TEXT', value: 'サイボウズ株式会社' },
      amount: { type: 'NUMBER', value: '1000' },
    };
    const fieldMappings = [
      {
        sourceFieldCode: 'customer_name',
        targetFieldCode: 'name_in_table',
        targetFieldType: 'SINGLE_LINE_TEXT',
      },
      {
        sourceFieldCode: 'amount',
        targetFieldCode: 'amount_in_table',
        targetFieldType: 'NUMBER',
      },
    ];
    expect(RowMapper.mapRecordToRowValue(sourceRecord, fieldMappings)).toEqual({
      name_in_table: { type: 'SINGLE_LINE_TEXT', value: 'サイボウズ株式会社' },
      amount_in_table: { type: 'NUMBER', value: '1000' },
    });
  });

  test('stringifies a NUMBER source value when the target is a text field', () => {
    const sourceRecord = { amount: { type: 'NUMBER', value: '1000' } };
    const fieldMappings = [
      {
        sourceFieldCode: 'amount',
        targetFieldCode: 'amount_text',
        targetFieldType: 'MULTI_LINE_TEXT',
      },
    ];
    expect(RowMapper.mapRecordToRowValue(sourceRecord, fieldMappings)).toEqual({
      amount_text: { type: 'MULTI_LINE_TEXT', value: '1000' },
    });
  });

  test('falls back to an empty value when the source field is missing on the record', () => {
    const fieldMappings = [
      {
        sourceFieldCode: 'missing',
        targetFieldCode: 'target_text',
        targetFieldType: 'SINGLE_LINE_TEXT',
      },
    ];
    expect(RowMapper.mapRecordToRowValue({}, fieldMappings)).toEqual({
      target_text: { type: 'SINGLE_LINE_TEXT', value: '' },
    });
  });
});

describe('RowMapper.mapRecordsToRows', () => {
  test('maps an array of source records into subtable rows without an id (treated as new rows)', () => {
    const sourceRecords = [
      { name: { type: 'SINGLE_LINE_TEXT', value: 'サンプル１' } },
      { name: { type: 'SINGLE_LINE_TEXT', value: 'サンプル２' } },
    ];
    const fieldMappings = [
      {
        sourceFieldCode: 'name',
        targetFieldCode: 'name_in_table',
        targetFieldType: 'SINGLE_LINE_TEXT',
      },
    ];
    const rows = RowMapper.mapRecordsToRows(sourceRecords, fieldMappings);
    expect(rows).toEqual([
      {
        value: {
          name_in_table: { type: 'SINGLE_LINE_TEXT', value: 'サンプル１' },
        },
      },
      {
        value: {
          name_in_table: { type: 'SINGLE_LINE_TEXT', value: 'サンプル２' },
        },
      },
    ]);
    rows.forEach((row) => expect(row.id).toBeUndefined());
  });

  test('returns an empty array for an empty/null input', () => {
    expect(RowMapper.mapRecordsToRows([], [])).toEqual([]);
    expect(RowMapper.mapRecordsToRows(null, [])).toEqual([]);
  });
});
