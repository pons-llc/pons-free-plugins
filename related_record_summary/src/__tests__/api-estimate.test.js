const ApiEstimate = require('../js/lib/api-estimate');

describe('ApiEstimate.compute', () => {
  test('computes exact-multiple cases with no remainder', () => {
    // 1000件 × 2フィールド ÷ 500 = 4回、書き戻し 1000 ÷ 100 = 10回
    expect(ApiEstimate.compute(1000, 2)).toEqual({
      readCalls: 4,
      writeCalls: 10,
      totalCalls: 14,
    });
  });

  test('rounds up a fractional read/write call count (ceiling, not floor)', () => {
    // 501件 × 1フィールド ÷ 500 = 1.002 → 切り上げ2回、書き戻し 501 ÷ 100 = 5.01 → 6回
    expect(ApiEstimate.compute(501, 1)).toEqual({
      readCalls: 2,
      writeCalls: 6,
      totalCalls: 8,
    });
  });

  test('returns all zeros when there are no target records', () => {
    expect(ApiEstimate.compute(0, 3)).toEqual({
      readCalls: 0,
      writeCalls: 0,
      totalCalls: 0,
    });
  });

  test('returns zero read calls when there are no aggregation settings', () => {
    expect(ApiEstimate.compute(100, 0)).toEqual({
      readCalls: 0,
      writeCalls: 1,
      totalCalls: 1,
    });
  });
});

describe('ApiEstimate.buildMessage', () => {
  test('includes the target record count, setting count, and totals in the message', () => {
    const message = ApiEstimate.buildMessage(1000, 2);
    expect(message).toContain('対象レコード数: 1000件');
    expect(message).toContain('集計設定数: 2件');
    expect(message).toContain('約4回');
    expect(message).toContain('約10回');
    expect(message).toContain('約14回');
  });
});
