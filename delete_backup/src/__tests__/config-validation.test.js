'use strict';

const { validateConfig } = require('../js/lib/config-validation');

describe('validateConfig', () => {
  test('zip方式は追加設定が無くても有効', () => {
    const result = validateConfig({
      mode: 'zip',
      archiveAppId: '',
      jsonFieldCode: '',
      attachmentFieldCode: '',
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('mode不正はエラー', () => {
    const result = validateConfig({
      mode: 'invalid',
      archiveAppId: '',
      jsonFieldCode: '',
      attachmentFieldCode: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('archive方式はアーカイブ先アプリID・JSON保存先・添付ファイル保存先がすべて必須', () => {
    const result = validateConfig({
      mode: 'archive',
      archiveAppId: '',
      jsonFieldCode: '',
      attachmentFieldCode: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('アーカイブ先アプリID'),
        expect.stringContaining('JSON保存先'),
        expect.stringContaining('添付ファイル保存先'),
      ]),
    );
  });

  test('アーカイブ先アプリIDは1以上の整数でなければならない', () => {
    ['0', '-1', 'abc', '1.5'].forEach((archiveAppId) => {
      const result = validateConfig({
        mode: 'archive',
        archiveAppId,
        jsonFieldCode: 'json',
        attachmentFieldCode: 'files',
      });
      expect(result.valid).toBe(false);
    });
  });

  test('JSON保存先と添付ファイル保存先が同じフィールドはエラー', () => {
    const result = validateConfig({
      mode: 'archive',
      archiveAppId: '571',
      jsonFieldCode: 'same_field',
      attachmentFieldCode: 'same_field',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('同じフィールド')]),
    );
  });

  test('正しいarchive設定は有効', () => {
    const result = validateConfig({
      mode: 'archive',
      archiveAppId: '571',
      jsonFieldCode: 'backup_json',
      attachmentFieldCode: 'backup_files',
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });
});
