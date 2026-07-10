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

describe('PagingQuery.ALL_VIEW_ID', () => {
  test('is a stable sentinel string', () => {
    expect(PagingQuery.ALL_VIEW_ID).toBe('ALL');
  });
});

describe('PagingQuery.buildSelectableViews', () => {
  test('always includes the built-in "すべて" view first, since GET /k/v1/app/views.json omits it', () => {
    const apiViews = [{ id: '1102', name: '一覧1', type: 'LIST' }];
    const selectable = PagingQuery.buildSelectableViews(apiViews);
    expect(selectable[0]).toEqual({ id: 'ALL', name: 'すべて(デフォルト)' });
    expect(selectable[1]).toEqual({ id: '1102', name: '一覧1' });
  });

  test('filters out non-LIST views (CALENDAR / CUSTOM), since this plugin only targets table-style lists', () => {
    const apiViews = [
      { id: '1102', name: '一覧1', type: 'LIST' },
      { id: '1103', name: 'カレンダー', type: 'CALENDAR' },
      { id: '1104', name: 'カスタマイズ', type: 'CUSTOM' },
    ];
    const selectable = PagingQuery.buildSelectableViews(apiViews);
    expect(selectable).toHaveLength(2);
    expect(selectable.map((v) => v.id)).toEqual(['ALL', '1102']);
  });

  test('handles an empty or missing apiViews list', () => {
    expect(PagingQuery.buildSelectableViews([])).toHaveLength(1);
    expect(PagingQuery.buildSelectableViews(undefined)).toHaveLength(1);
  });
});

describe('PagingQuery.resolveViewConfig', () => {
  const apiViews = [{ id: '1102', name: '一覧1', type: 'LIST' }];
  const viewConfigs = [
    { viewId: 'ALL', startFieldCode: 'a' },
    { viewId: '1102', startFieldCode: 'b' },
  ];

  test('matches a configured view when event.viewId matches a view known to /app/views.json', () => {
    const result = PagingQuery.resolveViewConfig(1102, viewConfigs, apiViews);
    expect(result.startFieldCode).toBe('b');
  });

  test('falls back to the "ALL" (built-in default) config when event.viewId is not in /app/views.json', () => {
    // e.g. the built-in "すべて" view, which never appears in the API response.
    const result = PagingQuery.resolveViewConfig(20, viewConfigs, apiViews);
    expect(result.startFieldCode).toBe('a');
  });

  test('returns null when no matching config exists for the resolved view (not yet configured by an admin)', () => {
    const result = PagingQuery.resolveViewConfig(
      1102,
      [{ viewId: 'ALL', startFieldCode: 'a' }],
      apiViews,
    );
    expect(result).toBeNull();
  });

  test('coerces numeric event.viewId and string config viewId consistently', () => {
    const result = PagingQuery.resolveViewConfig('1102', viewConfigs, apiViews);
    expect(result.startFieldCode).toBe('b');
  });
});
