'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore', () => {
  test('load()はnull/undefinedでも既定値(zip方式)を返す', () => {
    const defaults = {
      mode: 'zip',
      archiveAppId: '',
      jsonFieldCode: '',
      attachmentFieldCode: '',
    };
    expect(ConfigStore.load(null)).toEqual(defaults);
    expect(ConfigStore.load(undefined)).toEqual(defaults);
  });

  test('load()は保存済みの値をそのまま復元する', () => {
    const saved = {
      mode: 'archive',
      archiveAppId: '571',
      jsonFieldCode: 'backup_json',
      attachmentFieldCode: 'backup_files',
    };
    expect(ConfigStore.load(saved)).toEqual(saved);
  });

  test('load()は一部のキーが欠けていても既定値で補う', () => {
    const loaded = ConfigStore.load({ mode: 'archive' });
    expect(loaded).toEqual({
      mode: 'archive',
      archiveAppId: '',
      jsonFieldCode: '',
      attachmentFieldCode: '',
    });
  });

  test('serialize()はkintone.plugin.app.setConfig()向けの文字列マップを返す', () => {
    const config = {
      mode: 'archive',
      archiveAppId: '571',
      jsonFieldCode: 'backup_json',
      attachmentFieldCode: 'backup_files',
    };
    expect(ConfigStore.serialize(config)).toEqual(config);
  });
});
