const FieldMapping = require('../js/lib/field-mapping');

describe('FieldMapping.buildDestinationFields', () => {
  const sourceRecord = {
    customerCode: { value: 'C-001' },
    projectName: { value: 'テストプロジェクト' },
  };
  const rowValue = {
    itemCode: { value: 'ITEM-01' },
    quantity: { value: '3' },
  };

  test('maps SUBTABLE_COLUMN sources from the row and OUTSIDE_FIELD sources from the parent record', () => {
    const mapping = {
      updateKey: {
        subtableColumnCode: 'itemCode',
        destinationFieldCode: 'dest_item_code',
      },
      fieldMappings: [
        {
          sourceType: 'SUBTABLE_COLUMN',
          sourceCode: 'itemCode',
          destinationFieldCode: 'dest_item_code',
        },
        {
          sourceType: 'SUBTABLE_COLUMN',
          sourceCode: 'quantity',
          destinationFieldCode: 'dest_quantity',
        },
        {
          sourceType: 'OUTSIDE_FIELD',
          sourceCode: 'customerCode',
          destinationFieldCode: 'dest_customer',
        },
      ],
    };

    expect(
      FieldMapping.buildDestinationFields(mapping, sourceRecord, rowValue),
    ).toEqual({
      dest_item_code: { value: 'ITEM-01' },
      dest_quantity: { value: '3' },
      dest_customer: { value: 'C-001' },
    });
  });

  test('always includes the update-key destination field even if it was omitted from fieldMappings', () => {
    const mapping = {
      updateKey: {
        subtableColumnCode: 'itemCode',
        destinationFieldCode: 'dest_item_code',
      },
      fieldMappings: [
        {
          sourceType: 'OUTSIDE_FIELD',
          sourceCode: 'customerCode',
          destinationFieldCode: 'dest_customer',
        },
      ],
    };

    const result = FieldMapping.buildDestinationFields(
      mapping,
      sourceRecord,
      rowValue,
    );
    expect(result.dest_item_code).toEqual({ value: 'ITEM-01' });
  });

  test('missing source fields resolve to an empty string rather than throwing', () => {
    const mapping = {
      updateKey: {
        subtableColumnCode: 'itemCode',
        destinationFieldCode: 'dest_item_code',
      },
      fieldMappings: [
        {
          sourceType: 'SUBTABLE_COLUMN',
          sourceCode: 'missingColumn',
          destinationFieldCode: 'dest_missing',
        },
        {
          sourceType: 'OUTSIDE_FIELD',
          sourceCode: 'missingOutside',
          destinationFieldCode: 'dest_missing2',
        },
      ],
    };

    expect(
      FieldMapping.buildDestinationFields(mapping, sourceRecord, rowValue),
    ).toEqual({
      dest_item_code: { value: 'ITEM-01' },
      dest_missing: { value: '' },
      dest_missing2: { value: '' },
    });
  });

  test('resolveUpdateKeyValue extracts the raw key value used for a row (for query/dedup purposes)', () => {
    const mapping = {
      updateKey: {
        subtableColumnCode: 'itemCode',
        destinationFieldCode: 'dest_item_code',
      },
    };
    expect(FieldMapping.resolveUpdateKeyValue(mapping, rowValue)).toBe(
      'ITEM-01',
    );
  });
});
