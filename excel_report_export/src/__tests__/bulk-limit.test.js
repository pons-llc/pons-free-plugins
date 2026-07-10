const { checkBulkLimit } = require('../js/lib/bulk-limit');

describe('checkBulkLimit', () => {
  test('対象件数が上限以下なら許可する', () => {
    expect(checkBulkLimit(10, 50)).toEqual({
      allowed: true,
      exceeded: false,
      targetCount: 10,
      limit: 50,
      message: null,
    });
  });

  test('対象件数が上限ちょうどなら許可する', () => {
    expect(checkBulkLimit(50, 50).allowed).toBe(true);
  });

  test('対象件数が上限を超えていれば許可しない', () => {
    const result = checkBulkLimit(120, 50);
    expect(result.allowed).toBe(false);
    expect(result.exceeded).toBe(true);
    expect(result.message).toBe(
      '対象レコード数(120件)が一括ダウンロードの上限(50件)を超えています。絞り込み条件を見直してください。',
    );
  });

  test('対象件数が0件なら(超過はしていないが)ダウンロード対象がない旨のメッセージを返す', () => {
    const result = checkBulkLimit(0, 50);
    expect(result.allowed).toBe(false);
    expect(result.exceeded).toBe(false);
    expect(result.message).toBe('ダウンロード対象のレコードがありません。');
  });

  test('上限が未設定(0以下)の場合は設定不備として許可しない', () => {
    const result = checkBulkLimit(10, 0);
    expect(result.allowed).toBe(false);
    expect(result.message).toBe(
      '一括ダウンロードの上限件数が設定されていません。',
    );
  });

  test('負の対象件数は不正な入力としてエラーメッセージを返す', () => {
    const result = checkBulkLimit(-1, 50);
    expect(result.allowed).toBe(false);
    expect(result.message).toBe('対象件数が不正です。');
  });
});
