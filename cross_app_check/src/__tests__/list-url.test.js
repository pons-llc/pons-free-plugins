const ListUrl = require('../js/lib/list-url');

// 実際に検証環境で確認したURLの形をもとにしたケース。
// 公式ドキュメント「URL内のクエリで、表示するレコードの条件を指定する」も参照。
const ENCODED_QUERY =
  '%E5%AE%9B%E5%90%8D%E7%95%AA%E5%8F%B7%20%3D%20%22A-001%22';
const DECODED_QUERY = '宛名番号 = "A-001"';

describe('parse — アプリID', () => {
  test('素の一覧URLからアプリIDを取る', () => {
    const result = ListUrl.parse('https://sample.cybozu.com/k/677/');
    expect(result.ok).toBe(true);
    expect(result.appId).toBe('677');
    expect(result.query).toBe('');
    expect(result.viewId).toBe('');
  });

  test('末尾スラッシュが無くても取れる', () => {
    expect(ListUrl.parse('https://sample.cybozu.com/k/677').appId).toBe('677');
  });

  test('ゲストスペースのアプリでも取れる', () => {
    const result = ListUrl.parse('https://sample.cybozu.com/k/guest/5/677/');
    expect(result.ok).toBe(true);
    expect(result.appId).toBe('677');
  });

  test('前後の空白は無視する', () => {
    expect(ListUrl.parse('  https://sample.cybozu.com/k/677/  ').appId).toBe(
      '677',
    );
  });

  test('レコード詳細画面のURLでもアプリIDは取れる', () => {
    expect(
      ListUrl.parse('https://sample.cybozu.com/k/677/show#record=12').appId,
    ).toBe('677');
  });
});

describe('parse — 絞り込みクエリ', () => {
  test('?query= をデコードして取り出す', () => {
    const result = ListUrl.parse(
      `https://sample.cybozu.com/k/677/?query=${ENCODED_QUERY}`,
    );
    expect(result.ok).toBe(true);
    expect(result.appId).toBe('677');
    expect(result.query).toBe(DECODED_QUERY);
  });

  test('?q= でも取り出せる', () => {
    const result = ListUrl.parse(
      `https://sample.cybozu.com/k/677/?q=${ENCODED_QUERY}`,
    );
    expect(result.query).toBe(DECODED_QUERY);
  });

  test('view と query が両方あるときは両方取れる', () => {
    const result = ListUrl.parse(
      `https://sample.cybozu.com/k/677/?view=13464079&query=${ENCODED_QUERY}`,
    );
    expect(result.viewId).toBe('13464079');
    expect(result.query).toBe(DECODED_QUERY);
  });

  test('クエリ中の + はプラス記号のまま保持する(空白に変換しない)', () => {
    const result = ListUrl.parse(
      'https://sample.cybozu.com/k/677/?query=%E9%87%91%E9%A1%8D%20%3E%201%2B2',
    );
    expect(result.query).toBe('金額 > 1+2');
  });

  test('不正なパーセントエンコードでも例外を投げない', () => {
    const result = ListUrl.parse(
      'https://sample.cybozu.com/k/677/?query=%E3%81',
    );
    expect(result.ok).toBe(true);
    expect(typeof result.query).toBe('string');
  });
});

describe('parse — 一覧ID', () => {
  test('?view= から一覧IDを取る', () => {
    const result = ListUrl.parse(
      'https://sample.cybozu.com/k/677/?view=13464079',
    );
    expect(result.viewId).toBe('13464079');
    expect(result.query).toBe('');
  });

  test('数字でない view は無視する', () => {
    expect(
      ListUrl.parse('https://sample.cybozu.com/k/677/?view=abc').viewId,
    ).toBe('');
  });
});

describe('parse — 受け付けられない入力', () => {
  test('空文字は理由付きで弾く', () => {
    const result = ListUrl.parse('');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('URLを貼り付けて');
  });

  test('null/undefinedでも落ちない', () => {
    expect(ListUrl.parse(null).ok).toBe(false);
    expect(ListUrl.parse(undefined).ok).toBe(false);
  });

  test('kintoneの一覧URLでなければ理由付きで弾く', () => {
    const result = ListUrl.parse('https://example.com/foo/bar');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('/k/アプリID/');
  });

  test('アプリIDが数字でないURLは弾く', () => {
    expect(ListUrl.parse('https://sample.cybozu.com/k/abc/').ok).toBe(false);
  });
});

describe('combineQuery', () => {
  test('一覧の条件とURLのクエリをANDでつなぐ', () => {
    expect(ListUrl.combineQuery('ステータス in ("完了")', '金額 > 100')).toBe(
      '(ステータス in ("完了")) and (金額 > 100)',
    );
  });

  test('片方だけならそのまま使う', () => {
    expect(ListUrl.combineQuery('金額 > 100', '')).toBe('金額 > 100');
    expect(ListUrl.combineQuery('', '金額 > 100')).toBe('金額 > 100');
    expect(ListUrl.combineQuery('  ', '金額 > 100')).toBe('金額 > 100');
  });

  test('どちらも無ければ空文字(全件対象)', () => {
    expect(ListUrl.combineQuery('', '')).toBe('');
    expect(ListUrl.combineQuery(null, undefined)).toBe('');
  });
});

describe('describe', () => {
  test('条件があればそのまま見せる', () => {
    expect(ListUrl.describe('金額 > 100')).toBe('金額 > 100');
  });

  test('条件が無ければ全件対象と伝える', () => {
    expect(ListUrl.describe('')).toBe('(絞り込みなし・全レコードが対象)');
    expect(ListUrl.describe(null)).toBe('(絞り込みなし・全レコードが対象)');
  });
});
