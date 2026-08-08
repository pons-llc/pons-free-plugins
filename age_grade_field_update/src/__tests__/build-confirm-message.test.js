'use strict';

const { buildConfirmMessage } = require('../js/lib/build-confirm-message');

describe('buildConfirmMessage', () => {
  test('対象件数・フィールド名・書き込む値のプレビューを含む本文を組み立てる', () => {
    const message = buildConfirmMessage({
      targetCount: 42,
      fieldLabel: '基準日',
      valuePreview: '2026-01-05',
    });
    expect(message).toContain('対象レコード数: 42件');
    expect(message).toContain('書き込み先フィールド: 基準日');
    expect(message).toContain('書き込む値: 2026-01-05');
    expect(message).toContain('この内容で更新を実行しますか？');
  });
});
