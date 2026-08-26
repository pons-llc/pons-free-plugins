'use strict';

const MapEmbedUrl = require('../js/lib/map-embed-url');

describe('MapEmbedUrl.buildUrl', () => {
  test('有効な緯度経度からGoogleマップの埋め込みURLを組み立てる(APIキー不要の公開埋め込み形式)', () => {
    expect(MapEmbedUrl.buildUrl('35.681236', '139.767125')).toBe(
      'https://www.google.com/maps?q=35.681236,139.767125&z=17&output=embed',
    );
  });

  test('数値型で渡しても組み立てられる', () => {
    expect(MapEmbedUrl.buildUrl(35.681236, 139.767125)).toBe(
      'https://www.google.com/maps?q=35.681236,139.767125&z=17&output=embed',
    );
  });

  test('緯度・経度が空文字列の場合はnull', () => {
    expect(MapEmbedUrl.buildUrl('', '')).toBeNull();
  });

  test('緯度・経度がundefined/nullの場合はnull', () => {
    expect(MapEmbedUrl.buildUrl(undefined, undefined)).toBeNull();
    expect(MapEmbedUrl.buildUrl(null, null)).toBeNull();
  });

  test('数値として解釈できない文字列はnull(URLへの任意文字列混入を防ぐ)', () => {
    expect(MapEmbedUrl.buildUrl('not-a-number', '139.767125')).toBeNull();
    expect(MapEmbedUrl.buildUrl('35.681236&evil=1', '139.767125')).toBeNull();
  });

  test('緯度の範囲(-90〜90)を超える値はnull', () => {
    expect(MapEmbedUrl.buildUrl('91', '139.767125')).toBeNull();
    expect(MapEmbedUrl.buildUrl('-91', '139.767125')).toBeNull();
  });

  test('経度の範囲(-180〜180)を超える値はnull', () => {
    expect(MapEmbedUrl.buildUrl('35.681236', '181')).toBeNull();
    expect(MapEmbedUrl.buildUrl('35.681236', '-181')).toBeNull();
  });

  test('境界値(±90/±180)は有効', () => {
    expect(MapEmbedUrl.buildUrl('90', '180')).toBe(
      'https://www.google.com/maps?q=90,180&z=17&output=embed',
    );
    expect(MapEmbedUrl.buildUrl('-90', '-180')).toBe(
      'https://www.google.com/maps?q=-90,-180&z=17&output=embed',
    );
  });
});
