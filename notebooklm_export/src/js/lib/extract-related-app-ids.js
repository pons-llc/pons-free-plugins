(function (root) {
  'use strict';

  // フィールド取得APIの`properties`(SUBTABLEは`fields`に入れ子)を走査し、
  // ルックアップ(LOOKUP)・関連レコード一覧(REFERENCE_TABLE)フィールドが参照している
  // 関連アプリのIDを集める。
  //
  // ルックアップフィールドは「コピー元のフィールドのフィールドタイプ」でtypeが返るため
  // (例: コピー元が文字列1行ならtype: "SINGLE_LINE_TEXT")、typeでは判定できない。
  // `lookup`プロパティの有無で判定する(kintoneドキュメントMCP「フィールドを取得する」で確認済み)。
  // 参照先アプリに閲覧・追加・アプリ管理権限のいずれも無い場合、`lookup`/`referenceTable`は
  // nullになるため、そのフィールドからは関連アプリを辿れない(idea.md参照)。
  const collectFields = (properties) => {
    const fields = [];
    Object.keys(properties || {}).forEach((code) => {
      const field = properties[code];
      fields.push(field);
      if (field && field.type === 'SUBTABLE' && field.fields) {
        fields.push(...collectFields(field.fields));
      }
    });
    return fields;
  };

  const extractRelatedAppIds = (properties) => {
    const related = [];
    collectFields(properties).forEach((field) => {
      if (
        field &&
        field.lookup &&
        field.lookup.relatedApp &&
        field.lookup.relatedApp.app
      ) {
        related.push({
          fieldCode: field.code,
          fieldType: 'LOOKUP',
          relatedAppId: String(field.lookup.relatedApp.app),
        });
      }
      if (
        field &&
        field.type === 'REFERENCE_TABLE' &&
        field.referenceTable &&
        field.referenceTable.relatedApp &&
        field.referenceTable.relatedApp.app
      ) {
        related.push({
          fieldCode: field.code,
          fieldType: 'REFERENCE_TABLE',
          relatedAppId: String(field.referenceTable.relatedApp.app),
        });
      }
    });
    return related;
  };

  const ExtractRelatedAppIds = { extractRelatedAppIds };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtractRelatedAppIds;
  } else {
    root.NotebooklmExport = root.NotebooklmExport || {};
    root.NotebooklmExport.ExtractRelatedAppIds = ExtractRelatedAppIds;
  }
})(typeof window !== 'undefined' ? window : globalThis);
