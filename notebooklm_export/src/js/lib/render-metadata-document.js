(function (root) {
  'use strict';

  // 探索結果(traverseAppsの戻り値相当)からメタデータファイル本文を組み立てる純粋関数。
  // 処理したアプリの一覧・ファイル名、アプリ間の関係(どのフィールドがどのアプリを参照しているか)、
  // 上限到達により未処理となったアプリを記載する(idea.md「出力ファイルの構成」参照)。
  const fileNameOf = (appId, ext) => `app_${appId}.${ext}`;

  const nameOf = (appInfo) => (appInfo && appInfo.name) || '(名称不明)';

  const renderMetadataDocument = ({
    rootAppId,
    generatedAt,
    ext,
    apps,
    edges,
    skippedCap,
  }) => {
    const lines = ['# 設計書エクスポート メタデータ', ''];
    lines.push(`- 起点アプリID: ${rootAppId}`);
    lines.push(`- 生成日時: ${generatedAt}`);
    lines.push(`- 出力形式: .${ext}`);
    lines.push('');
    lines.push('## 処理したアプリ');
    lines.push('');
    lines.push('| アプリID | アプリ名 | ファイル名 | 状態 |');
    lines.push('| :-- | :-- | :-- | :-- |');
    apps.forEach((app) => {
      const status = app.error ? `取得失敗(${app.error})` : '取得済み';
      lines.push(
        `| ${app.appId} | ${nameOf(app.appInfo)} | ${fileNameOf(app.appId, ext)} | ${status} |`,
      );
    });

    lines.push('', '## アプリ間の関係(ルックアップ/関連レコード一覧)', '');
    if (edges.length === 0) {
      lines.push('該当するフィールドはありませんでした。');
    } else {
      lines.push(
        '| 参照元アプリID | フィールドコード | 種別 | 参照先アプリID |',
      );
      lines.push('| :-- | :-- | :-- | :-- |');
      edges.forEach((edge) => {
        lines.push(
          `| ${edge.fromAppId} | ${edge.fieldCode} | ${edge.fieldType} | ${edge.toAppId} |`,
        );
      });
    }

    lines.push('', '## 上限により未処理のアプリ', '');
    if (skippedCap.length === 0) {
      lines.push('ありません。');
    } else {
      lines.push(
        `探索するアプリの総数が上限に達したため、次のアプリIDは処理していません: ${skippedCap.join(', ')}`,
      );
    }

    return lines.join('\n') + '\n';
  };

  const RenderMetadataDocument = { renderMetadataDocument };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RenderMetadataDocument;
  } else {
    root.NotebooklmExport = root.NotebooklmExport || {};
    root.NotebooklmExport.RenderMetadataDocument = RenderMetadataDocument;
  }
})(typeof window !== 'undefined' ? window : globalThis);
