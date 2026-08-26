'use strict';

const GeoErrorMessage = require('../js/lib/geo-error-message');

describe('GeoErrorMessage.buildMessage', () => {
  test('PERMISSION_DENIED(code: 1)は許可設定を促すメッセージ', () => {
    expect(GeoErrorMessage.buildMessage({ code: 1 })).toBe(
      '位置情報の利用が許可されなかったため、位置情報を取得できませんでした。ブラウザの位置情報の利用を許可してから、もう一度保存してください。位置情報は空のまま記録されます。',
    );
  });

  test('POSITION_UNAVAILABLE(code: 2)は取得失敗のメッセージ', () => {
    expect(GeoErrorMessage.buildMessage({ code: 2 })).toBe(
      '端末の位置情報を取得できませんでした。電波状況の良い場所でもう一度お試しください。位置情報は空のまま記録されます。',
    );
  });

  test('TIMEOUT(code: 3)はタイムアウトのメッセージ', () => {
    expect(GeoErrorMessage.buildMessage({ code: 3 })).toBe(
      '位置情報の取得がタイムアウトしました。電波状況の良い場所でもう一度お試しください。位置情報は空のまま記録されます。',
    );
  });

  test('未知のcode/エラー無しは汎用メッセージ', () => {
    expect(GeoErrorMessage.buildMessage({ code: 999 })).toBe(
      '位置情報の取得に失敗しました。位置情報は空のまま記録されます。',
    );
    expect(GeoErrorMessage.buildMessage(null)).toBe(
      '位置情報の取得に失敗しました。位置情報は空のまま記録されます。',
    );
    expect(GeoErrorMessage.buildMessage(undefined)).toBe(
      '位置情報の取得に失敗しました。位置情報は空のまま記録されます。',
    );
  });

  test('Geolocation非対応ブラウザ用のエラー(message指定・codeなし)は元のメッセージを含める', () => {
    expect(
      GeoErrorMessage.buildMessage(
        new Error('このブラウザは位置情報の取得に対応していません。'),
      ),
    ).toBe(
      '位置情報を取得できませんでした(このブラウザは位置情報の取得に対応していません。)。位置情報は空のまま記録されます。',
    );
  });
});
