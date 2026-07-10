(function (root) {
  'use strict';

  // 取得元フィールドの型とサブテーブル列の型の組み合わせが妥当かどうかを検証する純粋関数。
  // 設定画面でのフィールドマッピング入力時のバリデーションに使う
  // (plugin_idea_plan.mdの「型の不一致の検証をどこまで設定画面で行うか」という未決事項への対応)。

  // 値を持たない/構造が複雑すぎて単純コピーできないフィールドタイプ(取得元として不可)。
  const UNSUPPORTED_SOURCE_TYPES = [
    'SUBTABLE',
    'REFERENCE_TABLE',
    'GROUP',
    'LABEL',
    'SPACER',
    'HR',
    'CATEGORY',
    'STATUS',
  ];

  // 添付ファイルは値がfileKey(ダウンロード専用の一時キー)であり、
  // 別レコードへの再アップロードなしに単純コピーできないため、取得元・取り込み先どちらも非対応とする。
  const FILE_TYPE = 'FILE';

  // 型を大まかなカテゴリーに分類し、同カテゴリー間は無条件で互換とする。
  const CATEGORY_OF = {
    SINGLE_LINE_TEXT: 'TEXT',
    MULTI_LINE_TEXT: 'TEXT',
    RICH_TEXT: 'TEXT',
    LINK: 'TEXT',
    RECORD_NUMBER: 'TEXT',
    CALC: 'TEXT',
    NUMBER: 'NUMBER',
    DATE: 'DATE',
    TIME: 'TIME',
    DATETIME: 'DATETIME',
    CREATED_TIME: 'DATETIME',
    UPDATED_TIME: 'DATETIME',
    DROP_DOWN: 'SINGLE_SELECT',
    RADIO_BUTTON: 'SINGLE_SELECT',
    STATUS_ASSIGNEE: 'MULTI_SELECT',
    CHECK_BOX: 'MULTI_SELECT',
    MULTI_SELECT: 'MULTI_SELECT',
    USER_SELECT: 'USER',
    CREATOR: 'USER',
    MODIFIER: 'USER',
    ORGANIZATION_SELECT: 'ORGANIZATION',
    GROUP_SELECT: 'GROUP_SELECT',
  };

  // カテゴリーが異なっても、文字列化すれば意味のある取り込みができる組み合わせ
  // (取り込み先がテキスト系のときのみ許可し、警告付きでcompatible: trueを返す)。
  const STRINGIFIABLE_INTO_TEXT = [
    'NUMBER',
    'DATE',
    'TIME',
    'DATETIME',
    'SINGLE_SELECT',
    'MULTI_SELECT',
    'USER',
  ];

  const check = (sourceType, targetType) => {
    if (!sourceType || !targetType) {
      return {
        compatible: false,
        warning: null,
        reason: 'フィールドタイプが指定されていません',
      };
    }
    if (sourceType === FILE_TYPE || targetType === FILE_TYPE) {
      return {
        compatible: false,
        warning: null,
        reason: '添付ファイル(FILE)フィールドの値コピーはサポートしていません',
      };
    }
    if (UNSUPPORTED_SOURCE_TYPES.includes(sourceType)) {
      return {
        compatible: false,
        warning: null,
        reason: `${sourceType}は値を持たない、または構造が複雑なため取得元フィールドに指定できません`,
      };
    }

    if (sourceType === targetType) {
      return { compatible: true, warning: null, reason: null };
    }

    const sourceCategory = CATEGORY_OF[sourceType];
    const targetCategory = CATEGORY_OF[targetType];
    if (!sourceCategory || !targetCategory) {
      return {
        compatible: false,
        warning: null,
        reason: `未対応のフィールドタイプの組み合わせです(${sourceType} → ${targetType})`,
      };
    }

    if (sourceCategory === targetCategory) {
      return {
        compatible: true,
        warning: `${sourceType}の値が${targetType}として取り込まれます(表示形式が異なる場合があります)`,
        reason: null,
      };
    }

    if (
      targetCategory === 'TEXT' &&
      STRINGIFIABLE_INTO_TEXT.includes(sourceCategory)
    ) {
      return {
        compatible: true,
        warning: `${sourceType}の値は文字列に変換して取り込まれます`,
        reason: null,
      };
    }

    if (
      sourceCategory === 'SINGLE_SELECT' &&
      targetCategory === 'MULTI_SELECT'
    ) {
      return {
        compatible: true,
        warning: '単一選択の値が、複数選択の1件の選択肢として取り込まれます',
        reason: null,
      };
    }

    return {
      compatible: false,
      warning: null,
      reason: `型が一致しないため取り込めません(${sourceType} → ${targetType})`,
    };
  };

  const TypeCompatibility = { check, CATEGORY_OF, UNSUPPORTED_SOURCE_TYPES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TypeCompatibility;
  } else {
    root.RecordsToSubtable = root.RecordsToSubtable || {};
    root.RecordsToSubtable.TypeCompatibility = TypeCompatibility;
  }
})(typeof window !== 'undefined' ? window : globalThis);
