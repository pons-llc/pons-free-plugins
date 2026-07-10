'use strict';

const LookupTrigger = require('../js/lib/lookup-trigger');

describe('LookupTrigger.applyLookupTriggers', () => {
  test('sets lookup=true on a plain FIELD target', () => {
    const record = {
      lookup_customer: { type: 'SINGLE_LINE_TEXT', value: '0001' },
    };
    LookupTrigger.applyLookupTriggers(record, [
      { kind: 'FIELD', fieldCode: 'lookup_customer' },
    ]);
    expect(record.lookup_customer.lookup).toBe(true);
  });

  test('sets lookup=true on every row of a SUBTABLE_COLUMN target', () => {
    const record = {
      history: {
        type: 'SUBTABLE',
        value: [
          {
            id: '1',
            value: { lookup_item: { type: 'SINGLE_LINE_TEXT', value: 'A' } },
          },
          {
            id: '2',
            value: { lookup_item: { type: 'SINGLE_LINE_TEXT', value: 'B' } },
          },
        ],
      },
    };
    LookupTrigger.applyLookupTriggers(record, [
      {
        kind: 'SUBTABLE_COLUMN',
        subtableFieldCode: 'history',
        columnCode: 'lookup_item',
      },
    ]);
    expect(record.history.value[0].value.lookup_item.lookup).toBe(true);
    expect(record.history.value[1].value.lookup_item.lookup).toBe(true);
  });

  test('does nothing (no throw) when the target field is missing from the record', () => {
    const record = {};
    expect(() =>
      LookupTrigger.applyLookupTriggers(record, [
        { kind: 'FIELD', fieldCode: 'not_exist' },
      ]),
    ).not.toThrow();
  });

  test('does nothing (no throw) when the target subtable is missing from the record', () => {
    const record = {};
    expect(() =>
      LookupTrigger.applyLookupTriggers(record, [
        {
          kind: 'SUBTABLE_COLUMN',
          subtableFieldCode: 'not_exist',
          columnCode: 'x',
        },
      ]),
    ).not.toThrow();
  });

  test('returns the same record object (mutated in place)', () => {
    const record = {
      lookup_customer: { type: 'SINGLE_LINE_TEXT', value: '0001' },
    };
    const result = LookupTrigger.applyLookupTriggers(record, [
      { kind: 'FIELD', fieldCode: 'lookup_customer' },
    ]);
    expect(result).toBe(record);
  });

  test('handles an empty targets array', () => {
    const record = {
      lookup_customer: { type: 'SINGLE_LINE_TEXT', value: '0001' },
    };
    LookupTrigger.applyLookupTriggers(record, []);
    expect(record.lookup_customer.lookup).toBeUndefined();
  });
});
