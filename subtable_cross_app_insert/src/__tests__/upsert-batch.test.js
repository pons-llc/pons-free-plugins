const UpsertBatch = require('../js/lib/upsert-batch');

describe('UpsertBatch.chunk', () => {
  test('splits an array into chunks of the given size, keeping the last partial chunk', () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    expect(UpsertBatch.chunk(items, 2)).toEqual([[0, 1], [2, 3], [4]]);
  });

  test('returns an empty array when given an empty array', () => {
    expect(UpsertBatch.chunk([], 100)).toEqual([]);
  });
});

describe('UpsertBatch.buildRequestBodies', () => {
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
        sourceType: 'OUTSIDE_FIELD',
        sourceCode: 'customerCode',
        destinationFieldCode: 'dest_customer',
      },
    ],
  };
  const sourceRecord = { customerCode: { value: 'C-001' } };

  const makeRows = (count) =>
    Array.from({ length: count }, (_, i) => ({
      id: String(i + 1),
      value: { itemCode: { value: `ITEM-${i + 1}` } },
    }));

  test('builds a single PUT request body with upsert:true for rows within the 100-record limit', () => {
    const bodies = UpsertBatch.buildRequestBodies(
      '999',
      mapping,
      sourceRecord,
      makeRows(3),
    );
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({
      app: '999',
      upsert: true,
      records: [
        {
          updateKey: { field: 'dest_item_code', value: 'ITEM-1' },
          record: {
            dest_item_code: { value: 'ITEM-1' },
            dest_customer: { value: 'C-001' },
          },
        },
        {
          updateKey: { field: 'dest_item_code', value: 'ITEM-2' },
          record: {
            dest_item_code: { value: 'ITEM-2' },
            dest_customer: { value: 'C-001' },
          },
        },
        {
          updateKey: { field: 'dest_item_code', value: 'ITEM-3' },
          record: {
            dest_item_code: { value: 'ITEM-3' },
            dest_customer: { value: 'C-001' },
          },
        },
      ],
    });
  });

  test('splits more than 100 rows into multiple request bodies of at most 100 records each', () => {
    const bodies = UpsertBatch.buildRequestBodies(
      '999',
      mapping,
      sourceRecord,
      makeRows(150),
    );
    expect(bodies).toHaveLength(2);
    expect(bodies[0].records).toHaveLength(100);
    expect(bodies[1].records).toHaveLength(50);
    bodies.forEach((body) => {
      expect(body.app).toBe('999');
      expect(body.upsert).toBe(true);
    });
  });

  test('returns an empty array when there are no rows to transfer', () => {
    expect(
      UpsertBatch.buildRequestBodies('999', mapping, sourceRecord, []),
    ).toEqual([]);
  });

  test('accepts a custom chunk size', () => {
    const bodies = UpsertBatch.buildRequestBodies(
      '999',
      mapping,
      sourceRecord,
      makeRows(5),
      2,
    );
    expect(bodies).toHaveLength(3);
    expect(bodies.map((b) => b.records.length)).toEqual([2, 2, 1]);
  });
});
