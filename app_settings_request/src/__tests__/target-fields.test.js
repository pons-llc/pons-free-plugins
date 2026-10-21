const TargetFields = require('../js/lib/target-fields.js');

const properties = {
  ステータス: { type: 'STATUS', code: 'ステータス', label: 'ステータス' },
  title: { type: 'SINGLE_LINE_TEXT', code: 'title', label: '件名' },
  tbl: {
    type: 'SUBTABLE',
    code: 'tbl',
    label: '明細',
    fields: {
      item: { type: 'SINGLE_LINE_TEXT', code: 'item', label: '品名' },
      qty: { type: 'NUMBER', code: 'qty', label: '数量' },
    },
  },
  カテゴリー: { type: 'CATEGORY', code: 'カテゴリー', label: 'カテゴリー' },
  amount: { type: 'NUMBER', code: 'amount', label: '金額' },
};

describe('flattenFields', () => {
  test('ステータス・カテゴリーを除き、テーブル内のフィールドはテーブルの直後に並べる', () => {
    const items = TargetFields.flattenFields(properties);
    expect(items.map((i) => i.key)).toEqual([
      'title',
      'tbl',
      'tbl/item',
      'tbl/qty',
      'amount',
    ]);
    const qty = items.find((i) => i.key === 'tbl/qty');
    expect(qty).toMatchObject({
      code: 'qty',
      label: '数量',
      type: 'NUMBER',
      subtableCode: 'tbl',
      subtableLabel: '明細',
    });
    expect(qty.def).toBe(properties.tbl.fields.qty);
  });

  test('空・未定義でも空配列', () => {
    expect(TargetFields.flattenFields(undefined)).toEqual([]);
  });
});

describe('displayName', () => {
  test('ラベル(フィールドコード)、テーブル内は「テーブル名 > 」を前に付ける', () => {
    const items = TargetFields.flattenFields(properties);
    expect(TargetFields.displayName(items[0])).toBe('件名(title)');
    expect(TargetFields.displayName(items[2])).toBe('明細 > 品名(item)');
  });
});

describe('collectCodes', () => {
  test('テーブル内も含めたすべてのフィールドコード', () => {
    expect([...TargetFields.collectCodes(properties)].sort()).toEqual(
      [
        'amount',
        'item',
        'qty',
        'tbl',
        'title',
        'カテゴリー',
        'ステータス',
      ].sort(),
    );
  });
});

describe('findField', () => {
  test('テーブル外のフィールド', () => {
    expect(TargetFields.findField(properties, 'title', '')).toBe(
      properties.title,
    );
  });

  test('テーブル内のフィールド', () => {
    expect(TargetFields.findField(properties, 'item', 'tbl')).toBe(
      properties.tbl.fields.item,
    );
  });

  test('テーブル内のフィールドをテーブル外として探しても見つからない', () => {
    expect(TargetFields.findField(properties, 'item', '')).toBeNull();
  });

  test('存在しないテーブル・フィールド', () => {
    expect(TargetFields.findField(properties, 'item', 'nope')).toBeNull();
    expect(TargetFields.findField(properties, 'nope', '')).toBeNull();
    expect(TargetFields.findField(null, 'title', '')).toBeNull();
  });

  test('テーブルでないフィールドをテーブルとして指定しても見つからない', () => {
    expect(TargetFields.findField(properties, 'x', 'title')).toBeNull();
  });
});
