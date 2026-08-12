const { capRecords, MAX_RECORDS } = require('../js/lib/record-cap');

describe('capRecords', () => {
  test('passes through records unchanged when under the cap', () => {
    const records = [1, 2, 3];
    const result = capRecords(records);
    expect(result.records).toEqual([1, 2, 3]);
    expect(result.total).toBe(3);
    expect(result.truncated).toBe(false);
  });

  test('truncates to MAX_RECORDS when over the cap and reports the true total', () => {
    const records = Array.from({ length: 150 }, (_, i) => i);
    const result = capRecords(records);
    expect(result.records).toHaveLength(MAX_RECORDS);
    expect(result.total).toBe(150);
    expect(result.truncated).toBe(true);
  });

  test('handles an empty array', () => {
    const result = capRecords([]);
    expect(result.records).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  test('handles exactly MAX_RECORDS without flagging truncation', () => {
    const records = Array.from({ length: MAX_RECORDS }, (_, i) => i);
    const result = capRecords(records);
    expect(result.records).toHaveLength(MAX_RECORDS);
    expect(result.truncated).toBe(false);
  });
});
