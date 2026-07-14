'use strict';

const {
  BASE_URL,
  buildDetailUrl,
  buildSearchUrl,
} = require('../js/lib/gbiz-api');

describe('gbiz-api', () => {
  test('BASE_URLはgBizINFO v2のhojinエンドポイント', () => {
    expect(BASE_URL).toBe('https://api.info.gbiz.go.jp/hojin/v2/hojin');
  });

  test('buildDetailUrlは法人番号をパスに含める', () => {
    expect(buildDetailUrl('4488443968535')).toBe(
      'https://api.info.gbiz.go.jp/hojin/v2/hojin/4488443968535',
    );
  });

  test('buildSearchUrlは法人名とlimitをクエリ文字列に含める', () => {
    expect(buildSearchUrl('サイボウズ', 50)).toBe(
      'https://api.info.gbiz.go.jp/hojin/v2/hojin?name=%E3%82%B5%E3%82%A4%E3%83%9C%E3%82%A6%E3%82%BA&limit=50',
    );
  });

  test('buildSearchUrlは記号を含む法人名もエンコードする', () => {
    const url = buildSearchUrl('A&B株式会社', 50);
    expect(url).toBe(
      'https://api.info.gbiz.go.jp/hojin/v2/hojin?name=A%26B%E6%A0%AA%E5%BC%8F%E4%BC%9A%E7%A4%BE&limit=50',
    );
  });

  test('buildDetailUrlは法人番号をエンコードする(念のため)', () => {
    expect(buildDetailUrl('12/3')).toBe(
      'https://api.info.gbiz.go.jp/hojin/v2/hojin/12%2F3',
    );
  });
});
