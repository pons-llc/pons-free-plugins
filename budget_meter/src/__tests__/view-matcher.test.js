const ViewMatcher = require('../js/lib/view-matcher');

describe('ViewMatcher.matchRowsForView', () => {
  const rows = [
    { viewId: '1102', targetFieldCode: 'a', budget: 1000 },
    { viewId: '1102', targetFieldCode: 'b', budget: 2000 },
    { viewId: '1103', targetFieldCode: 'c', budget: 3000 },
  ];

  test('returns all rows whose viewId matches (string comparison)', () => {
    expect(ViewMatcher.matchRowsForView(rows, '1102')).toHaveLength(2);
  });

  test('compares across string/number type mismatch (event.viewId is numeric)', () => {
    expect(ViewMatcher.matchRowsForView(rows, 1102)).toHaveLength(2);
  });

  test('returns an empty array when no row matches', () => {
    expect(ViewMatcher.matchRowsForView(rows, '9999')).toEqual([]);
  });

  test('returns an empty array for an empty/undefined rows list', () => {
    expect(ViewMatcher.matchRowsForView([], '1102')).toEqual([]);
    expect(ViewMatcher.matchRowsForView(undefined, '1102')).toEqual([]);
  });

  test('returns an empty array when viewId is null/undefined', () => {
    expect(ViewMatcher.matchRowsForView(rows, null)).toEqual([]);
    expect(ViewMatcher.matchRowsForView(rows, undefined)).toEqual([]);
  });
});
