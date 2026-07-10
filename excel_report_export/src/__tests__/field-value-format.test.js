const { formatFieldValue } = require('../js/lib/field-value-format');

describe('formatFieldValue: 文字列系フィールド', () => {
  test('SINGLE_LINE_TEXT / MULTI_LINE_TEXT / LINK はそのまま文字列を返す', () => {
    expect(
      formatFieldValue({ type: 'SINGLE_LINE_TEXT', value: 'サンプル' }),
    ).toBe('サンプル');
    expect(
      formatFieldValue({ type: 'MULTI_LINE_TEXT', value: '1行目\n2行目' }),
    ).toBe('1行目\n2行目');
    expect(
      formatFieldValue({ type: 'LINK', value: 'https://example.com' }),
    ).toBe('https://example.com');
  });

  test('RICH_TEXT はHTMLタグを取り除いたテキストを返す', () => {
    expect(
      formatFieldValue({
        type: 'RICH_TEXT',
        value: '<a href="x">サンプル</a>',
      }),
    ).toBe('サンプル');
    expect(
      formatFieldValue({
        type: 'RICH_TEXT',
        value: '<p>段落1</p><p>段落2</p>',
      }),
    ).toBe('段落1段落2');
  });
});

describe('formatFieldValue: 数値・計算フィールド', () => {
  test('NUMBER は数値型へ変換する', () => {
    expect(formatFieldValue({ type: 'NUMBER', value: '123' })).toBe(123);
    expect(formatFieldValue({ type: 'NUMBER', value: '-1.5' })).toBe(-1.5);
  });

  test('NUMBER の空文字列は空文字列のまま返す(Excel側で空セルにするため)', () => {
    expect(formatFieldValue({ type: 'NUMBER', value: '' })).toBe('');
  });

  test('CALC は数値として解釈できれば数値、できなければ文字列のまま返す', () => {
    expect(formatFieldValue({ type: 'CALC', value: '1234' })).toBe(1234);
    expect(formatFieldValue({ type: 'CALC', value: '11:30' })).toBe('11:30');
  });
});

describe('formatFieldValue: 日付・日時フィールド', () => {
  test('DATE は日付部分からDateオブジェクト(UTC 0時)を組み立てる', () => {
    const result = formatFieldValue({ type: 'DATE', value: '2026-07-09' });
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2026-07-09T00:00:00.000Z');
  });

  test('DATETIME / CREATED_TIME / UPDATED_TIME はISO文字列からDateオブジェクトを組み立てる', () => {
    const result = formatFieldValue({
      type: 'DATETIME',
      value: '2012-01-11T11:30:00Z',
    });
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2012-01-11T11:30:00.000Z');

    expect(
      formatFieldValue({
        type: 'CREATED_TIME',
        value: '2012-01-11T11:30:00Z',
      }).toISOString(),
    ).toBe('2012-01-11T11:30:00.000Z');
  });

  test('DATE / DATETIME が空値のときは空文字列を返す', () => {
    expect(formatFieldValue({ type: 'DATE', value: null })).toBe('');
    expect(formatFieldValue({ type: 'DATETIME', value: null })).toBe('');
  });

  test('TIME はそのまま文字列で返す', () => {
    expect(formatFieldValue({ type: 'TIME', value: '11:30' })).toBe('11:30');
  });
});

describe('formatFieldValue: 選択肢系フィールド', () => {
  test('RADIO_BUTTON / DROP_DOWN / STATUS はそのまま文字列を返す', () => {
    expect(formatFieldValue({ type: 'RADIO_BUTTON', value: '選択肢3' })).toBe(
      '選択肢3',
    );
    expect(formatFieldValue({ type: 'DROP_DOWN', value: '選択肢3' })).toBe(
      '選択肢3',
    );
    expect(formatFieldValue({ type: 'STATUS', value: '未処理' })).toBe(
      '未処理',
    );
  });

  test('DROP_DOWN の null(REST APIでの未選択時)は空文字列にする', () => {
    expect(formatFieldValue({ type: 'DROP_DOWN', value: null })).toBe('');
  });

  test('CHECK_BOX / MULTI_SELECT / CATEGORY は改行区切りで連結する', () => {
    expect(
      formatFieldValue({ type: 'CHECK_BOX', value: ['選択肢1', '選択肢2'] }),
    ).toBe('選択肢1\n選択肢2');
    expect(formatFieldValue({ type: 'MULTI_SELECT', value: ['A', 'B'] })).toBe(
      'A\nB',
    );
  });

  test('区切り文字はoptions.listSeparatorで変更できる', () => {
    expect(
      formatFieldValue(
        { type: 'CHECK_BOX', value: ['選択肢1', '選択肢2'] },
        { listSeparator: ', ' },
      ),
    ).toBe('選択肢1, 選択肢2');
  });
});

describe('formatFieldValue: ユーザー・組織系フィールド', () => {
  test('USER_SELECT / ORGANIZATION_SELECT / GROUP_SELECT / STATUS_ASSIGNEE は表示名を連結する', () => {
    const value = [
      { code: 'sato', name: 'Noboru Sato' },
      { code: 'kato', name: 'Misaki Kato' },
    ];
    expect(formatFieldValue({ type: 'USER_SELECT', value })).toBe(
      'Noboru Sato\nMisaki Kato',
    );
    expect(formatFieldValue({ type: 'STATUS_ASSIGNEE', value })).toBe(
      'Noboru Sato\nMisaki Kato',
    );
  });

  test('CREATOR / MODIFIER は表示名を1件返す', () => {
    expect(
      formatFieldValue({
        type: 'CREATOR',
        value: { code: 'sato', name: 'Noboru Sato' },
      }),
    ).toBe('Noboru Sato');
  });
});

describe('formatFieldValue: 非対応フィールド', () => {
  test('SUBTABLE / REFERENCE_TABLE / FILE / 装飾フィールドはnullを返す(別ロジックで扱うため)', () => {
    expect(formatFieldValue({ type: 'SUBTABLE', value: [] })).toBeNull();
    expect(
      formatFieldValue({ type: 'REFERENCE_TABLE', value: undefined }),
    ).toBeNull();
    expect(formatFieldValue({ type: 'FILE', value: [] })).toBeNull();
    expect(formatFieldValue({ type: 'GROUP', value: undefined })).toBeNull();
  });

  test('未知のtypeは値が文字列/数値ならそのまま、それ以外はnullを返す', () => {
    expect(formatFieldValue({ type: 'FUTURE_TYPE', value: 'text' })).toBe(
      'text',
    );
    expect(formatFieldValue({ type: 'FUTURE_TYPE', value: 42 })).toBe(42);
    expect(
      formatFieldValue({ type: 'FUTURE_TYPE', value: { a: 1 } }),
    ).toBeNull();
  });

  test('fieldがnull/undefinedのときは例外を投げずnullを返す', () => {
    expect(formatFieldValue(null)).toBeNull();
    expect(formatFieldValue(undefined)).toBeNull();
  });
});
