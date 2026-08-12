const ViewFilterIndex = require('../js/lib/view-filter-index');

describe('ViewFilterIndex.indexFilterCondByViewId', () => {
  test('indexes filterCond by view id (as a string)', () => {
    const views = {
      一覧1: {
        id: '1102',
        type: 'LIST',
        filterCond: '更新日時 > "2012-01-01"',
      },
      一覧2: { id: '1103', type: 'LIST', filterCond: '' },
    };
    expect(ViewFilterIndex.indexFilterCondByViewId(views)).toEqual({
      1102: '更新日時 > "2012-01-01"',
      1103: '',
    });
  });

  test('treats a missing filterCond as an empty string', () => {
    const views = { 一覧1: { id: '1102', type: 'LIST' } };
    expect(ViewFilterIndex.indexFilterCondByViewId(views)).toEqual({
      1102: '',
    });
  });

  test('returns an empty object for empty/undefined/null input', () => {
    expect(ViewFilterIndex.indexFilterCondByViewId({})).toEqual({});
    expect(ViewFilterIndex.indexFilterCondByViewId(undefined)).toEqual({});
    expect(ViewFilterIndex.indexFilterCondByViewId(null)).toEqual({});
  });

  test('skips entries without an id (defensive, should not normally happen)', () => {
    const views = { 一覧1: { type: 'LIST', filterCond: 'x = 1' } };
    expect(ViewFilterIndex.indexFilterCondByViewId(views)).toEqual({});
  });
});
