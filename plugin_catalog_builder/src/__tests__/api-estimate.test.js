const ApiEstimate = require('../js/lib/api-estimate.js');

describe('estimateApiCallCount', () => {
  test('小規模(プラグイン5件・利用アプリ延べ8件・書き込み5件)', () => {
    const count = ApiEstimate.estimateApiCallCount({
      pluginCount: 5,
      uniqueAppCount: 8,
      targetRecordCount: 5,
    });
    // pluginListCalls=1 + pluginAppsCalls=5 + appInfoCalls=ceil(8/100)=1 + writeCalls=ceil(5/100)=1
    expect(count).toBe(1 + 5 + 1 + 1);
  });

  test('プラグインが150件ある場合、プラグイン一覧取得は2回になる', () => {
    const count = ApiEstimate.estimateApiCallCount({
      pluginCount: 150,
      uniqueAppCount: 0,
      targetRecordCount: 0,
    });
    expect(count).toBe(2 + 150 + 0 + 0);
  });

  test('プラグイン0件なら一覧取得の最低1回のみカウントする', () => {
    const count = ApiEstimate.estimateApiCallCount({
      pluginCount: 0,
      uniqueAppCount: 0,
      targetRecordCount: 0,
    });
    expect(count).toBe(1);
  });
});

describe('buildConfirmMessage', () => {
  test('件数と概算回数を含む文言を生成する', () => {
    const message = ApiEstimate.buildConfirmMessage({
      pluginCount: 3,
      uniqueAppCount: 4,
      targetRecordCount: 3,
    });
    expect(message).toContain('対象プラグイン数: 3件');
    expect(message).toContain('利用アプリ数(延べ、重複除く): 4件');
    expect(message).toContain('台帳アプリへの書き込みレコード数: 3件');
    expect(message).toContain('概算APIリクエスト回数');
  });
});
