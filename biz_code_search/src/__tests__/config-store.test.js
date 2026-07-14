'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore', () => {
  describe('load', () => {
    test('保存済みデータが無い場合はデフォルト値を返す', () => {
      expect(ConfigStore.load(null)).toEqual({
        lookups: [],
        apiTokenConfigured: false,
      });
      expect(ConfigStore.load(undefined)).toEqual({
        lookups: [],
        apiTokenConfigured: false,
      });
      expect(ConfigStore.load({})).toEqual({
        lookups: [],
        apiTokenConfigured: false,
      });
    });

    test('保存済みのlookups(JSON文字列)をパースして返す', () => {
      const saved = {
        lookups: JSON.stringify([
          { corporateNumberFieldCode: 'cn', fieldMappings: [] },
        ]),
        apiTokenConfigured: 'true',
      };
      expect(ConfigStore.load(saved)).toEqual({
        lookups: [{ corporateNumberFieldCode: 'cn', fieldMappings: [] }],
        apiTokenConfigured: true,
      });
    });

    test('lookupsが不正なJSONの場合はデフォルト値(空配列)にフォールバックする', () => {
      const saved = { lookups: '{not valid json', apiTokenConfigured: 'true' };
      expect(ConfigStore.load(saved)).toEqual({
        lookups: [],
        apiTokenConfigured: true,
      });
    });

    test('apiTokenConfiguredが"true"以外の文字列ならfalseになる', () => {
      expect(ConfigStore.load({ apiTokenConfigured: 'false' })).toEqual({
        lookups: [],
        apiTokenConfigured: false,
      });
      expect(ConfigStore.load({ apiTokenConfigured: undefined })).toEqual({
        lookups: [],
        apiTokenConfigured: false,
      });
    });
  });

  describe('serialize', () => {
    test('lookupsをJSON文字列に、apiTokenConfiguredを"true"/"false"の文字列にする', () => {
      const config = {
        lookups: [{ corporateNumberFieldCode: 'cn', fieldMappings: [] }],
        apiTokenConfigured: true,
      };
      expect(ConfigStore.serialize(config)).toEqual({
        lookups: JSON.stringify(config.lookups),
        apiTokenConfigured: 'true',
      });
    });

    test('apiTokenConfiguredがfalseの場合"false"文字列になる', () => {
      const config = { lookups: [], apiTokenConfigured: false };
      expect(ConfigStore.serialize(config)).toEqual({
        lookups: '[]',
        apiTokenConfigured: 'false',
      });
    });
  });
});
