const {
  applyDayDrag,
  applyWeekDrag,
  buildUpdateRecord,
  formatGroupValue,
} = require('../js/lib/drag-update');

const evt = {
  start: new Date(Date.UTC(2026, 7, 10, 9, 0, 0)),
  end: new Date(Date.UTC(2026, 7, 10, 10, 0, 0)),
  groupKey: 'alice',
};

describe('applyDayDrag', () => {
  test('shifts start/end by deltaMinutes while preserving duration', () => {
    const result = applyDayDrag(evt, 30);
    expect(result.start.toISOString()).toBe('2026-08-10T09:30:00.000Z');
    expect(result.end.toISOString()).toBe('2026-08-10T10:30:00.000Z');
  });

  test('keeps the original groupKey when no new group is given', () => {
    const result = applyDayDrag(evt, 0);
    expect(result.groupKey).toBe('alice');
  });

  test('updates groupKey when a new group is given (including falsy empty string)', () => {
    expect(applyDayDrag(evt, 0, 'bob').groupKey).toBe('bob');
    expect(applyDayDrag(evt, 0, '').groupKey).toBe('');
  });
});

describe('applyWeekDrag', () => {
  test('shifts start/end by whole days while preserving time-of-day and duration', () => {
    const result = applyWeekDrag(evt, 2);
    expect(result.start.toISOString()).toBe('2026-08-12T09:00:00.000Z');
    expect(result.end.toISOString()).toBe('2026-08-12T10:00:00.000Z');
  });

  test('supports negative deltas (moving earlier)', () => {
    const result = applyWeekDrag(evt, -1);
    expect(result.start.toISOString()).toBe('2026-08-09T09:00:00.000Z');
  });
});

describe('buildUpdateRecord', () => {
  const formFields = {
    start: { type: 'DATETIME' },
    end: { type: 'DATETIME' },
    start_date: { type: 'DATE' },
    assignee: { type: 'DROP_DOWN' },
  };

  test('builds start/end field values formatted per field type', () => {
    const config = { startFieldCode: 'start', endFieldCode: 'end' };
    const result = applyDayDrag(evt, 30);
    const record = buildUpdateRecord(config, formFields, result);
    expect(record).toEqual({
      start: { value: '2026-08-10T09:30:00Z' },
      end: { value: '2026-08-10T10:30:00Z' },
    });
  });

  test('omits the end field when endFieldCode is not configured', () => {
    const config = { startFieldCode: 'start' };
    const record = buildUpdateRecord(config, formFields, applyDayDrag(evt, 0));
    expect(record.end).toBeUndefined();
  });

  test('includes the group field value when groupFieldCode and newGroupValue are given', () => {
    const config = { startFieldCode: 'start', groupFieldCode: 'assignee' };
    const record = buildUpdateRecord(
      config,
      formFields,
      applyDayDrag(evt, 0),
      'bob',
    );
    expect(record.assignee).toEqual({ value: 'bob' });
  });

  test('formats a DATE-typed start field as YYYY-MM-DD', () => {
    const config = { startFieldCode: 'start_date' };
    const result = applyWeekDrag(evt, 1);
    const record = buildUpdateRecord(config, formFields, result);
    expect(record.start_date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatGroupValue', () => {
  test('wraps a code in a [{code}] array for USER_SELECT/ORGANIZATION_SELECT/GROUP_SELECT', () => {
    expect(formatGroupValue('alice', 'USER_SELECT')).toEqual([
      { code: 'alice' },
    ]);
    expect(formatGroupValue('org1', 'ORGANIZATION_SELECT')).toEqual([
      { code: 'org1' },
    ]);
    expect(formatGroupValue('grp1', 'GROUP_SELECT')).toEqual([
      { code: 'grp1' },
    ]);
  });

  test('returns an empty array for an empty groupKey on select types', () => {
    expect(formatGroupValue('', 'USER_SELECT')).toEqual([]);
  });

  test('returns the raw string for DROP_DOWN/RADIO_BUTTON', () => {
    expect(formatGroupValue('todo', 'DROP_DOWN')).toBe('todo');
    expect(formatGroupValue('', 'RADIO_BUTTON')).toBe('');
  });
});
