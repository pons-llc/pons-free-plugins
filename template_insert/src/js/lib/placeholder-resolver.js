(function (root) {
  'use strict';

  // テンプレート本文中の `{フィールドコード}` を、値マップ(valuesMap)の値に置換する
  // (idea.md「プレースホルダー記法」参照)。マップに存在しないコードはトークンのまま残す
  // (無音で消えると気付けないため)。

  const PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g;

  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const substitutePlaceholders = (text, valuesMap, valueTransform) =>
    text.replace(PLACEHOLDER_PATTERN, (match, code) => {
      if (!Object.prototype.hasOwnProperty.call(valuesMap, code)) {
        return match;
      }
      return valueTransform(valuesMap[code]);
    });

  // targetFieldType: 'MULTI_LINE_TEXT'は生のテキストとして扱い、改行(\n)はそのまま。
  // 'RICH_TEXT'はHTMLとして扱うため、改行を<br>に変換したうえで解決する。
  //
  // 本文自体はエスケープしない(=本文中に書いたHTMLタグはそのままリッチエディターへ反映される)。
  // 本文はkintoneのプラグイン設定画面(アプリ管理権限を持つユーザーのみ編集可能)で入力する、
  // アプリ管理者にとって信頼できる文字列だからで、一般的なテンプレートエンジンにおける
  // 「テンプレート(コード相当)は信頼し、差し込むデータは信頼しない」という区別と同じ考え方。
  // 一方、置換される各プレースホルダーの値は、他ユーザーが入力した可能性のあるレコードの実データ
  // であるため、`escapeHtml()`で必ずエスケープする(XSS対策、idea.md「プレースホルダー記法」参照)。
  const resolveTemplate = ({ body, valuesMap, targetFieldType }) => {
    const safeBody = body || '';
    const safeValuesMap = valuesMap || {};

    if (targetFieldType === 'RICH_TEXT') {
      const substituted = substitutePlaceholders(
        safeBody,
        safeValuesMap,
        (value) => escapeHtml(value),
      );
      return substituted.replace(/\n/g, '<br>');
    }

    return substitutePlaceholders(safeBody, safeValuesMap, (value) => value);
  };

  const PlaceholderResolver = { resolveTemplate, escapeHtml };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaceholderResolver;
  } else {
    root.TemplateInsert = root.TemplateInsert || {};
    root.TemplateInsert.PlaceholderResolver = PlaceholderResolver;
  }
})(typeof window !== 'undefined' ? window : globalThis);
