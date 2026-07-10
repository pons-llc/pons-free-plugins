const { validateMapping, buildCellWrites } = require('../js/lib/cell-mapping');

const mapping = (overrides) =>
  Object.assign(
    { sheetName: '請求書', cellAddress: 'B2', fieldCode: 'customer_name' },
    overrides,
  );

describe('validateMapping: 正常系', () => {
  test('空配列は有効(未設定状態)', () => {
    expect(validateMapping([])).toEqual({ valid: true, errors: [] });
  });

  test('シート名・セル番地・フィールドコードが揃っていれば有効', () => {
    const result = validateMapping([mapping()]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('同じセル番地でもシートが異なれば重複とみなさない', () => {
    const result = validateMapping([
      mapping({ sheetName: '請求書', cellAddress: 'B2' }),
      mapping({ sheetName: '明細', cellAddress: 'B2' }),
    ]);
    expect(result.valid).toBe(true);
  });
});

describe('validateMapping: 異常系', () => {
  test('シート名が空文字ならエラー', () => {
    const result = validateMapping([mapping({ sheetName: '' })]);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      { index: 0, message: 'シート名を入力してください。' },
    ]);
  });

  test('セル番地が不正な形式ならエラー', () => {
    const result = validateMapping([mapping({ cellAddress: 'B2:C3' })]);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      { index: 0, message: 'セル番地の形式が不正です(例: B2): B2:C3' },
    ]);
  });

  test('フィールドコードが空文字ならエラー', () => {
    const result = validateMapping([mapping({ fieldCode: '' })]);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      { index: 0, message: 'フィールドコードを入力してください。' },
    ]);
  });

  test('同一シート内でセル番地が重複していればエラー', () => {
    const result = validateMapping([
      mapping({ sheetName: '請求書', cellAddress: 'B2', fieldCode: 'a' }),
      mapping({ sheetName: '請求書', cellAddress: 'B2', fieldCode: 'b' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      {
        index: 1,
        message: 'シート「請求書」のセルB2は他の行と重複しています。',
      },
    ]);
  });

  test('複数行に複数のエラーがある場合、すべて報告する', () => {
    const result = validateMapping([
      mapping({ sheetName: '' }),
      mapping({ cellAddress: 'bad' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].index).toBe(0);
    expect(result.errors[1].index).toBe(1);
  });
});

describe('buildCellWrites: マッピング定義+レコード → 書き込み命令リスト', () => {
  const record = {
    customer_name: { type: 'SINGLE_LINE_TEXT', value: '株式会社サンプル' },
    total: { type: 'NUMBER', value: '15400' },
    memo: { type: 'MULTI_LINE_TEXT', value: '備考テキスト' },
  };

  test('各マッピング行のフィールド値を書き込み命令へ変換する', () => {
    const writes = buildCellWrites(
      [
        { sheetName: '請求書', cellAddress: 'B2', fieldCode: 'customer_name' },
        { sheetName: '請求書', cellAddress: 'E2', fieldCode: 'total' },
      ],
      record,
    );
    expect(writes).toEqual([
      { sheetName: '請求書', cellAddress: 'B2', value: '株式会社サンプル' },
      { sheetName: '請求書', cellAddress: 'E2', value: 15400 },
    ]);
  });

  test('レコードに存在しないフィールドコードを指定した行は空文字列を書き込む', () => {
    const writes = buildCellWrites(
      [{ sheetName: '請求書', cellAddress: 'B2', fieldCode: 'nonexistent' }],
      record,
    );
    expect(writes).toEqual([
      { sheetName: '請求書', cellAddress: 'B2', value: '' },
    ]);
  });

  test('マッピングが空配列なら書き込みも空配列', () => {
    expect(buildCellWrites([], record)).toEqual([]);
  });

  test('不正なマッピング行(バリデーションエラーになる行)は書き込みから除外する', () => {
    const writes = buildCellWrites(
      [
        { sheetName: '', cellAddress: 'B2', fieldCode: 'customer_name' },
        { sheetName: '請求書', cellAddress: 'E2', fieldCode: 'total' },
      ],
      record,
    );
    expect(writes).toEqual([
      { sheetName: '請求書', cellAddress: 'E2', value: 15400 },
    ]);
  });
});
