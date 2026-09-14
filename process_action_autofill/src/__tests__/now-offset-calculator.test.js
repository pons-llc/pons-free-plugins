const { computeNowOffsetValue } = require('../js/lib/now-offset-calculator');

describe('computeNowOffsetValue', () => {
  test('DATEフィールドへ日数を加算する(ローカル時刻の年月日を基準にする)', () => {
    // new Date(year, month, day, ...)はテスト実行環境のローカルタイムゾーンで解釈されるため、
    // 実行環境のタイムゾーンによらず「ローカルの3/10」を基準に計算できていることを確認できる。
    const now = new Date(2024, 2, 10, 23, 0, 0); // ローカル時刻として3/10 23:00を表す
    expect(computeNowOffsetValue(now, 'DATE', 3, 'DAYS')).toBe('2024-03-13');
  });

  test('DATEフィールドへ負のオフセット(過去)を適用する', () => {
    const now = new Date(2024, 0, 1, 0, 0, 0); // 2024-01-01
    expect(computeNowOffsetValue(now, 'DATE', -1, 'DAYS')).toBe('2023-12-31');
  });

  test('DATEフィールドでオフセット0は当日の日付になる', () => {
    const now = new Date(2024, 5, 15, 10, 30, 0);
    expect(computeNowOffsetValue(now, 'DATE', 0, 'DAYS')).toBe('2024-06-15');
  });

  test('DATETIMEフィールドへ分単位のオフセットを適用する(絶対時刻のためUTCでそのまま計算)', () => {
    const now = new Date('2024-06-15T10:00:00Z');
    expect(computeNowOffsetValue(now, 'DATETIME', 90, 'MINUTES')).toBe(
      '2024-06-15T11:30:00Z',
    );
  });

  test('DATETIMEフィールドへ日数単位のオフセットを適用する', () => {
    const now = new Date('2024-06-15T10:00:00Z');
    expect(computeNowOffsetValue(now, 'DATETIME', 1, 'DAYS')).toBe(
      '2024-06-16T10:00:00Z',
    );
  });

  test('DATETIMEの結果はミリ秒を含まないISO8601になる', () => {
    const now = new Date('2024-06-15T10:00:00.123Z');
    expect(computeNowOffsetValue(now, 'DATETIME', 0, 'MINUTES')).toBe(
      '2024-06-15T10:00:00Z',
    );
  });

  test('magnitudeが数値でない場合はnullを返す', () => {
    expect(computeNowOffsetValue(new Date(), 'DATE', NaN, 'DAYS')).toBeNull();
    expect(
      computeNowOffsetValue(new Date(), 'DATE', undefined, 'DAYS'),
    ).toBeNull();
  });

  test('対応外のtargetFieldTypeはnullを返す', () => {
    expect(
      computeNowOffsetValue(new Date(), 'SINGLE_LINE_TEXT', 1, 'DAYS'),
    ).toBeNull();
  });

  test('nowが不正な日時の場合はnullを返す', () => {
    expect(
      computeNowOffsetValue(new Date('invalid'), 'DATE', 1, 'DAYS'),
    ).toBeNull();
  });
});
