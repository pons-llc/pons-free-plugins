const {
  resolveTemplate,
  escapeHtml,
} = require('../js/lib/placeholder-resolver.js');

describe('resolveTemplate (MULTI_LINE_TEXT)', () => {
  test('プレースホルダーを値に置換する', () => {
    expect(
      resolveTemplate({
        body: 'お世話になっております。{会社名}の{担当者名}です。',
        valuesMap: { 会社名: '株式会社サンプル', 担当者名: '山田' },
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('お世話になっております。株式会社サンプルの山田です。');
  });

  test('値マップに無いプレースホルダーはそのまま残す', () => {
    expect(
      resolveTemplate({
        body: '{不明なコード}',
        valuesMap: {},
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('{不明なコード}');
  });

  test('改行はそのまま保持する', () => {
    expect(
      resolveTemplate({
        body: '1行目\n{値}',
        valuesMap: { 値: '2行目' },
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('1行目\n2行目');
  });

  test('同じプレースホルダーが複数回出現しても全て置換する', () => {
    expect(
      resolveTemplate({
        body: '{名前}様、{名前}様',
        valuesMap: { 名前: '鈴木' },
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('鈴木様、鈴木様');
  });
});

describe('resolveTemplate (RICH_TEXT)', () => {
  test('置換された値はHTMLエスケープされる(XSS対策)', () => {
    expect(
      resolveTemplate({
        body: '入力値: {危険な値}',
        valuesMap: { 危険な値: '<script>alert(1)</script>' },
        targetFieldType: 'RICH_TEXT',
      }),
    ).toBe('入力値: &lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('本文中のHTML特殊文字もエスケープされる', () => {
    expect(
      resolveTemplate({
        body: 'A<B & C>D',
        valuesMap: {},
        targetFieldType: 'RICH_TEXT',
      }),
    ).toBe('A&lt;B &amp; C&gt;D');
  });

  test('改行は<br>に変換される(本文由来・値由来のどちらも)', () => {
    expect(
      resolveTemplate({
        body: '1行目\n{値}',
        valuesMap: { 値: '2行目\n3行目' },
        targetFieldType: 'RICH_TEXT',
      }),
    ).toBe('1行目<br>2行目<br>3行目');
  });

  test('本文中の{}はエスケープされずプレースホルダーとして機能する', () => {
    expect(
      resolveTemplate({
        body: '{名前}<br>のテスト',
        valuesMap: { 名前: '田中' },
        targetFieldType: 'RICH_TEXT',
      }),
    ).toBe('田中&lt;br&gt;のテスト');
  });
});

describe('escapeHtml', () => {
  test('主要なHTML特殊文字をエスケープする', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});
