'use strict';

const { buildConfirmMessage } = require('../js/lib/build-confirm-message');

describe('buildConfirmMessage', () => {
  test('対象件数・フィールド名を含む本文を組み立てる(書き込む値は別途編集可能な入力欄で示すため含めない)', () => {
    const message = buildConfirmMessage({
      targetCount: 42,
      fieldLabel: '基準日',
    });
    expect(message).toContain('対象レコード数: 42件');
    expect(message).toContain('書き込み先フィールド: 基準日');
    expect(message).not.toContain('valuePreview');
  });
});
