'use strict';

const RowFinder = require('../js/lib/row-finder');

const row = (id, colValue, extra) => ({
  id: String(id),
  value: {
    inspection_type: {
      type: 'DROP_DOWN',
      value: extra && extra.type ? extra.type : '',
    },
    inspection_date: {
      type: 'DATE',
      value: colValue === undefined ? '' : colValue,
    },
    result: {
      type: 'SINGLE_LINE_TEXT',
      value: extra && extra.result ? extra.result : '',
    },
  },
});

describe('RowFinder.getColumnValue', () => {
  test('returns the value of an existing column', () => {
    const r = row(1, '2024-01-01');
    expect(RowFinder.getColumnValue(r, 'inspection_date')).toBe('2024-01-01');
  });

  test('returns undefined for a missing column code', () => {
    const r = row(1, '2024-01-01');
    expect(RowFinder.getColumnValue(r, 'not_exist')).toBeUndefined();
  });

  test('returns undefined when row itself is null', () => {
    expect(RowFinder.getColumnValue(null, 'inspection_date')).toBeUndefined();
  });
});

describe('RowFinder.findMatchedRow', () => {
  test('returns null when there are no rows', () => {
    const result = RowFinder.findMatchedRow([], {
      mode: 'TOP_ROW',
    });
    expect(result).toBeNull();
  });

  test('TOP_ROW returns the first row regardless of direction', () => {
    const rows = [
      row(1, '2024-01-01'),
      row(2, '2024-02-01'),
      row(3, '2024-03-01'),
    ];
    const result = RowFinder.findMatchedRow(rows, {
      mode: 'TOP_ROW',
      direction: 'BOTTOM_TO_TOP',
    });
    expect(result).toBe(rows[0]);
  });

  test('BOTTOM_ROW returns the last row regardless of direction', () => {
    const rows = [
      row(1, '2024-01-01'),
      row(2, '2024-02-01'),
      row(3, '2024-03-01'),
    ];
    const result = RowFinder.findMatchedRow(rows, {
      mode: 'BOTTOM_ROW',
      direction: 'TOP_TO_BOTTOM',
    });
    expect(result).toBe(rows[2]);
  });

  describe('PARTIAL_MATCH', () => {
    const rows = [
      row(1, '2024-01-01', { type: '定期点検' }),
      row(2, '2024-02-01', { type: '臨時点検' }),
      row(3, '2024-03-01', { type: '定期点検' }),
    ];

    test('returns the first matching row when searching top to bottom', () => {
      const result = RowFinder.findMatchedRow(rows, {
        mode: 'PARTIAL_MATCH',
        conditionFieldCode: 'inspection_type',
        matchValue: '定期',
        direction: 'TOP_TO_BOTTOM',
      });
      expect(result).toBe(rows[0]);
    });

    test('returns the last matching row when searching bottom to top', () => {
      const result = RowFinder.findMatchedRow(rows, {
        mode: 'PARTIAL_MATCH',
        conditionFieldCode: 'inspection_type',
        matchValue: '定期',
        direction: 'BOTTOM_TO_TOP',
      });
      expect(result).toBe(rows[2]);
    });

    test('returns null when nothing matches', () => {
      const result = RowFinder.findMatchedRow(rows, {
        mode: 'PARTIAL_MATCH',
        conditionFieldCode: 'inspection_type',
        matchValue: '存在しない',
        direction: 'TOP_TO_BOTTOM',
      });
      expect(result).toBeNull();
    });
  });

  describe('EXACT_MATCH', () => {
    const rows = [
      row(1, '2024-01-01', { type: '定期点検' }),
      row(2, '2024-02-01', { type: '定期' }),
    ];

    test('requires an exact string match, not a partial one', () => {
      const result = RowFinder.findMatchedRow(rows, {
        mode: 'EXACT_MATCH',
        conditionFieldCode: 'inspection_type',
        matchValue: '定期',
        direction: 'TOP_TO_BOTTOM',
      });
      expect(result).toBe(rows[1]);
    });
  });

  describe('LATEST / OLDEST', () => {
    const rows = [
      row(1, '2024-01-15'),
      row(2, '2024-03-01'),
      row(3, '2024-02-10'),
      row(4, ''), // empty value must be skipped
    ];

    test('LATEST returns the row with the maximum value', () => {
      const result = RowFinder.findMatchedRow(rows, {
        mode: 'LATEST',
        conditionFieldCode: 'inspection_date',
        direction: 'TOP_TO_BOTTOM',
      });
      expect(result).toBe(rows[1]);
    });

    test('OLDEST returns the row with the minimum value', () => {
      const result = RowFinder.findMatchedRow(rows, {
        mode: 'OLDEST',
        conditionFieldCode: 'inspection_date',
        direction: 'TOP_TO_BOTTOM',
      });
      expect(result).toBe(rows[0]);
    });

    test('returns null when every row has an empty condition value', () => {
      const emptyRows = [row(1, ''), row(2, '')];
      const result = RowFinder.findMatchedRow(emptyRows, {
        mode: 'LATEST',
        conditionFieldCode: 'inspection_date',
        direction: 'TOP_TO_BOTTOM',
      });
      expect(result).toBeNull();
    });

    test('tie-break: TOP_TO_BOTTOM keeps the first row among equal values', () => {
      const tieRows = [
        row(1, '2024-05-01'),
        row(2, '2024-05-01'),
        row(3, '2024-01-01'),
      ];
      const result = RowFinder.findMatchedRow(tieRows, {
        mode: 'LATEST',
        conditionFieldCode: 'inspection_date',
        direction: 'TOP_TO_BOTTOM',
      });
      expect(result).toBe(tieRows[0]);
    });

    test('tie-break: BOTTOM_TO_TOP keeps the last row among equal values', () => {
      const tieRows = [
        row(1, '2024-05-01'),
        row(2, '2024-05-01'),
        row(3, '2024-01-01'),
      ];
      const result = RowFinder.findMatchedRow(tieRows, {
        mode: 'LATEST',
        conditionFieldCode: 'inspection_date',
        direction: 'BOTTOM_TO_TOP',
      });
      expect(result).toBe(tieRows[1]);
    });
  });

  test('unknown mode returns null instead of throwing', () => {
    const rows = [row(1, '2024-01-01')];
    const result = RowFinder.findMatchedRow(rows, { mode: 'NOT_A_MODE' });
    expect(result).toBeNull();
  });
});
