const SeriesFilterSort = require('../js/lib/series-filter-sort');

const series = () => [
  { label: 'B', displayValues: [10, 10] },
  { label: 'A', displayValues: [50, 50] },
  { label: 'C', displayValues: [5, 5] },
];

describe('SeriesFilterSort.filterVisibleSeries', () => {
  test('removes series whose label is in hiddenLabels', () => {
    const result = SeriesFilterSort.filterVisibleSeries(series(), ['A']);
    expect(result.map((s) => s.label)).toEqual(['B', 'C']);
  });

  test('returns everything when hiddenLabels is empty or undefined', () => {
    expect(SeriesFilterSort.filterVisibleSeries(series(), []).length).toBe(3);
    expect(
      SeriesFilterSort.filterVisibleSeries(series(), undefined).length,
    ).toBe(3);
  });

  test('preserves original order', () => {
    const result = SeriesFilterSort.filterVisibleSeries(series(), []);
    expect(result.map((s) => s.label)).toEqual(['B', 'A', 'C']);
  });
});

describe('SeriesFilterSort.sortSeries', () => {
  test('"original" (or unknown mode) keeps the given order', () => {
    expect(
      SeriesFilterSort.sortSeries(series(), 'original').map((s) => s.label),
    ).toEqual(['B', 'A', 'C']);
    expect(
      SeriesFilterSort.sortSeries(series(), undefined).map((s) => s.label),
    ).toEqual(['B', 'A', 'C']);
  });

  test('"label-asc" sorts by label', () => {
    expect(
      SeriesFilterSort.sortSeries(series(), 'label-asc').map((s) => s.label),
    ).toEqual(['A', 'B', 'C']);
  });

  test('"total-desc" sorts by the sum of displayValues, descending', () => {
    expect(
      SeriesFilterSort.sortSeries(series(), 'total-desc').map((s) => s.label),
    ).toEqual(['A', 'B', 'C']);
  });

  test('"total-asc" sorts by the sum of displayValues, ascending', () => {
    expect(
      SeriesFilterSort.sortSeries(series(), 'total-asc').map((s) => s.label),
    ).toEqual(['C', 'B', 'A']);
  });

  test('does not mutate the input array', () => {
    const input = series();
    SeriesFilterSort.sortSeries(input, 'label-asc');
    expect(input.map((s) => s.label)).toEqual(['B', 'A', 'C']);
  });
});
