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

  test('本文中に書いたHTMLタグはエスケープされずそのまま反映される(信頼できるテンプレート)', () => {
    expect(
      resolveTemplate({
        body: '<b>{名前}</b>様、<a href="https://example.com">詳細</a>',
        valuesMap: { 名前: '田中' },
        targetFieldType: 'RICH_TEXT',
      }),
    ).toBe('<b>田中</b>様、<a href="https://example.com">詳細</a>');
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

  test('プレースホルダーの値に含まれるHTMLタグはエスケープされる(本文とは異なる扱い、XSS対策)', () => {
    expect(
      resolveTemplate({
        body: '入力値: {危険な値}',
        valuesMap: { 危険な値: '<img src=x onerror=alert(1)>' },
        targetFieldType: 'RICH_TEXT',
      }),
    ).toBe('入力値: &lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('escapeHtml', () => {
  test('主要なHTML特殊文字をエスケープする', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});
