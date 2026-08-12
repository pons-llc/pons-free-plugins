const {
  formatDateOnly,
  formatDateTime,
  formatForFieldType,
} = require('../js/lib/kintone-date-format');

describe('formatDateOnly', () => {
  test('formats as YYYY-MM-DD using local date parts', () => {
    expect(formatDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  test('pads single-digit month/day', () => {
    expect(formatDateOnly(new Date(2026, 8, 9))).toBe('2026-09-09');
  });
});

describe('formatDateTime', () => {
  test('formats as ISO 8601 UTC without milliseconds', () => {
    const date = new Date(Date.UTC(2026, 0, 5, 9, 30, 0));
    expect(formatDateTime(date)).toBe('2026-01-05T09:30:00Z');
  });
});

describe('formatForFieldType', () => {
  test('uses date-only formatting for DATE fields', () => {
    expect(formatForFieldType(new Date(2026, 0, 5), 'DATE')).toBe('2026-01-05');
  });

  test('uses datetime formatting for DATETIME fields', () => {
    const date = new Date(Date.UTC(2026, 0, 5, 9, 30, 0));
    expect(formatForFieldType(date, 'DATETIME')).toBe('2026-01-05T09:30:00Z');
  });
});
