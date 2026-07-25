'use strict';

const {
  renderMetadataDocument,
} = require('../js/lib/render-metadata-document');

describe('renderMetadataDocument', () => {
  test('処理したアプリ一覧・関係・上限超過アプリを表形式で記載する', () => {
    const doc = renderMetadataDocument({
      rootAppId: '1',
      generatedAt: '2026-07-26T00:00:00.000Z',
      ext: 'txt',
      apps: [
        { appId: '1', appInfo: { name: '案件管理' }, error: null },
        { appId: '2', appInfo: null, error: '403 Forbidden' },
      ],
      edges: [
        {
          fromAppId: '1',
          fieldCode: 'lu_0',
          fieldType: 'LOOKUP',
          toAppId: '2',
        },
      ],
      skippedCap: ['3', '4'],
    });

    expect(doc).toContain('起点アプリID: 1');
    expect(doc).toContain('出力形式: .txt');
    expect(doc).toContain('| 1 | 案件管理 | app_1.txt | 取得済み |');
    expect(doc).toContain(
      '| 2 | (名称不明) | app_2.txt | 取得失敗(403 Forbidden) |',
    );
    expect(doc).toContain('| 1 | lu_0 | LOOKUP | 2 |');
    expect(doc).toContain('次のアプリIDは処理していません: 3, 4');
  });

  test('関連アプリ・上限超過が無い場合は「無い」旨を記載する', () => {
    const doc = renderMetadataDocument({
      rootAppId: '1',
      generatedAt: '2026-07-26T00:00:00.000Z',
      ext: 'md',
      apps: [{ appId: '1', appInfo: { name: '単独アプリ' }, error: null }],
      edges: [],
      skippedCap: [],
    });
    expect(doc).toContain('該当するフィールドはありませんでした。');
    expect(doc).toContain('ありません。');
    expect(doc).toContain('app_1.md');
  });
});
