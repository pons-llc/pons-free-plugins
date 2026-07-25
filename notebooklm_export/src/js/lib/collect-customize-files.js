(function (root) {
  'use strict';

  // JavaScript/CSSカスタマイズ設定(customize.json)から、実際に埋め込むファイル一覧を組み立てる。
  // - type: "FILE" の要素はファイル本体を`downloadFileText(fileKey)`(注入される取得関数、
  //   実体は`fetch('/k/v1/file.json?...')`。idea.md参照)でダウンロードしてテキストとして埋め込む。
  // - type: "URL" の要素は外部URLを直接取得しない(開発方針9)。URL文字列のみ記載する。
  // - 個々のファイルのダウンロードが失敗しても(削除済みファイル等)、他のファイルの処理は継続する。
  const CONTEXTS = [
    { key: 'desktop', label: 'desktop' },
    { key: 'mobile', label: 'mobile' },
  ];
  const KINDS = ['js', 'css'];

  const collectCustomizeFiles = async (customize, downloadFileText) => {
    const files = [];

    for (const ctx of CONTEXTS) {
      const section = customize && customize[ctx.key];
      if (!section) {
        continue;
      }
      for (const kind of KINDS) {
        const items = section[kind] || [];
        for (const item of items) {
          const context = `${ctx.label}.${kind}`;
          if (item.type === 'URL') {
            files.push({ context, name: item.url, kind: 'url', url: item.url });
            continue;
          }
          const name = (item.file && item.file.name) || '(不明なファイル)';
          try {
            const content = await downloadFileText(item.file.fileKey);
            files.push({ context, name, kind: 'file', content });
          } catch (err) {
            files.push({
              context,
              name,
              kind: 'file',
              error: (err && err.message) || String(err),
            });
          }
        }
      }
    }

    return files;
  };

  const CollectCustomizeFiles = { collectCustomizeFiles };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollectCustomizeFiles;
  } else {
    root.NotebooklmExport = root.NotebooklmExport || {};
    root.NotebooklmExport.CollectCustomizeFiles = CollectCustomizeFiles;
  }
})(typeof window !== 'undefined' ? window : globalThis);
