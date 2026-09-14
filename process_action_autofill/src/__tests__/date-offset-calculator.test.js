const {
  computeInstantOffsetValue,
  computeFieldOffsetValue,
} = require('../js/lib/date-offset-calculator');

describe('computeInstantOffsetValue', () => {
  test('DATEフィールドへ日数を加算する(ローカル時刻の年月日を基準にする)', () => {
    // new Date(year, month, day, ...)はテスト実行環境のローカルタイムゾーンで解釈されるため、
    // 実行環境のタイムゾーンによらず「ローカルの3/10」を基準に計算できていることを確認できる。
    const instant = new Date(2024, 2, 10, 23, 0, 0); // ローカル時刻として3/10 23:00を表す
    expect(
      computeInstantOffsetValue(instant.getTime(), 'DATE', 3, 'DAYS'),
    ).toBe('2024-03-13');
  });

  test('DATEフィールドへ負のオフセット(過去)を適用する', () => {
    const instant = new Date(2024, 0, 1, 0, 0, 0); // 2024-01-01
    expect(
      computeInstantOffsetValue(instant.getTime(), 'DATE', -1, 'DAYS'),
    ).toBe('2023-12-31');
  });

  test('DATEフィールドでオフセット0は当日の日付になる', () => {
    const instant = new Date(2024, 5, 15, 10, 30, 0);
    expect(
      computeInstantOffsetValue(instant.getTime(), 'DATE', 0, 'DAYS'),
    ).toBe('2024-06-15');
  });

  test('DATETIMEフィールドへ分単位のオフセットを適用する(絶対時刻のためUTCでそのまま計算)', () => {
    const instantMs = new Date('2024-06-15T10:00:00Z').getTime();
    expect(
      computeInstantOffsetValue(instantMs, 'DATETIME', 90, 'MINUTES'),
    ).toBe('2024-06-15T11:30:00Z');
  });

  test('DATETIMEフィールドへ日数単位のオフセットを適用する', () => {
    const instantMs = new Date('2024-06-15T10:00:00Z').getTime();
    expect(computeInstantOffsetValue(instantMs, 'DATETIME', 1, 'DAYS')).toBe(
      '2024-06-16T10:00:00Z',
    );
  });

  test('DATETIMEの結果はミリ秒を含まないISO8601になる', () => {
    const instantMs = new Date('2024-06-15T10:00:00.123Z').getTime();
    expect(computeInstantOffsetValue(instantMs, 'DATETIME', 0, 'MINUTES')).toBe(
      '2024-06-15T10:00:00Z',
    );
  });

  test('magnitudeが数値でない場合はnullを返す', () => {
    expect(
      computeInstantOffsetValue(Date.now(), 'DATE', NaN, 'DAYS'),
    ).toBeNull();
    expect(
      computeInstantOffsetValue(Date.now(), 'DATE', undefined, 'DAYS'),
    ).toBeNull();
  });

  test('対応外のtargetFieldTypeはnullを返す', () => {
    expect(
      computeInstantOffsetValue(Date.now(), 'SINGLE_LINE_TEXT', 1, 'DAYS'),
    ).toBeNull();
  });

  test('instantMsが不正な数値の場合はnullを返す', () => {
    expect(computeInstantOffsetValue(NaN, 'DATE', 1, 'DAYS')).toBeNull();
  });
});

describe('computeFieldOffsetValue', () => {
  test('DATE型の基準値へ日数を加算する(タイムゾーンなしのUTC演算)', () => {
    expect(computeFieldOffsetValue('2024-01-15', 'DATE', 5, 'DAYS')).toBe(
      '2024-01-20',
    );
  });

  test('DATE型の基準値へ負のオフセットを適用する', () => {
    expect(computeFieldOffsetValue('2024-01-01', 'DATE', -1, 'DAYS')).toBe(
      '2023-12-31',
    );
  });

  test('DATETIME型の基準値へ分単位のオフセットを適用する', () => {
    expect(
      computeFieldOffsetValue(
        '2024-06-15T10:00:00Z',
        'DATETIME',
        90,
        'MINUTES',
      ),
    ).toBe('2024-06-15T11:30:00Z');
  });

  test('DATETIME型の基準値へ日数単位のオフセットを適用する', () => {
    expect(
      computeFieldOffsetValue('2024-06-15T10:00:00Z', 'DATETIME', 1, 'DAYS'),
    ).toBe('2024-06-16T10:00:00Z');
  });

  test('基準値が空の場合はnullを返す', () => {
    expect(computeFieldOffsetValue('', 'DATE', 1, 'DAYS')).toBeNull();
    expect(
      computeFieldOffsetValue(undefined, 'DATETIME', 1, 'DAYS'),
    ).toBeNull();
    expect(computeFieldOffsetValue(null, 'DATE', 1, 'DAYS')).toBeNull();
  });

  test('magnitudeが数値でない場合はnullを返す', () => {
    expect(
      computeFieldOffsetValue('2024-01-15', 'DATE', NaN, 'DAYS'),
    ).toBeNull();
  });

  test('不正な日付文字列の場合はnullを返す', () => {
    expect(computeFieldOffsetValue('not-a-date', 'DATE', 1, 'DAYS')).toBeNull();
  });

  test('対応外のbaseFieldTypeはnullを返す', () => {
    expect(computeFieldOffsetValue('123', 'NUMBER', 1, 'DAYS')).toBeNull();
  });
});
