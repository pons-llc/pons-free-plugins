const Meter = require('../js/lib/meter');

describe('Meter.compute', () => {
  test('computes percentage/level as ok below the warning threshold', () => {
    const result = Meter.compute(5000, 100000, 80, 100);
    expect(result.percentage).toBe(5);
    expect(result.roundedPercentage).toBe(5);
    expect(result.barWidthPercentage).toBe(5);
    expect(result.level).toBe('ok');
  });

  test('computes level as warning at/above the warning threshold', () => {
    const result = Meter.compute(80000, 100000, 80, 100);
    expect(result.percentage).toBe(80);
    expect(result.level).toBe('warning');
  });

  test('computes level as danger at/above the danger threshold', () => {
    const result = Meter.compute(100000, 100000, 80, 100);
    expect(result.percentage).toBe(100);
    expect(result.level).toBe('danger');
  });

  test('clamps the bar width to 100 when the budget is exceeded, but keeps the raw percentage', () => {
    const result = Meter.compute(150000, 100000, 80, 100);
    expect(result.percentage).toBe(150);
    expect(result.barWidthPercentage).toBe(100);
    expect(result.level).toBe('danger');
  });

  test('clamps the bar width to 0 for a negative sum (e.g. refunds), staying at level ok', () => {
    const result = Meter.compute(-500, 100000, 80, 100);
    expect(result.percentage).toBe(-0.5);
    expect(result.barWidthPercentage).toBe(0);
    expect(result.level).toBe('ok');
  });

  test('rounds the display percentage to 1 decimal place', () => {
    const result = Meter.compute(1234, 10000, 80, 100);
    expect(result.percentage).toBeCloseTo(12.34);
    expect(result.roundedPercentage).toBe(12.3);
  });

  test.each([0, -1000])(
    'throws when budget is not greater than 0 (%p)',
    (budget) => {
      expect(() => Meter.compute(100, budget, 80, 100)).toThrow();
    },
  );
});
