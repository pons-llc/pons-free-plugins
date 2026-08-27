const {
  extractPlaceholderCodes,
  resolveBlockTableCode,
  resolveTemplateBody,
} = require('../js/lib/template-body-resolver.js');

const fieldCatalog = {
  customer_name: { type: 'SINGLE_LINE_TEXT', subtableFieldCode: null },
  items: { type: 'SUBTABLE', subtableFieldCode: null },
  item_name: { type: 'SINGLE_LINE_TEXT', subtableFieldCode: 'items' },
  remarks: { type: 'MULTI_LINE_TEXT', subtableFieldCode: 'items' },
  other_table: { type: 'SUBTABLE', subtableFieldCode: null },
  other_col: { type: 'SINGLE_LINE_TEXT', subtableFieldCode: 'other_table' },
};

describe('extractPlaceholderCodes', () => {
  test('本文中の全プレースホルダーのコードを抽出する', () => {
    expect(extractPlaceholderCodes('{品名}様　備考:{備考}')).toEqual([
      '品名',
      '備考',
    ]);
  });

  test('プレースホルダーが無ければ空配列を返す', () => {
    expect(extractPlaceholderCodes('プレースホルダーなし')).toEqual([]);
  });
});

describe('resolveBlockTableCode', () => {
  test('ブロック内のコードが単一のテーブルの列を指す場合、そのテーブルコードを返す', () => {
    expect(
      resolveBlockTableCode('{item_name}様　備考:{remarks}', fieldCatalog),
    ).toBe('items');
  });

  test('テーブル列への参照が無い場合はnullを返す(トップレベルのみ)', () => {
    expect(resolveBlockTableCode('{customer_name}様', fieldCatalog)).toBeNull();
  });

  test('複数の異なるテーブルにまたがって参照している場合はnullを返す', () => {
    expect(
      resolveBlockTableCode('{item_name} {other_col}', fieldCatalog),
    ).toBeNull();
  });

  test('プレースホルダーが1つも無い場合はnullを返す', () => {
    expect(resolveBlockTableCode('固定テキストのみ', fieldCatalog)).toBeNull();
  });
});

describe('resolveTemplateBody', () => {
  test('[[ ]]を含まない本文はresolveTemplateと同じくプレースホルダーを解決する', () => {
    expect(
      resolveTemplateBody({
        body: 'こんにちは、{customer_name}様',
        fieldCatalog,
        outerValuesMap: { customer_name: '株式会社サンプル' },
        rowColumnMapsByTable: {},
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('こんにちは、株式会社サンプル様');
  });

  test('ユーザー指定の例: [[{カラム1}様　備考:{備考}]]が行ごとに展開される', () => {
    const result = resolveTemplateBody({
      body: '[[{item_name}様　備考:{remarks}]]',
      fieldCatalog,
      outerValuesMap: {},
      rowColumnMapsByTable: {
        items: [
          { item_name: '田中', remarks: '至急' },
          { item_name: '鈴木', remarks: '' },
        ],
      },
      targetFieldType: 'MULTI_LINE_TEXT',
    });
    expect(result).toBe('田中様　備考:至急\n鈴木様　備考:');
  });

  test('ブロックの前後の通常テキストと組み合わせられる', () => {
    const result = resolveTemplateBody({
      body: '見積内容:\n[[・{item_name}\n]]以上、よろしくお願いいたします。',
      fieldCatalog,
      outerValuesMap: {},
      rowColumnMapsByTable: {
        items: [{ item_name: '商品A' }, { item_name: '商品B' }],
      },
      targetFieldType: 'MULTI_LINE_TEXT',
    });
    expect(result).toBe(
      '見積内容:\n・商品A\n\n・商品B\n以上、よろしくお願いいたします。',
    );
  });

  test('複数の[[ ]]ブロック(異なるテーブル)をそれぞれ正しく展開する', () => {
    const result = resolveTemplateBody({
      body: '明細A: [[{item_name}]] / 明細B: [[{other_col}]]',
      fieldCatalog,
      outerValuesMap: {},
      rowColumnMapsByTable: {
        items: [{ item_name: 'X' }, { item_name: 'Y' }],
        other_table: [{ other_col: 'Z' }],
      },
      targetFieldType: 'MULTI_LINE_TEXT',
    });
    expect(result).toBe('明細A: X\nY / 明細B: Z');
  });

  test('対象テーブルが一意に決まらないブロックは[[ ]]を含めてそのまま残す', () => {
    const result = resolveTemplateBody({
      body: 'あいまいな例: [[{customer_name}]]',
      fieldCatalog,
      outerValuesMap: { customer_name: '株式会社サンプル' },
      rowColumnMapsByTable: {},
      targetFieldType: 'MULTI_LINE_TEXT',
    });
    expect(result).toBe('あいまいな例: [[{customer_name}]]');
  });

  test('対象テーブルの行が0件の場合、ブロックは空文字列になり前後のテキストは残る', () => {
    const result = resolveTemplateBody({
      body: '明細:\n[[・{item_name}]]\n以上',
      fieldCatalog,
      outerValuesMap: {},
      rowColumnMapsByTable: { items: [] },
      targetFieldType: 'MULTI_LINE_TEXT',
    });
    expect(result).toBe('明細:\n\n以上');
  });

  test('RICH_TEXT挿入先では、本文のHTMLタグ(ブロック内外とも)はそのまま反映され、プレースホルダーの値だけHTMLエスケープされる', () => {
    const result = resolveTemplateBody({
      body: '<b>明細</b>\n[[{item_name}<i>強調</i>]]',
      fieldCatalog,
      outerValuesMap: {},
      rowColumnMapsByTable: {
        items: [{ item_name: '<script>alert(1)</script>' }],
      },
      targetFieldType: 'RICH_TEXT',
    });
    expect(result).toBe(
      '<b>明細</b><br>&lt;script&gt;alert(1)&lt;/script&gt;<i>強調</i>',
    );
  });

  test('bodyが空文字列/undefinedでも例外にならない', () => {
    expect(
      resolveTemplateBody({
        body: undefined,
        fieldCatalog,
        outerValuesMap: {},
        rowColumnMapsByTable: {},
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('');
  });
});
