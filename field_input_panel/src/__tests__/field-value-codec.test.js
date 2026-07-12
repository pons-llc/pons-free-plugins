const FieldValueCodec = require('../js/lib/field-value-codec');

describe('decodeFieldValue', () => {
  test.each([
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'NUMBER',
    'LINK',
    'RADIO_BUTTON',
    'DROP_DOWN',
    'DATE',
    'TIME',
  ])('%s: 値ありはvalueを文字列で返す', (type) => {
    expect(FieldValueCodec.decodeFieldValue(type, { type, value: 'abc' })).toBe(
      'abc',
    );
  });

  test.each([
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'NUMBER',
    'LINK',
    'RADIO_BUTTON',
    'DROP_DOWN',
    'DATE',
    'TIME',
  ])('%s: フィールド値がundefinedのときは空文字列', (type) => {
    expect(FieldValueCodec.decodeFieldValue(type, undefined)).toBe('');
  });

  test.each(['CHECK_BOX', 'MULTI_SELECT'])(
    '%s: 配列の値をコピーして返す',
    (type) => {
      const original = ['a', 'b'];
      const decoded = FieldValueCodec.decodeFieldValue(type, {
        type,
        value: original,
      });
      expect(decoded).toEqual(['a', 'b']);
      expect(decoded).not.toBe(original);
    },
  );

  test.each(['CHECK_BOX', 'MULTI_SELECT'])(
    '%s: 値が無い場合は空配列',
    (type) => {
      expect(FieldValueCodec.decodeFieldValue(type, undefined)).toEqual([]);
    },
  );

  test('DATETIME: UTC文字列をdatetime-local形式に変換する', () => {
    const decoded = FieldValueCodec.decodeFieldValue('DATETIME', {
      type: 'DATETIME',
      value: '2012-01-11T11:30:00Z',
    });
    expect(decoded).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test('DATETIME: 値が無い場合は空文字列', () => {
    expect(FieldValueCodec.decodeFieldValue('DATETIME', undefined)).toBe('');
  });
});

describe('encodeFieldValue', () => {
  test.each(['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT', 'NUMBER', 'LINK'])(
    '%s: 入力値をそのまま返す',
    (type) => {
      expect(FieldValueCodec.encodeFieldValue(type, 'abc')).toBe('abc');
    },
  );

  test.each(['SINGLE_LINE_TEXT', 'NUMBER'])(
    '%s: 空文字列はそのまま空文字列(数値は空文字列で空を表せる)',
    (type) => {
      expect(FieldValueCodec.encodeFieldValue(type, '')).toBe('');
    },
  );

  test.each(['CHECK_BOX', 'MULTI_SELECT'])(
    '%s: 配列をコピーして返す',
    (type) => {
      const original = ['x'];
      const encoded = FieldValueCodec.encodeFieldValue(type, original);
      expect(encoded).toEqual(['x']);
      expect(encoded).not.toBe(original);
    },
  );

  test.each(['CHECK_BOX', 'MULTI_SELECT'])(
    '%s: 配列でない値は空配列にフォールバック',
    (type) => {
      expect(FieldValueCodec.encodeFieldValue(type, undefined)).toEqual([]);
    },
  );

  test.each(['DATE', 'TIME'])('%s: 空文字列はnullに変換する', (type) => {
    expect(FieldValueCodec.encodeFieldValue(type, '')).toBeNull();
  });

  test.each(['DATE', 'TIME'])('%s: 値ありはそのまま返す', (type) => {
    expect(FieldValueCodec.encodeFieldValue(type, '2012-01-11')).toBe(
      '2012-01-11',
    );
  });

  test('DATETIME: 空文字列はnullに変換する', () => {
    expect(FieldValueCodec.encodeFieldValue('DATETIME', '')).toBeNull();
  });

  test('DATETIME: datetime-local形式をUTCのISO8601(秒00・Z終端)に変換する', () => {
    const encoded = FieldValueCodec.encodeFieldValue(
      'DATETIME',
      '2012-01-11T11:30',
    );
    expect(encoded).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
  });
});

describe('DATETIMEの往復変換', () => {
  test('decodeFieldValue -> encodeFieldValue で元のUTC値(秒00)に戻る', () => {
    const original = '2012-01-11T11:30:00Z';
    const local = FieldValueCodec.decodeFieldValue('DATETIME', {
      type: 'DATETIME',
      value: original,
    });
    const restored = FieldValueCodec.encodeFieldValue('DATETIME', local);
    expect(restored).toBe(original);
  });

  test('年またぎ・日またぎの値でも往復変換できる', () => {
    const original = '2024-12-31T23:59:00Z';
    const local = FieldValueCodec.decodeFieldValue('DATETIME', {
      type: 'DATETIME',
      value: original,
    });
    const restored = FieldValueCodec.encodeFieldValue('DATETIME', local);
    expect(restored).toBe(original);
  });
});
