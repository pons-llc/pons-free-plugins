'use strict';

const { buildAppResult } = require('../js/lib/build-app-result');
const { renderAppDocument } = require('../js/lib/render-app-document');

describe('buildAppResult', () => {
  test('appInfo/appInfoErrorと各項目のdata/errorをsections配列へ変換する', () => {
    const design = {
      appInfo: { name: '案件管理', description: '説明' },
      fields: {
        文字列1行_0: { type: 'SINGLE_LINE_TEXT', code: '文字列1行_0' },
      },
      settings: { name: '案件管理' },
      statusError: '403 Forbidden',
      customize: { scope: 'ALL' },
      customizeFiles: [
        { context: 'desktop.js', name: 'a.js', kind: 'file', content: 'x' },
      ],
    };
    const result = buildAppResult('1', design);

    expect(result.appId).toBe('1');
    expect(result.appInfo).toEqual({ name: '案件管理', description: '説明' });
    expect(result.appInfoError).toBeNull();

    const byKey = Object.fromEntries(result.sections.map((s) => [s.key, s]));
    expect(byKey.fields.data).toEqual(design.fields);
    expect(byKey.fields.error).toBeNull();
    expect(byKey.settings.data).toEqual({ name: '案件管理' });
    expect(byKey.status.data).toBeNull();
    expect(byKey.status.error).toBe('403 Forbidden');
    expect(byKey.customize.files).toEqual(design.customizeFiles);
  });

  test('未指定の項目はdata: null, error: nullになる(取得自体を試みなかった場合)', () => {
    const result = buildAppResult('2', {});
    expect(result.appInfo).toBeNull();
    expect(result.appInfoError).toBeNull();
    result.sections.forEach((section) => {
      expect(section.data).toBeNull();
      expect(section.error).toBeNull();
    });
  });

  test('renderAppDocumentへそのまま渡してドキュメントを生成できる(結合確認)', () => {
    const design = {
      appInfo: { name: 'アプリA' },
      fields: { code_0: { type: 'NUMBER', code: 'code_0' } },
      aclError: '403',
    };
    const doc = renderAppDocument(buildAppResult('9', design));
    expect(doc).toContain('# アプリA(ID: 9)');
    expect(doc).toContain('## フィールド情報');
    expect(doc).toContain('## アプリのアクセス権');
    expect(doc).toContain('取得できませんでした(403)');
  });
});
