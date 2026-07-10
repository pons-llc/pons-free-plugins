const LimitGuard = require('../js/lib/limit-guard');

describe('LimitGuard.applyLimit', () => {
  test('keeps all rows and reports truncated:false when under the limit', () => {
    const rows = [1, 2, 3];
    const result = LimitGuard.applyLimit(rows, 300);
    expect(result).toEqual({
      rows: [1, 2, 3],
      max: 300,
      totalFetched: 3,
      keptCount: 3,
      truncated: false,
    });
  });

  test('truncates to the max and reports truncated:true when over the limit', () => {
    const rows = [1, 2, 3, 4, 5];
    const result = LimitGuard.applyLimit(rows, 3);
    expect(result.rows).toEqual([1, 2, 3]);
    expect(result.totalFetched).toBe(5);
    expect(result.keptCount).toBe(3);
    expect(result.truncated).toBe(true);
  });

  test('falls back to the default max when maxRows is not a positive number', () => {
    const rows = new Array(400).fill(0);
    const result = LimitGuard.applyLimit(rows, 0);
    expect(result.max).toBe(LimitGuard.DEFAULT_MAX_ROWS);
  });

  test('treats a missing rows argument as an empty array', () => {
    expect(LimitGuard.applyLimit(undefined, 10)).toMatchObject({
      rows: [],
      totalFetched: 0,
      keptCount: 0,
      truncated: false,
    });
  });
});

describe('LimitGuard.hasReachedLimit', () => {
  test('is false while at or below the limit', () => {
    expect(LimitGuard.hasReachedLimit(300, 300)).toBe(false);
    expect(LimitGuard.hasReachedLimit(299, 300)).toBe(false);
  });

  test('is true only once the count exceeds the limit', () => {
    expect(LimitGuard.hasReachedLimit(301, 300)).toBe(true);
  });
});
