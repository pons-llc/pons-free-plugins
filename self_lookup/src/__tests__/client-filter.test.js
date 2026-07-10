'use strict';

const ClientFilter = require('../js/lib/client-filter');

const selfRecord = {
  event_date: { type: 'DATE', value: '2024-07-09' },
};

const record = (id, dateValue) => ({
  $id: { type: '__ID__', value: String(id) },
  event_date: { type: 'DATE', value: dateValue },
});

describe('ClientFilter.pickMatchedRecord', () => {
  test('returns the first candidate when there are no client-only conditions', () => {
    const candidates = [record(1, '2024-01-01'), record(2, '2024-02-01')];
    const result = ClientFilter.pickMatchedRecord(
      candidates,
      { conditions: [] },
      selfRecord,
    );
    expect(result).toBe(candidates[0]);
  });

  test('SAME_MONTH picks the first candidate whose month matches the compared value', () => {
    const candidates = [
      record(1, '2024-01-15'),
      record(2, '2019-07-01'),
      record(3, '2024-07-20'),
    ];
    const lookup = {
      conditions: [
        {
          fieldCode: 'event_date',
          operator: 'SAME_MONTH',
          valueSource: 'SELF_FIELD',
          selfFieldCode: 'event_date',
        },
      ],
    };
    const result = ClientFilter.pickMatchedRecord(
      candidates,
      lookup,
      selfRecord,
    );
    expect(result).toBe(candidates[1]);
  });

  test('SAME_DAY picks the first candidate whose day-of-month matches the compared value', () => {
    const candidates = [
      record(1, '2024-01-01'),
      record(2, '2019-03-09'),
      record(3, '2024-07-09'),
    ];
    const lookup = {
      conditions: [
        {
          fieldCode: 'event_date',
          operator: 'SAME_DAY',
          valueSource: 'SELF_FIELD',
          selfFieldCode: 'event_date',
        },
      ],
    };
    const result = ClientFilter.pickMatchedRecord(
      candidates,
      lookup,
      selfRecord,
    );
    expect(result).toBe(candidates[1]);
  });

  test('returns null when no candidate satisfies the client-only conditions', () => {
    const candidates = [record(1, '2024-01-01'), record(2, '2024-02-02')];
    const lookup = {
      conditions: [
        {
          fieldCode: 'event_date',
          operator: 'SAME_DAY',
          valueSource: 'FIXED',
          value: '2024-09-30',
        },
      ],
    };
    const result = ClientFilter.pickMatchedRecord(
      candidates,
      lookup,
      selfRecord,
    );
    expect(result).toBeNull();
  });

  test('returns null when the candidate list is empty', () => {
    expect(
      ClientFilter.pickMatchedRecord([], { conditions: [] }, selfRecord),
    ).toBeNull();
  });

  test('combines multiple client-only conditions with AND', () => {
    const candidates = [
      record(1, '2024-01-09'),
      record(2, '2019-07-01'),
      record(3, '2024-07-09'),
    ];
    const lookup = {
      conditions: [
        {
          fieldCode: 'event_date',
          operator: 'SAME_MONTH',
          valueSource: 'SELF_FIELD',
          selfFieldCode: 'event_date',
        },
        {
          fieldCode: 'event_date',
          operator: 'SAME_DAY',
          valueSource: 'SELF_FIELD',
          selfFieldCode: 'event_date',
        },
      ],
    };
    const result = ClientFilter.pickMatchedRecord(
      candidates,
      lookup,
      selfRecord,
    );
    expect(result).toBe(candidates[2]);
  });
});
