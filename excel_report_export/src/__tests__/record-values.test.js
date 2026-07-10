const {
  extractPlaceholderFieldCodes,
  buildFileNameValues,
} = require('../js/lib/record-values');

describe('extractPlaceholderFieldCodes', () => {
  test('テンプレート中の{フィールドコード}を重複なく抽出する', () => {
    expect(extractPlaceholderFieldCodes('{a}_{b}_{a}')).toEqual(['a', 'b']);
  });

  test('プレースホルダーがなければ空配列', () => {
    expect(extractPlaceholderFieldCodes('固定名')).toEqual([]);
  });

  test('テンプレートが空/未定義でも例外を投げない', () => {
    expect(extractPlaceholderFieldCodes('')).toEqual([]);
    expect(extractPlaceholderFieldCodes(undefined)).toEqual([]);
  });
});

describe('buildFileNameValues', () => {
  const record = {
    customer_name: { type: 'SINGLE_LINE_TEXT', value: '株式会社サンプル' },
    total: { type: 'NUMBER', value: '15400' },
    invoice_date: { type: 'DATE', value: '2026-07-09' },
    created_at: { type: 'DATETIME', value: '2026-07-09T01:02:03Z' },
  };

  test('文字列・数値フィールドはそのまま文字列化する', () => {
    const values = buildFileNameValues('{customer_name}_{total}', record);
    expect(values).toEqual({
      customer_name: '株式会社サンプル',
      total: '15400',
    });
  });

  test('DATEフィールドはYYYY-MM-DD形式の文字列にする', () => {
    const values = buildFileNameValues('{invoice_date}', record);
    expect(values).toEqual({ invoice_date: '2026-07-09' });
  });

  test('DATETIMEフィールドはYYYY-MM-DD形式の文字列にする(時刻部分はファイル名から省く)', () => {
    const values = buildFileNameValues('{created_at}', record);
    expect(values).toEqual({ created_at: '2026-07-09' });
  });

  test('レコードに存在しないフィールドコードは空文字列にする', () => {
    const values = buildFileNameValues('{nonexistent}', record);
    expect(values).toEqual({ nonexistent: '' });
  });

  test('recordがnull/undefinedでも例外を投げず空文字列を返す', () => {
    expect(buildFileNameValues('{customer_name}', null)).toEqual({
      customer_name: '',
    });
  });
});
