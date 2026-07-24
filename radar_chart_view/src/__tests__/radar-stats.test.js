const RadarStats = require('../js/lib/radar-stats');

describe('RadarStats.toDisplayValues', () => {
  const series = [
    { label: 'A', values: [30, 3, 15], count: 2 },
    { label: 'B', values: [100, 10, 50], count: 1 },
  ];

  test('mode "sum" passes values through unchanged', () => {
    const result = RadarStats.toDisplayValues(series, 'sum');
    expect(result[0].displayValues).toEqual([30, 3, 15]);
    expect(result[1].displayValues).toEqual([100, 10, 50]);
  });

  test('mode "avg" divides by count', () => {
    const result = RadarStats.toDisplayValues(series, 'avg');
    expect(result[0].displayValues).toEqual([15, 1.5, 7.5]);
    expect(result[1].displayValues).toEqual([100, 10, 50]);
  });

  test('does not mutate the original values array', () => {
    const result = RadarStats.toDisplayValues(series, 'avg');
    expect(result[0].values).toEqual([30, 3, 15]);
    expect(series[0].values).toEqual([30, 3, 15]);
  });

  test('guards against division by zero when count is 0', () => {
    const result = RadarStats.toDisplayValues(
      [{ label: 'Z', values: [10], count: 0 }],
      'avg',
    );
    expect(result[0].displayValues).toEqual([10]);
  });

  test('passes badges through unchanged (used as on-card chips, not affected by sum/avg)', () => {
    const result = RadarStats.toDisplayValues(
      [{ label: 'A', badges: ['田中', 'A'], values: [1], count: 1 }],
      'sum',
    );
    expect(result[0].badges).toEqual(['田中', 'A']);
  });

  test('defaults badges to an empty array when the series has none (field grouping)', () => {
    const result = RadarStats.toDisplayValues(
      [{ label: 'B', values: [1], count: 2 }],
      'sum',
    );
    expect(result[0].badges).toEqual([]);
  });
});

describe('RadarStats.computeMaxValue', () => {
  test('returns the largest displayValue across all series and axes', () => {
    const series = RadarStats.toDisplayValues(
      [
        { label: 'A', values: [30, 3, 15], count: 1 },
        { label: 'B', values: [100, 10, 50], count: 1 },
      ],
      'sum',
    );
    expect(RadarStats.computeMaxValue(series)).toBe(100);
  });

  test('returns 1 (not 0) when all series are empty or all-zero, to avoid division by zero downstream', () => {
    const series = RadarStats.toDisplayValues(
      [{ label: 'A', values: [0, 0], count: 1 }],
      'sum',
    );
    expect(RadarStats.computeMaxValue(series)).toBe(1);
    expect(RadarStats.computeMaxValue([])).toBe(1);
  });
});

describe('RadarStats.isAggregationToggleRelevant', () => {
  test('is false when every series has count 1 (record grouping)', () => {
    const series = [
      { label: 'A', values: [1], count: 1 },
      { label: 'B', values: [2], count: 1 },
    ];
    expect(RadarStats.isAggregationToggleRelevant(series)).toBe(false);
  });

  test('is true when any series has count > 1 (field grouping with multiple members)', () => {
    const series = [
      { label: 'A', values: [1], count: 3 },
      { label: 'B', values: [2], count: 1 },
    ];
    expect(RadarStats.isAggregationToggleRelevant(series)).toBe(true);
  });
});
