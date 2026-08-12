const Aggregator = require('../js/lib/aggregator');

const records = (values) => values.map((v) => ({ 金額: { value: v } }));

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

  test('sums negative values as-is (e.g. refunds/adjustments)', () => {
    expect(Aggregator.sum(records(['1000', '-300']), '金額')).toBe(700);
  });
});
