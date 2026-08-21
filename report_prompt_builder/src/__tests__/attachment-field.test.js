'use strict';

const AttachmentField = require('../js/lib/attachment-field');

describe('buildUpdatedFileFieldValue', () => {
  test('appends the new fileKey to the existing attached files', () => {
    const existingFiles = [
      {
        contentType: 'application/pdf',
        fileKey: 'existing-1',
        name: 'a.pdf',
        size: '1',
      },
      {
        contentType: 'application/pdf',
        fileKey: 'existing-2',
        name: 'b.pdf',
        size: '2',
      },
    ];

    const result = AttachmentField.buildUpdatedFileFieldValue(
      existingFiles,
      'new-upload-key',
    );

    expect(result).toEqual({
      value: [
        { fileKey: 'existing-1' },
        { fileKey: 'existing-2' },
        { fileKey: 'new-upload-key' },
      ],
    });
  });

  test('works when the field currently has no attached files', () => {
    const result = AttachmentField.buildUpdatedFileFieldValue(
      [],
      'new-upload-key',
    );
    expect(result).toEqual({ value: [{ fileKey: 'new-upload-key' }] });
  });

  test('treats a missing existing-files argument as empty (no crash)', () => {
    const result = AttachmentField.buildUpdatedFileFieldValue(
      undefined,
      'new-upload-key',
    );
    expect(result).toEqual({ value: [{ fileKey: 'new-upload-key' }] });
  });
});

describe('buildAttachmentFileName', () => {
  // ユーザー指示「ファイル保存時の名称は固定テキスト+タイムスタンプ。configで設定できるように」
  test('combines the configured prefix with a YYYYMMDDHHmmss timestamp', () => {
    const date = new Date(2026, 0, 5, 9, 3, 7); // 2026-01-05 09:03:07 (ローカル時刻)
    expect(AttachmentField.buildAttachmentFileName('見積書', date)).toBe(
      '見積書_20260105090307.pdf',
    );
  });

  test('falls back to "帳票" when the prefix is empty', () => {
    const date = new Date(2026, 0, 5, 9, 3, 7);
    expect(AttachmentField.buildAttachmentFileName('', date)).toBe(
      '帳票_20260105090307.pdf',
    );
  });

  test('falls back to "帳票" when the prefix is only whitespace', () => {
    const date = new Date(2026, 0, 5, 9, 3, 7);
    expect(AttachmentField.buildAttachmentFileName('   ', date)).toBe(
      '帳票_20260105090307.pdf',
    );
  });

  test('trims surrounding whitespace from a non-empty prefix', () => {
    const date = new Date(2026, 0, 5, 9, 3, 7);
    expect(AttachmentField.buildAttachmentFileName('  請求書  ', date)).toBe(
      '請求書_20260105090307.pdf',
    );
  });
});
