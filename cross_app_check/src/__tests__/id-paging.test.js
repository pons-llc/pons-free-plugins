const IdPaging = require('../js/lib/id-paging');

describe('buildPagedQuery', () => {
  test('1ページ目は$idの絞り込みを付けない', () => {
    expect(IdPaging.buildPagedQuery('', null, 500)).toBe(
      'order by $id asc limit 500',
    );
  });

  test('2ページ目以降は直前の最大$idで絞り込む', () => {
    expect(IdPaging.buildPagedQuery('', 500, 500)).toBe(
      '$id > 500 order by $id asc limit 500',
    );
  });

  test('設定した検索条件と$id条件をandでつなぐ', () => {
    expect(IdPaging.buildPagedQuery('提出日 >= "2026-04-01"', 100, 500)).toBe(
      '提出日 >= "2026-04-01" and $id > 100 order by $id asc limit 500',
    );
  });

  test('検索条件だけのときも order by が付く', () => {
    expect(IdPaging.buildPagedQuery('提出日 >= "2026-04-01"', null, 500)).toBe(
      '提出日 >= "2026-04-01" order by $id asc limit 500',
    );
  });

  test('ページサイズ未指定なら既定の500件', () => {
    expect(IdPaging.buildPagedQuery('', null)).toContain('limit 500');
    expect(IdPaging.DEFAULT_PAGE_SIZE).toBe(500);
  });
});

describe('nextMaxId', () => {
  test('取得したレコードの最大$idを返す', () => {
    expect(
      IdPaging.nextMaxId([
        { $id: { value: '3' } },
        { $id: { value: '10' } },
        { $id: { value: '7' } },
      ]),
    ).toBe(10);
  });

  test('空配列ならnull', () => {
    expect(IdPaging.nextMaxId([])).toBeNull();
    expect(IdPaging.nextMaxId(null)).toBeNull();
  });
});

describe('isLastPage', () => {
  test('ページサイズ未満なら最終ページ', () => {
    expect(IdPaging.isLastPage(new Array(499), 500)).toBe(true);
    expect(IdPaging.isLastPage([], 500)).toBe(true);
  });

  test('ページサイズちょうどならまだ続きがあるかもしれない', () => {
    expect(IdPaging.isLastPage(new Array(500), 500)).toBe(false);
  });
});
