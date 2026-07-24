const PagingQuery = require('../js/lib/paging-query');

describe('PagingQuery.buildFirstPageQuery', () => {
  test('with no base condition, only adds order by / limit', () => {
    expect(PagingQuery.buildFirstPageQuery('')).toBe(
      'order by $id asc limit 500',
    );
  });

  test('with a base condition, prefixes it before order by / limit', () => {
    expect(PagingQuery.buildFirstPageQuery('ステータス = "進行中"')).toBe(
      'ステータス = "進行中" order by $id asc limit 500',
    );
  });

  test('trims surrounding whitespace from the base condition', () => {
    expect(PagingQuery.buildFirstPageQuery('  ステータス = "進行中"  ')).toBe(
      'ステータス = "進行中" order by $id asc limit 500',
    );
  });
});

describe('PagingQuery.buildNextPageQuery', () => {
  test('with no base condition, only adds the $id > condition', () => {
    expect(PagingQuery.buildNextPageQuery('', 120)).toBe(
      '$id > 120 order by $id asc limit 500',
    );
  });

  test('with a base condition, combines it with the $id > condition using and, parenthesized', () => {
    expect(PagingQuery.buildNextPageQuery('ステータス = "進行中"', 120)).toBe(
      '(ステータス = "進行中") and $id > 120 order by $id asc limit 500',
    );
  });
});

describe('PagingQuery.PAGE_SIZE', () => {
  test('is 500 (GET /k/v1/records.json の1回の取得上限)', () => {
    expect(PagingQuery.PAGE_SIZE).toBe(500);
  });
});
