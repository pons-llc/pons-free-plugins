(function (root) {
  'use strict';

  // GeolocationPositionError.code(Web標準)のうち、再試行して成功する見込みがあるものだけ
  // リトライ対象とする。PERMISSION_DENIED(1)は同じ保存操作の中で許可状態が変わることはないため
  // 再試行しても無駄であり、Geolocation非対応ブラウザのError(codeなし)も再試行の余地が無い。
  // POSITION_UNAVAILABLE(2、macOSのkCLErrorLocationUnknown等、位置情報プロバイダー側の一時的な
  // 解決失敗を含む)とTIMEOUT(3)は、少し待って再試行すると成功することが多い。
  const POSITION_UNAVAILABLE = 2;
  const TIMEOUT = 3;

  const isRetryableGeoError = (error) => {
    const code = error && error.code;
    return code === POSITION_UNAVAILABLE || code === TIMEOUT;
  };

  // getPosition()(navigator.geolocation.getCurrentPosition()をPromise化したもの)を、
  // リトライ対象のエラーに限り最大maxAttempts回まで(delayMsずつ間隔を空けて)試行する。
  // sleep()を注入することで、実際のタイマーを使わずにJestで確定的にテストできる
  // (fiscal_year_numberingのjs/lib/retry.jsと同じ設計)。
  const withGeoRetry = async (getPosition, { maxAttempts, delayMs, sleep }) => {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        return await getPosition();
      } catch (err) {
        if (!isRetryableGeoError(err) || attempt >= maxAttempts) {
          throw err;
        }
        await sleep(delayMs);
      }
    }
  };

  const GeoRetry = { withGeoRetry, isRetryableGeoError };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeoRetry;
  } else {
    root.GeoCheckin = root.GeoCheckin || {};
    root.GeoCheckin.GeoRetry = GeoRetry;
  }
})(typeof window !== 'undefined' ? window : globalThis);
