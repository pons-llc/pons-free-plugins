(function (root) {
  'use strict';

  // navigator.geolocation.getCurrentPosition()の失敗理由(GeolocationPositionError、
  // またはGeolocation自体が存在しない場合に投げるError)を、利用者向けの日本語メッセージへ変換する。
  // 「位置情報は空のまま記録されます」を必ず添える(取得失敗時もレコード登録は継続する仕様、idea.md参照)。
  const SUFFIX = '位置情報は空のまま記録されます。';

  // GeolocationPositionError.code の値(Web標準、kintone固有ではない)。
  const PERMISSION_DENIED = 1;
  const POSITION_UNAVAILABLE = 2;
  const TIMEOUT = 3;

  const buildMessage = (error) => {
    const code = error && error.code;
    if (code === PERMISSION_DENIED) {
      return `位置情報の利用が許可されなかったため、位置情報を取得できませんでした。ブラウザの位置情報の利用を許可してから、もう一度保存してください。${SUFFIX}`;
    }
    if (code === POSITION_UNAVAILABLE) {
      return `端末の位置情報を取得できませんでした。電波状況の良い場所でもう一度お試しください。${SUFFIX}`;
    }
    if (code === TIMEOUT) {
      return `位置情報の取得がタイムアウトしました。電波状況の良い場所でもう一度お試しください。${SUFFIX}`;
    }
    if (error && typeof error.message === 'string' && error.message) {
      return `位置情報を取得できませんでした(${error.message})。${SUFFIX}`;
    }
    return `位置情報の取得に失敗しました。${SUFFIX}`;
  };

  const GeoErrorMessage = { buildMessage };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeoErrorMessage;
  } else {
    root.GeoCheckin = root.GeoCheckin || {};
    root.GeoCheckin.GeoErrorMessage = GeoErrorMessage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
