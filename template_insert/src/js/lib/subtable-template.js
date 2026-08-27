(function (root) {
  'use strict';

  const PlaceholderResolver =
    typeof module !== 'undefined' && module.exports
      ? require('./placeholder-resolver')
      : root.TemplateInsert.PlaceholderResolver;

  // サブテーブル繰り返し型テンプレート(idea.md参照)。行ごとの値マップ(rowValuesMaps、各要素は
  // レコード直下フィールド+その行の列の値をマージ済みの値マップ)を1つずつ本文へ展開し、
  // 行区切りで連結する。行が無い場合は空文字列を返す(呼び出し側で「対象のテーブルに行が
  // ありません」の案内に使う)。
  const ROW_SEPARATOR = {
    MULTI_LINE_TEXT: '\n',
    RICH_TEXT: '<br>',
  };

  const buildRepeatedTemplateText = ({
    body,
    rowValuesMaps,
    targetFieldType,
  }) => {
    const rows = rowValuesMaps || [];
    if (rows.length === 0) {
      return '';
    }
    const separator = ROW_SEPARATOR[targetFieldType] || '\n';
    return rows
      .map((valuesMap) =>
        PlaceholderResolver.resolveTemplate({
          body,
          valuesMap,
          targetFieldType,
        }),
      )
      .join(separator);
  };

  const SubtableTemplate = { buildRepeatedTemplateText };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubtableTemplate;
  } else {
    root.TemplateInsert = root.TemplateInsert || {};
    root.TemplateInsert.SubtableTemplate = SubtableTemplate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
