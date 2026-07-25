'use strict';

const { collectCustomizeFiles } = require('../js/lib/collect-customize-files');

describe('collectCustomizeFiles', () => {
  test('FILE指定の要素はdownloadFileTextでダウンロードした内容を含める', async () => {
    const customize = {
      scope: 'ALL',
      desktop: {
        js: [
          {
            type: 'FILE',
            file: {
              contentType: 'application/javascript',
              fileKey: 'key1',
              name: 'sample.js',
              size: '12345',
            },
          },
        ],
        css: [],
      },
      mobile: { js: [], css: [] },
    };
    const downloadFileText = jest.fn().mockResolvedValue('console.log(1);');
    const files = await collectCustomizeFiles(customize, downloadFileText);
    expect(downloadFileText).toHaveBeenCalledWith('key1');
    expect(files).toEqual([
      {
        context: 'desktop.js',
        name: 'sample.js',
        kind: 'file',
        content: 'console.log(1);',
      },
    ]);
  });

  test('URL指定の要素は外部アクセスせずURL文字列のみ記載する', async () => {
    const customize = {
      desktop: {
        js: [{ type: 'URL', url: 'https://sample.com/example.js' }],
        css: [],
      },
      mobile: { js: [], css: [] },
    };
    const downloadFileText = jest.fn();
    const files = await collectCustomizeFiles(customize, downloadFileText);
    expect(downloadFileText).not.toHaveBeenCalled();
    expect(files).toEqual([
      {
        context: 'desktop.js',
        name: 'https://sample.com/example.js',
        kind: 'url',
        url: 'https://sample.com/example.js',
      },
    ]);
  });

  test('ダウンロードが失敗したファイルはエラーを記録し、他の処理は継続する', async () => {
    const customize = {
      desktop: {
        js: [
          { type: 'FILE', file: { fileKey: 'ok', name: 'a.js' } },
          { type: 'FILE', file: { fileKey: 'ng', name: 'b.js' } },
        ],
        css: [],
      },
      mobile: { js: [], css: [] },
    };
    const downloadFileText = jest.fn((fileKey) =>
      fileKey === 'ng'
        ? Promise.reject(new Error('404'))
        : Promise.resolve('ok content'),
    );
    const files = await collectCustomizeFiles(customize, downloadFileText);
    expect(files).toEqual([
      {
        context: 'desktop.js',
        name: 'a.js',
        kind: 'file',
        content: 'ok content',
      },
      { context: 'desktop.js', name: 'b.js', kind: 'file', error: '404' },
    ]);
  });

  test('desktop/mobileが未設定(null)の場合は空配列を返す', async () => {
    const files = await collectCustomizeFiles({ scope: 'NONE' }, jest.fn());
    expect(files).toEqual([]);
  });
});
