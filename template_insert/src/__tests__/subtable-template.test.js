const { buildRepeatedTemplateText } = require('../js/lib/subtable-template.js');

describe('buildRepeatedTemplateText (MULTI_LINE_TEXT)', () => {
  test('行ごとに展開し改行で連結する', () => {
    expect(
      buildRepeatedTemplateText({
        body: '・{品名}({数量}個)',
        rowValuesMaps: [
          { 品名: 'りんご', 数量: '3' },
          { 品名: 'みかん', 数量: '5' },
        ],
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('・りんご(3個)\n・みかん(5個)');
  });

  test('行が0件のときは空文字列を返す', () => {
    expect(
      buildRepeatedTemplateText({
        body: '・{品名}',
        rowValuesMaps: [],
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('');
  });

  test('行が1件のときはその1行分のみを返す(区切り文字を含まない)', () => {
    expect(
      buildRepeatedTemplateText({
        body: '{品名}',
        rowValuesMaps: [{ 品名: 'りんご' }],
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('りんご');
  });
});

describe('buildRepeatedTemplateText (RICH_TEXT)', () => {
  test('行ごとに展開し<br>で連結し、値はHTMLエスケープされる', () => {
    expect(
      buildRepeatedTemplateText({
        body: '{品名}',
        rowValuesMaps: [{ 品名: '<b>りんご</b>' }, { 品名: 'みかん' }],
        targetFieldType: 'RICH_TEXT',
      }),
    ).toBe('&lt;b&gt;りんご&lt;/b&gt;<br>みかん');
  });
});
