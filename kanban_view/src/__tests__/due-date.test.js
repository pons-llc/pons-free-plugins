const { formatDueDate, isOverdue } = require('../js/lib/due-date');

describe('formatDueDate', () => {
  test('returns a DATE value as-is', () => {
    expect(formatDueDate('2024-01-11')).toBe('2024-01-11');
  });

  test('converts a DATETIME value to its local calendar date', () => {
    // ローカルタイムゾーンでの日付部分になる(実行環境依存)。同じ変換で作った期待値と比較する。
    const value = '2024-01-11T11:30:00Z';
    const expected = (() => {
      const d = new Date(value);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    })();
    expect(formatDueDate(value)).toBe(expected);
  });

  test('returns an empty string for null/undefined/empty value', () => {
    expect(formatDueDate(null)).toBe('');
    expect(formatDueDate(undefined)).toBe('');
    expect(formatDueDate('')).toBe('');
  });
});

describe('isOverdue', () => {
  test('returns false when there is no due value', () => {
    expect(isOverdue(null, new Date(2024, 0, 15))).toBe(false);
  });

  test('returns true when the due date is strictly before "now"', () => {
    expect(isOverdue('2024-01-01', new Date(2024, 0, 15))).toBe(true);
  });

  test('returns false when the due date is today', () => {
    expect(isOverdue('2024-01-15', new Date(2024, 0, 15))).toBe(false);
  });

  test('returns false when the due date is in the future', () => {
    expect(isOverdue('2024-02-01', new Date(2024, 0, 15))).toBe(false);
  });

  test('works with a DATETIME value far in the past', () => {
    expect(isOverdue('2020-01-01T23:00:00Z', new Date(2024, 0, 15))).toBe(true);
  });

  test('defaults "now" to the current time when omitted', () => {
    expect(isOverdue('2000-01-01')).toBe(true);
  });
});
