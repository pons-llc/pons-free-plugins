const QueryUrl = require('../js/lib/query-url.js');

const ORIGIN = 'https://example.cybozu.com';

describe('parseListUrl', () => {
  test('一覧画面のURL(絞り込み・ソートつき)から、アプリIDと読み込み用のパスを取り出す', () => {
    const url = `${ORIGIN}/k/791/?view=20&q=f13466487%20%3D%20%2215%22#sort_0=f13466487&order_0=desc&size=20`;
    expect(QueryUrl.parseListUrl(url, ORIGIN)).toEqual({
      ok: true,
      appId: '791',
      guestSpaceId: '',
      viewId: '20',
      src: '/k/791/?view=20&q=f13466487%20%3D%20%2215%22#sort_0=f13466487&order_0=desc&size=20',
    });
  });

  test('ゲストスペースのアプリ', () => {
    const r = QueryUrl.parseListUrl(`${ORIGIN}/k/guest/5/791/?view=3`, ORIGIN);
    expect(r).toMatchObject({
      ok: true,
      appId: '791',
      guestSpaceId: '5',
      viewId: '3',
    });
    expect(r.src).toBe('/k/guest/5/791/?view=3');
  });

  test('?query= 形式(フィールドコードのクエリ)もそのまま使える', () => {
    const r = QueryUrl.parseListUrl(
      `${ORIGIN}/k/791/?query=kind%20in%20(%22B%22)`,
      ORIGIN,
    );
    expect(r).toMatchObject({ ok: true, appId: '791', viewId: '' });
  });

  test('前後の空白は無視する', () => {
    expect(QueryUrl.parseListUrl(`  ${ORIGIN}/k/791/  `, ORIGIN).ok).toBe(true);
  });

  test('別のドメイン・kintone以外のパス・詳細画面のURLは不可(任意のページをiframeで開かない)', () => {
    expect(
      QueryUrl.parseListUrl('https://evil.example.com/k/791/', ORIGIN).ok,
    ).toBe(false);
    expect(
      QueryUrl.parseListUrl(`${ORIGIN}/k/791/show#record=1`, ORIGIN).ok,
    ).toBe(false);
    expect(QueryUrl.parseListUrl(`${ORIGIN}/k/admin/app/791/`, ORIGIN).ok).toBe(
      false,
    );
    expect(QueryUrl.parseListUrl('javascript:alert(1)', ORIGIN).ok).toBe(false);
    expect(QueryUrl.parseListUrl('', ORIGIN).ok).toBe(false);
    expect(QueryUrl.parseListUrl('not a url', ORIGIN).ok).toBe(false);
  });
});

describe('splitQuery', () => {
  test('kintone.app.getQuery()の結果から並び順を取り出し、limit/offsetは捨てる', () => {
    expect(
      QueryUrl.splitQuery(
        'amount = "15" order by amount desc limit 100 offset 0',
      ),
    ).toEqual({ filterCond: 'amount = "15"', sort: 'amount desc' });
  });

  test('複数の並び順', () => {
    expect(
      QueryUrl.splitQuery(
        'kind in ("B") order by amount desc, レコード番号 asc limit 20 offset 40',
      ),
    ).toEqual({
      filterCond: 'kind in ("B")',
      sort: 'amount desc, レコード番号 asc',
    });
  });

  test('条件・並び順なし', () => {
    expect(QueryUrl.splitQuery('limit 100 offset 0')).toEqual({
      filterCond: '',
      sort: '',
    });
    expect(
      QueryUrl.splitQuery('order by amount asc limit 100 offset 0'),
    ).toEqual({
      filterCond: '',
      sort: 'amount asc',
    });
  });

  test('文字列の値の中の「order by」「limit」は区切りとみなさない', () => {
    expect(
      QueryUrl.splitQuery(
        'title like "x order by y limit 1" order by title asc limit 100 offset 0',
      ),
    ).toEqual({
      filterCond: 'title like "x order by y limit 1"',
      sort: 'title asc',
    });
  });

  test('エスケープされたダブルクォートを含む値', () => {
    expect(
      QueryUrl.splitQuery('title = "a\\" order by b" limit 100 offset 0'),
    ).toEqual({ filterCond: 'title = "a\\" order by b"', sort: '' });
  });
});
