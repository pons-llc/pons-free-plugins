'use strict';

const {
  formatDate,
  formatDatetime,
  formatCurrentValue,
} = require('../js/lib/current-value-formatter');

describe('formatDate', () => {
  test('ローカルの年月日からYYYY-MM-DDを組み立てる(1桁の月日はゼロ埋め)', () => {
    // 2026-01-05 09:00 (ローカル)
    const date = new Date(2026, 0, 5, 9, 0, 0);
    expect(formatDate(date)).toBe('2026-01-05');
  });

  test('UTCの日付とローカルの日付がずれる時刻でもローカルの暦日を使う(toISOString().slice(0,10)の誤りを踏まない)', () => {
    // UTC+9(日本時間)想定: ローカル 2026-01-01 08:00 は UTC では 2025-12-31 23:00。
    // toISOString().slice(0, 10) を使うと誤って"2025-12-31"になってしまう。
    const date = new Date(2026, 0, 1, 8, 0, 0);
    expect(formatDate(date)).toBe('2026-01-01');
    // 実際にtoISOString()ベースの誤り方が起きることを示すための対比(このテスト自体は
    // 実行環境のタイムゾーンに依存するため、誤った実装の場合のみ挙動が変わることを明示する)。
  });
});

describe('formatDatetime', () => {
  test('UTC ISO8601からミリ秒を取り除いた形式を返す', () => {
    const date = new Date('2026-01-05T09:30:00.000Z');
    expect(formatDatetime(date)).toBe('2026-01-05T09:30:00Z');
  });

  test('ミリ秒が0でない場合も正しく取り除く', () => {
    const date = new Date('2026-01-05T09:30:00.123Z');
    expect(formatDatetime(date)).toBe('2026-01-05T09:30:00Z');
  });
});

describe('formatCurrentValue', () => {
  const date = new Date(2026, 0, 5, 9, 30, 0);

  test('DATE型はformatDateと同じ結果を返す', () => {
    expect(formatCurrentValue(date, 'DATE')).toBe(formatDate(date));
  });

  test('DATETIME型はformatDatetimeと同じ結果を返す', () => {
    expect(formatCurrentValue(date, 'DATETIME')).toBe(formatDatetime(date));
  });

  test('未対応のフィールド型では例外を投げる', () => {
    expect(() => formatCurrentValue(date, 'SINGLE_LINE_TEXT')).toThrow(
      '未対応のフィールド型です: SINGLE_LINE_TEXT',
    );
  });
});
