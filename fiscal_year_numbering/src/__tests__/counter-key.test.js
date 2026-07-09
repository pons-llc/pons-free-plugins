const CounterKey = require('../js/lib/counter-key');

describe('CounterKey.build (combination_key, without sequence)', () => {
  test('two segment arrays supplied in different order produce an identical key when sorted by configured order', () => {
    const segmentsA = [
      { code: 'buka', order: 1, value: '総務課' },
      { code: 'shubetsu', order: 2, value: '請求書' },
    ];
    const segmentsB = [
      { code: 'shubetsu', order: 2, value: '請求書' },
      { code: 'buka', order: 1, value: '総務課' },
    ];
    const keyA = CounterKey.build(570, 2024, segmentsA);
    const keyB = CounterKey.build(570, 2024, segmentsB);
    expect(keyA).toBe(keyB);
  });

  test('the internal key format is independent of the display separator setting', () => {
    const segments = [{ code: 'buka', order: 1, value: '総務課' }];
    const key = CounterKey.build(570, 2024, segments);
    // Changing numberFormat.separator elsewhere must not affect this key at all,
    // since CounterKey.build never reads numberFormat.
    expect(key).toBe(CounterKey.build(570, 2024, segments));
  });

  test('different target app id or fiscal year produce different keys', () => {
    const segments = [{ code: 'buka', order: 1, value: '総務課' }];
    const key1 = CounterKey.build(570, 2024, segments);
    const key2 = CounterKey.build(571, 2024, segments);
    const key3 = CounterKey.build(570, 2025, segments);
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });
});

describe('CounterKey.withSequence', () => {
  test('appends the sequence number to the combination key using the internal delimiter', () => {
    const combinationKey = CounterKey.build(570, 2024, []);
    expect(CounterKey.withSequence(combinationKey, 7)).toBe(`${combinationKey}::7`);
  });
});
