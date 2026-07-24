'use strict';

const { buildBackupPayload } = require('../js/lib/backup-payload');

describe('buildBackupPayload', () => {
  test('appId/recordId/deletedAt/recordを含むJSON文字列を組み立てる', () => {
    const record = {
      文字列1行: { type: 'SINGLE_LINE_TEXT', value: 'テスト' },
      テーブル: {
        type: 'SUBTABLE',
        value: [
          {
            id: '1',
            value: { 数値: { type: 'NUMBER', value: '1' } },
          },
        ],
      },
    };
    const json = buildBackupPayload({
      appId: 570,
      recordId: 12,
      record,
      deletedAt: '2026-07-24T10:00:00.000Z',
    });

    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({
      appId: 570,
      recordId: 12,
      deletedAt: '2026-07-24T10:00:00.000Z',
      record,
    });
  });

  test('recordの内容を書き換えずそのまま保持する(参照ではなく値としてJSON化される)', () => {
    const record = { a: { type: 'SINGLE_LINE_TEXT', value: 'x' } };
    const json = buildBackupPayload({
      appId: 1,
      recordId: 1,
      record,
      deletedAt: '2026-01-01T00:00:00.000Z',
    });
    record.a.value = 'mutated-after';
    expect(JSON.parse(json).record.a.value).toBe('x');
  });

  test('人が読める整形(インデント)付きで出力する', () => {
    const json = buildBackupPayload({
      appId: 1,
      recordId: 1,
      record: {},
      deletedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(json).toContain('\n');
  });
});
