const ApiPath = require('../js/lib/api-path.js');

describe('buildApiPath', () => {
  test('ゲストスペースIDが空なら通常のパス', () => {
    expect(ApiPath.buildApiPath('/k/v1/app/form/fields.json', '')).toBe(
      '/k/v1/app/form/fields.json',
    );
  });

  test('ゲストスペースIDがあれば /k/guest/{id}/v1/ に置き換える', () => {
    expect(ApiPath.buildApiPath('/k/v1/preview/app/deploy.json', '7')).toBe(
      '/k/guest/7/v1/preview/app/deploy.json',
    );
  });

  test('数値のIDも受け付ける', () => {
    expect(ApiPath.buildApiPath('/k/v1/app.json', 12)).toBe(
      '/k/guest/12/v1/app.json',
    );
  });

  test('正の整数でないゲストスペースIDは例外(パスに任意文字列を混ぜない)', () => {
    expect(() => ApiPath.buildApiPath('/k/v1/app.json', '1/../2')).toThrow();
  });

  test('/k/v1/ で始まらないパスは例外', () => {
    expect(() => ApiPath.buildApiPath('/v1/users.json', '')).toThrow();
  });
});

describe('describeApiError', () => {
  test('kintoneのエラーオブジェクトはmessage', () => {
    expect(
      ApiPath.describeApiError({
        code: 'CB_NO02',
        message: '権限がありません。',
      }),
    ).toBe('権限がありません。');
  });

  test('項目ごとのエラーも並べる', () => {
    expect(
      ApiPath.describeApiError({
        code: 'CB_VA01',
        message: '入力内容が正しくありません。',
        errors: {
          'properties[title].code': { messages: ['重複しています。'] },
        },
      }),
    ).toBe(
      '入力内容が正しくありません。(properties[title].code: 重複しています。)',
    );
  });

  test('文字列・Error・未定義', () => {
    expect(ApiPath.describeApiError('x')).toBe('x');
    expect(ApiPath.describeApiError(new Error('y'))).toBe('y');
    expect(ApiPath.describeApiError(undefined)).toMatch(/不明/);
  });
});

describe('isPermissionError', () => {
  test('CB_NO02のみ', () => {
    expect(ApiPath.isPermissionError({ code: 'CB_NO02' })).toBe(true);
    expect(ApiPath.isPermissionError({ code: 'CB_VA01' })).toBe(false);
    expect(ApiPath.isPermissionError(null)).toBe(false);
  });
});
