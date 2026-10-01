(function (root) {
  'use strict';

  // 未解決の指摘があるフィールドの強調表示(v4)。kintone公式の「フィールドのスタイルの設定」API
  // (kintone.app.record.setFieldStyle / kintone.mobile.app.record.setFieldStyle)に渡す設定を組み立てる。
  // v3まではgetFieldElement()の要素のstyle.outlineを直接変更していたが、ドキュメントでスタイル変更には
  // このAPIの利用が推奨されているため置き換えた。
  //
  // kintone_doc MCPで確認した制限事項:
  // - 非対応: ステータス・作業者・テーブル・テーブル内のフィールド・関連レコード一覧・グループ・罫線・ラベル・スペース
  // - contentが非対応: 追加/編集画面のリッチエディター・計算・レコード番号・作成者・作成日時・更新者・更新日時・
  //   「自動計算する」を有効にした文字列(1行)、詳細/印刷画面のリッチエディター
  // contentが使えないフィールドは、フィールド名(label)だけを強調する。

  const BORDER_COLOR = '#e74c3c';
  const LABEL_COLOR = '#c0392b';

  const UNSUPPORTED = new Set([
    'STATUS',
    'STATUS_ASSIGNEE',
    'SUBTABLE',
    'REFERENCE_TABLE',
    'GROUP',
    'HR',
    'LABEL',
    'SPACER',
  ]);

  const NO_CONTENT_ON_EDIT = new Set([
    'RICH_TEXT',
    'CALC',
    'RECORD_NUMBER',
    'CREATOR',
    'CREATED_TIME',
    'MODIFIER',
    'UPDATED_TIME',
  ]);

  // field: getFormFields()のフィールド定義({ type, expression? })、screen: 'detail' | 'edit'(追加画面を含む)
  const highlightStyle = (field, screen) => {
    if (!field || UNSUPPORTED.has(field.type)) {
      return null;
    }
    const label = { color: LABEL_COLOR, fontWeight: 'bold' };
    const noContent =
      screen === 'edit'
        ? NO_CONTENT_ON_EDIT.has(field.type) ||
          (field.type === 'SINGLE_LINE_TEXT' && !!field.expression)
        : field.type === 'RICH_TEXT';
    return noContent
      ? { label }
      : { content: { borderColor: BORDER_COLOR }, label };
  };

  // 未解決の指摘があるフィールドのコード(行単位の指摘は、そのテーブルのコード)。
  const unresolvedFieldCodes = (items) => {
    const codes = [];
    items.forEach((item) => {
      if (!item.resolved && codes.indexOf(item.targetCode) === -1) {
        codes.push(item.targetCode);
      }
    });
    return codes;
  };

  const FieldHighlight = { highlightStyle, unresolvedFieldCodes };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldHighlight;
  } else {
    root.RecordReview = root.RecordReview || {};
    root.RecordReview.FieldHighlight = FieldHighlight;
  }
})(typeof window !== 'undefined' ? window : globalThis);
