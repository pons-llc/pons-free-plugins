'use strict';

const { buildConfirmMessage } = require('../js/lib/build-confirm-message');

describe('buildConfirmMessage', () => {
  test('対象件数・絞り込み条件を含む本文を組み立てる', () => {
    const message = buildConfirmMessage({
      targetCount: 42,
      query: 'ステータス in ("対応中")',
    });
    expect(message).toContain('対象レコード数: 42件');
    expect(message).toContain('絞り込み条件: ステータス in ("対応中")');
  });

  test('絞り込み条件が空文字列の場合は「絞り込みなし」と表示する', () => {
    const message = buildConfirmMessage({ targetCount: 10, query: '' });
    expect(message).toContain('絞り込み条件: (絞り込みなし・全レコード)');
  });
});
