const RecordModel = require('../js/lib/record-model');

const record = (id, start, end) => ({
  $id: { type: '__ID__', value: String(id) },
  start_date: { type: 'DATE', value: start },
  end_date: { type: 'DATE', value: end },
});

describe('RecordModel.buildRows', () => {
  const config = { startFieldCode: 'start_date', endFieldCode: 'end_date' };

  test('a record with both start and end dates becomes a scheduled row', () => {
    const rows = RecordModel.buildRows(
      [record(1, '2026-07-01', '2026-07-05')],
      config,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].isUnscheduled).toBe(false);
    expect(rows[0].isEndInferred).toBe(false);
    expect(rows[0].startDate.getFullYear()).toBe(2026);
    expect(rows[0].endDate.getDate()).toBe(5);
    expect(rows[0].recordId).toBe('1');
  });

  test('a record with a start date but no end date gets a 1-day bar (end inferred = start)', () => {
    const rows = RecordModel.buildRows([record(2, '2026-07-10', '')], config);
    expect(rows[0].isUnscheduled).toBe(false);
    expect(rows[0].isEndInferred).toBe(true);
    expect(rows[0].startDate.getTime()).toBe(rows[0].endDate.getTime());
  });

  test('a record with no start date is marked unscheduled regardless of end date', () => {
    const rows = RecordModel.buildRows([record(3, '', '2026-07-20')], config);
    expect(rows[0].isUnscheduled).toBe(true);
  });

  test('a record with neither start nor end date is unscheduled', () => {
    const rows = RecordModel.buildRows([record(4, '', '')], config);
    expect(rows[0].isUnscheduled).toBe(true);
    expect(rows[0].startDate).toBeNull();
  });

  test('an unparsable date value is treated as missing rather than throwing', () => {
    const rows = RecordModel.buildRows(
      [record(5, 'not-a-date', '2026-07-20')],
      config,
    );
    expect(rows[0].isUnscheduled).toBe(true);
  });

  test('missing field codes in config produce all-unscheduled rows without throwing', () => {
    const rows = RecordModel.buildRows(
      [record(6, '2026-07-01', '2026-07-05')],
      {
        startFieldCode: '',
        endFieldCode: '',
      },
    );
    expect(rows[0].isUnscheduled).toBe(true);
  });

  test('DATETIME values (ISO 8601 with time) are parsed correctly', () => {
    const rec = {
      $id: { value: '7' },
      start_date: { value: '2026-07-01T09:00:00Z' },
      end_date: { value: '2026-07-02T18:00:00Z' },
    };
    const rows = RecordModel.buildRows([rec], config);
    expect(rows[0].isUnscheduled).toBe(false);
    expect(rows[0].startDate.getUTCDate()).toBe(1);
  });

  test('preserves the original record reference for downstream use (grouping/coloring/labels)', () => {
    const rec = record(8, '2026-07-01', '2026-07-05');
    const rows = RecordModel.buildRows([rec], config);
    expect(rows[0].record).toBe(rec);
  });
});

describe('RecordModel.parseDateValue', () => {
  test('empty/null/undefined all return null', () => {
    expect(RecordModel.parseDateValue('')).toBeNull();
    expect(RecordModel.parseDateValue(null)).toBeNull();
    expect(RecordModel.parseDateValue(undefined)).toBeNull();
  });

  test('invalid string returns null', () => {
    expect(RecordModel.parseDateValue('foo')).toBeNull();
  });

  test('valid date string returns a Date instance', () => {
    expect(RecordModel.parseDateValue('2026-01-01')).toBeInstanceOf(Date);
  });
});
