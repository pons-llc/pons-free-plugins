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
  // 'RICH_TEXT'はHTMLとして扱うため、本文自体と置換される値の両方をHTMLエスケープしたうえで、
  // 改行を<br>に変換する(idea.md「リッチエディターへ挿入する場合...必ずHTMLエスケープする」参照。
  // 置換前にエスケープすると本文中の`{`/`}`はエスケープされないため、プレースホルダーの
  // マッチには影響しない)。
  const resolveTemplate = ({ body, valuesMap, targetFieldType }) => {
    const safeBody = body || '';
    const safeValuesMap = valuesMap || {};

    if (targetFieldType === 'RICH_TEXT') {
      const escapedBody = escapeHtml(safeBody);
      const substituted = substitutePlaceholders(
        escapedBody,
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
