const { expandSubtableRows } = require('../js/lib/subtable-layout');

const config = (overrides) =>
  Object.assign(
    {
      sheetName: '明細',
      startRow: 6,
      maxRows: 4,
      columns: [
        { column: 'A', fieldCode: 'item_name' },
        { column: 'B', fieldCode: 'quantity' },
        { column: 'C', fieldCode: 'unit_price' },
      ],
    },
    overrides,
  );

const row = (itemName, quantity, unitPrice) => ({
  id: String(Math.random()),
  value: {
    item_name: { type: 'SINGLE_LINE_TEXT', value: itemName },
    quantity: { type: 'NUMBER', value: String(quantity) },
    unit_price: { type: 'NUMBER', value: String(unitPrice) },
  },
});

describe('expandSubtableRows: 正常系', () => {
  test('行数分のセル書き込み指示を、開始行からの連番で生成する', () => {
    const rows = [row('商品A', 2, 100), row('商品B', 1, 200)];
    const result = expandSubtableRows(config(), rows);

    expect(result.writes).toEqual([
      { sheetName: '明細', cellAddress: 'A6', value: '商品A' },
      { sheetName: '明細', cellAddress: 'B6', value: 2 },
      { sheetName: '明細', cellAddress: 'C6', value: 100 },
      { sheetName: '明細', cellAddress: 'A7', value: '商品B' },
      { sheetName: '明細', cellAddress: 'B7', value: 1 },
      { sheetName: '明細', cellAddress: 'C7', value: 200 },
    ]);
    expect(result.writtenRowCount).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.truncatedCount).toBe(0);
  });

  test('行が0件なら書き込みも0件', () => {
    const result = expandSubtableRows(config(), []);
    expect(result.writes).toEqual([]);
    expect(result.writtenRowCount).toBe(0);
    expect(result.truncated).toBe(false);
  });

  test('列マッピングに存在しないフィールドコードを指定した行は無視して他の列は書き込む', () => {
    const result = expandSubtableRows(
      config({ columns: [{ column: 'A', fieldCode: 'nonexistent' }] }),
      [row('商品A', 2, 100)],
    );
    // formatFieldValueにフィールドが存在しない場合はnullを返す(=空文字で書き込む)
    expect(result.writes).toEqual([
      { sheetName: '明細', cellAddress: 'A6', value: '' },
    ]);
  });
});

describe('expandSubtableRows: 行数上限', () => {
  test('maxRowsを超える行は切り捨て、truncatedフラグを立てる', () => {
    const rows = [
      row('A', 1, 1),
      row('B', 2, 2),
      row('C', 3, 3),
      row('D', 4, 4),
      row('E', 5, 5),
    ];
    const result = expandSubtableRows(config({ maxRows: 4 }), rows);

    expect(result.writtenRowCount).toBe(4);
    expect(result.truncated).toBe(true);
    expect(result.truncatedCount).toBe(1);
    // 最後の行(E)のセルが含まれていないこと
    expect(result.writes.some((w) => w.value === 'E')).toBe(false);
  });

  test('maxRowsちょうどの行数なら切り捨てなし', () => {
    const rows = [row('A', 1, 1), row('B', 2, 2)];
    const result = expandSubtableRows(config({ maxRows: 2 }), rows);
    expect(result.truncated).toBe(false);
    expect(result.truncatedCount).toBe(0);
  });
});

describe('expandSubtableRows: 入力異常への耐性', () => {
  test('rowsがnull/undefinedでも例外を投げず0件として扱う', () => {
    expect(expandSubtableRows(config(), null).writes).toEqual([]);
    expect(expandSubtableRows(config(), undefined).writes).toEqual([]);
  });

  test('startRowが1未満など不正な設定は例外を投げる', () => {
    expect(() =>
      expandSubtableRows(config({ startRow: 0 }), [row('A', 1, 1)]),
    ).toThrow();
  });
});
