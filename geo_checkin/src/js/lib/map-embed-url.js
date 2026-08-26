(function (root) {
  'use strict';

  // 緯度・経度の値からGoogleマップの埋め込みURLを組み立てる。APIキー不要の公開埋め込み形式
  // (https://www.google.com/maps?q=<lat>,<lng>&output=embed)を使う(box_gdrive_iframeの
  // Box/Googleドライブ埋め込みと同じ「iframeでの外部サイト埋め込み」方針、外部ライブラリ・
  // fetch/XHRでの外部通信は行わない)。
  //
  // URLはフィールド値の生文字列を直接連結せず、必ずNumber()でパースし有限の数値・緯度経度の
  // 有効範囲であることを確認したうえで組み立てる。任意の文字列がURLに混入する余地を無くしている
  // (box_gdrive_iframeのbuildEmbedUrlがURL全体をnew URL()で検証するのと同じ考え方)。
  const buildUrl = (lat, lng) => {
    if (lat === '' || lat === undefined || lat === null) {
      return null;
    }
    if (lng === '' || lng === undefined || lng === null) {
      return null;
    }
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return null;
    }
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return null;
    }
    return `https://www.google.com/maps?q=${latNum},${lngNum}&z=17&output=embed`;
  };

  const MapEmbedUrl = { buildUrl };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapEmbedUrl;
  } else {
    root.GeoCheckin = root.GeoCheckin || {};
    root.GeoCheckin.MapEmbedUrl = MapEmbedUrl;
  }
})(typeof window !== 'undefined' ? window : globalThis);
