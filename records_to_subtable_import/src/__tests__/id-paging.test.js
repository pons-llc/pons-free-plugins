const IdPaging = require('../js/lib/id-paging');

describe('IdPaging.buildPagedQuery', () => {
  test('the first page (lastMaxId is null) has no $id clause', () => {
    expect(IdPaging.buildPagedQuery('status = "対応中"', null, 500)).toBe(
      'status = "対応中" order by $id asc limit 500',
    );
  });

  test('subsequent pages add a $id > lastMaxId clause', () => {
    expect(IdPaging.buildPagedQuery('status = "対応中"', 120, 500)).toBe(
      'status = "対応中" and $id > 120 order by $id asc limit 500',
    );
  });

  test('an empty base query still produces a valid query with just the $id clause', () => {
    expect(IdPaging.buildPagedQuery('', 5, 500)).toBe(
      '$id > 5 order by $id asc limit 500',
    );
  });

  test('an empty base query and no lastMaxId produces just the order/limit clause', () => {
    expect(IdPaging.buildPagedQuery('', null, 500)).toBe(
      'order by $id asc limit 500',
    );
  });

  test('defaults the page size to 500 when omitted', () => {
    expect(IdPaging.buildPagedQuery('', null)).toBe(
      'order by $id asc limit 500',
    );
  });
});

describe('IdPaging.nextMaxId', () => {
  test('returns the largest $id among the given records', () => {
    const records = [
      { $id: { value: '3' } },
      { $id: { value: '10' } },
      { $id: { value: '7' } },
    ];
    expect(IdPaging.nextMaxId(records)).toBe(10);
  });

  test('returns null for an empty array', () => {
    expect(IdPaging.nextMaxId([])).toBeNull();
  });

  test('returns null when records is null/undefined', () => {
    expect(IdPaging.nextMaxId(null)).toBeNull();
    expect(IdPaging.nextMaxId(undefined)).toBeNull();
  });
});

describe('IdPaging.isLastPage', () => {
  test('a page with fewer records than the page size is the last page', () => {
    expect(IdPaging.isLastPage(new Array(10), 500)).toBe(true);
  });

  test('a full page is not the last page', () => {
    expect(IdPaging.isLastPage(new Array(500), 500)).toBe(false);
  });

  test('an empty/null result is treated as the last page', () => {
    expect(IdPaging.isLastPage([], 500)).toBe(true);
    expect(IdPaging.isLastPage(null, 500)).toBe(true);
  });
});
