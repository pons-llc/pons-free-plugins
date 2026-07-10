const Aggregator = require('../js/lib/aggregator');

const records = (values) => values.map((v) => ({ 金額: { value: v } }));

describe('Aggregator.count', () => {
  test('returns the number of records', () => {
    expect(Aggregator.count(records(['1', '2', '3']))).toBe(3);
  });

  test('returns 0 for an empty array', () => {
    expect(Aggregator.count([])).toBe(0);
  });
});

describe('Aggregator.sum', () => {
  test('sums the numeric field values', () => {
    expect(Aggregator.sum(records(['1000', '2500', '500']), '金額')).toBe(4000);
  });

  test('treats an empty array as 0', () => {
    expect(Aggregator.sum([], '金額')).toBe(0);
  });

  test('ignores blank/non-numeric values rather than producing NaN', () => {
    expect(Aggregator.sum(records(['100', '', '200']), '金額')).toBe(300);
  });

  test('treats a missing field on a record as excluded (not 0-with-count)', () => {
    const withMissing = [{ 金額: { value: '100' } }, {}];
    expect(Aggregator.sum(withMissing, '金額')).toBe(100);
  });
});

describe('Aggregator.average', () => {
  test('averages the numeric field values', () => {
    expect(Aggregator.average(records(['10', '20', '30']), '金額')).toBe(20);
  });

  test('returns 0 for an empty array rather than dividing by zero', () => {
    expect(Aggregator.average([], '金額')).toBe(0);
  });

  test('excludes blank values from both the sum and the denominator', () => {
    // (10 + 30) / 2 = 20, not (10 + 0 + 30) / 3
    expect(Aggregator.average(records(['10', '', '30']), '金額')).toBe(20);
  });
});

describe('Aggregator.aggregate', () => {
  test('dispatches to count/sum/average based on summaryType', () => {
    const rs = records(['10', '20']);
    expect(Aggregator.aggregate(rs, 'COUNT', '金額')).toBe(2);
    expect(Aggregator.aggregate(rs, 'SUM', '金額')).toBe(30);
    expect(Aggregator.aggregate(rs, 'AVERAGE', '金額')).toBe(15);
  });

  test('throws for an unsupported summary type', () => {
    expect(() => Aggregator.aggregate([], 'MEDIAN', '金額')).toThrow();
  });
});
