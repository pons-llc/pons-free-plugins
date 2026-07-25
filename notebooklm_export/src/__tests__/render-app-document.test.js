'use strict';

const { renderAppDocument } = require('../js/lib/render-app-document');

describe('renderAppDocument', () => {
  test('正常取得できたセクションはJSONコードブロックとして出力する', () => {
    const doc = renderAppDocument({
      appId: '1',
      appInfo: { name: '案件管理', description: '営業部で使用します。' },
      appInfoError: null,
      sections: [
        {
          key: 'settings',
          title: 'アプリ一般設定',
          data: { name: '案件管理' },
          error: null,
        },
      ],
    });
    expect(doc).toContain('# 案件管理(ID: 1)');
    expect(doc).toContain('営業部で使用します。');
    expect(doc).toContain('## アプリ一般設定');
    expect(doc).toContain('```json');
    expect(doc).toContain('"name": "案件管理"');
  });

  test('取得に失敗したセクションは権限不足の可能性を明記する', () => {
    const doc = renderAppDocument({
      appId: '2',
      appInfo: { name: '関連アプリ' },
      appInfoError: null,
      sections: [
        {
          key: 'acl',
          title: 'アプリのアクセス権',
          data: null,
          error: '403 Forbidden',
        },
      ],
    });
    expect(doc).toContain('## アプリのアクセス権');
    expect(doc).toContain('取得できませんでした(403 Forbidden)');
    expect(doc).toContain('アプリ管理権限が無い可能性があります');
  });

  test('dataがnull(未設定)のセクションは「設定なし」と明記する', () => {
    const doc = renderAppDocument({
      appId: '3',
      appInfo: { name: 'アプリ3' },
      appInfoError: null,
      sections: [
        { key: 'status', title: 'プロセス管理設定', data: null, error: null },
      ],
    });
    expect(doc).toContain('## プロセス管理設定');
    expect(doc).toContain('設定なし');
  });

  test('appInfo自体の取得に失敗した場合は見出しにIDのみを表示し、失敗を明記する', () => {
    const doc = renderAppDocument({
      appId: '4',
      appInfo: null,
      appInfoError: '403 Forbidden',
      sections: [],
    });
    expect(doc).toContain('# アプリ(ID: 4)');
    expect(doc).toContain('アプリ基本情報の取得に失敗しました: 403 Forbidden');
  });

  test('カスタマイズのファイル本体・URL指定・失敗をそれぞれ描画する', () => {
    const doc = renderAppDocument({
      appId: '5',
      appInfo: { name: 'アプリ5' },
      appInfoError: null,
      sections: [
        {
          key: 'customize',
          title: 'カスタマイズ設定',
          data: { scope: 'ALL' },
          error: null,
          files: [
            {
              context: 'desktop.js',
              name: 'a.js',
              kind: 'file',
              content: 'console.log(1);',
            },
            {
              context: 'desktop.js',
              name: 'https://x.example/b.js',
              kind: 'url',
              url: 'https://x.example/b.js',
            },
            { context: 'desktop.js', name: 'c.js', kind: 'file', error: '404' },
          ],
        },
      ],
    });
    expect(doc).toContain('### desktop.js: a.js');
    expect(doc).toContain('console.log(1);');
    expect(doc).toContain('### desktop.js: https://x.example/b.js');
    expect(doc).toContain(
      '外部URL指定のため本文は取得していません: https://x.example/b.js',
    );
    expect(doc).toContain('### desktop.js: c.js');
    expect(doc).toContain('ファイル本体を取得できませんでした(404)');
  });
});
