(function (root) {
  'use strict';

  // 1アプリ分の取得結果(appResult、下記の形)からMarkdown本文を組み立てる純粋関数。
  // 出力形式(.txt/.md)によって内容は変わらない(拡張子だけが異なる。idea.md参照)ため、
  // この関数自体は拡張子を引数に取らない。
  //
  // appResult = {
  //   appId: string,
  //   appInfo: { name, description, ... } | null,
  //   appInfoError: string | null,
  //   sections: [
  //     { key, title, data, error, files? }, ...
  //   ],
  // }
  const jsonBlock = (data) =>
    '```json\n' + JSON.stringify(data, null, 2) + '\n```';

  const renderFile = (file) => {
    const lines = [`### ${file.context}: ${file.name}`];
    if (file.kind === 'url') {
      lines.push('', `外部URL指定のため本文は取得していません: ${file.url}`);
    } else if (file.error) {
      lines.push('', `ファイル本体を取得できませんでした(${file.error})`);
    } else {
      lines.push('', '```', file.content || '', '```');
    }
    return lines.join('\n');
  };

  const renderSection = (section) => {
    const lines = [`## ${section.title}`];
    if (section.error) {
      lines.push(
        '',
        `取得できませんでした(${section.error})。アプリ管理権限が無い可能性があります。`,
      );
      return lines.join('\n');
    }
    if (section.data === null || section.data === undefined) {
      lines.push('', '設定なし');
    } else {
      lines.push('', jsonBlock(section.data));
    }
    if (section.files && section.files.length > 0) {
      section.files.forEach((file) => {
        lines.push('', renderFile(file));
      });
    }
    return lines.join('\n');
  };

  const renderAppDocument = (appResult) => {
    const lines = [];
    const heading = appResult.appInfoError
      ? `# アプリ(ID: ${appResult.appId})`
      : `# ${(appResult.appInfo && appResult.appInfo.name) || '(名称不明)'}(ID: ${appResult.appId})`;
    lines.push(heading);

    if (appResult.appInfoError) {
      lines.push(
        '',
        `> アプリ基本情報の取得に失敗しました: ${appResult.appInfoError}`,
      );
    } else if (appResult.appInfo && appResult.appInfo.description) {
      lines.push('', appResult.appInfo.description);
    }

    appResult.sections.forEach((section) => {
      lines.push('', renderSection(section));
    });

    return lines.join('\n') + '\n';
  };

  const RenderAppDocument = { renderAppDocument };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RenderAppDocument;
  } else {
    root.NotebooklmExport = root.NotebooklmExport || {};
    root.NotebooklmExport.RenderAppDocument = RenderAppDocument;
  }
})(typeof window !== 'undefined' ? window : globalThis);
