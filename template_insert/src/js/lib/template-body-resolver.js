(function (root) {
  'use strict';

  const PlaceholderResolver =
    typeof module !== 'undefined' && module.exports
      ? require('./placeholder-resolver')
      : root.TemplateInsert.PlaceholderResolver;
  const SubtableTemplate =
    typeof module !== 'undefined' && module.exports
      ? require('./subtable-template')
      : root.TemplateInsert.SubtableTemplate;

  // テンプレート本文中の `[[...]]` は、その中身をサブテーブルの行ごとに繰り返し展開して
  // 連結する「繰り返しブロック」を表す(idea.md「繰り返しブロック([[ ]]構文)」参照)。
  // ブロック自体にテーブル名を書く記法ではなく、ブロック内のプレースホルダー
  // (`{フィールドコード}`)がどのテーブルの列を指しているかから対象テーブルを逆引きする。
  const BLOCK_PATTERN = /\[\[([\s\S]*?)\]\]/g;
  const CODE_PATTERN = /\{([^{}]+)\}/g;

  const extractPlaceholderCodes = (text) => {
    const codes = [];
    const pattern = new RegExp(CODE_PATTERN);
    let match;
    while ((match = pattern.exec(text))) {
      codes.push(match[1]);
    }
    return codes;
  };

  // ブロック内のプレースホルダーが指すフィールドコードから、繰り返し対象のテーブルを
  // 一意に決定する。テーブル列への参照が1つも無い場合、または複数の異なるテーブルに
  // またがって参照している場合はnull(あいまいで解決不可)を返す。
  const resolveBlockTableCode = (blockContent, fieldCatalog) => {
    const catalog = fieldCatalog || {};
    const tableCodes = extractPlaceholderCodes(blockContent)
      .map((code) => catalog[code] && catalog[code].subtableFieldCode)
      .filter(Boolean);
    const uniqueTableCodes = Array.from(new Set(tableCodes));
    return uniqueTableCodes.length === 1 ? uniqueTableCodes[0] : null;
  };

  // テンプレート本文全体を解決する。`[[...]]`以外の部分はresolveTemplate()と同じくレコード
  // 直下の値マップ(outerValuesMap)で置換する。`[[...]]`の部分は、resolveBlockTableCode()で
  // 決定したテーブルのrowColumnMapsByTable[tableCode](行ごとの列値マップの配列)を
  // outerValuesMapとマージしたうえで、行ごとに展開・連結する(SubtableTemplate参照)。
  // 対象テーブルが一意に決まらないブロックは、気付けるようそのまま(未解決)残す。
  const resolveTemplateBody = ({
    body,
    fieldCatalog,
    outerValuesMap,
    rowColumnMapsByTable,
    targetFieldType,
  }) => {
    const safeBody = body || '';
    const safeOuterValuesMap = outerValuesMap || {};
    const safeRowColumnMapsByTable = rowColumnMapsByTable || {};

    let result = '';
    let lastIndex = 0;
    const pattern = new RegExp(BLOCK_PATTERN);
    let match;
    while ((match = pattern.exec(safeBody))) {
      const plainText = safeBody.slice(lastIndex, match.index);
      result += PlaceholderResolver.resolveTemplate({
        body: plainText,
        valuesMap: safeOuterValuesMap,
        targetFieldType,
      });

      const blockContent = match[1];
      const tableCode = resolveBlockTableCode(blockContent, fieldCatalog);
      if (!tableCode) {
        result += match[0];
      } else {
        const rowColumnMaps = safeRowColumnMapsByTable[tableCode] || [];
        const rowValuesMaps = rowColumnMaps.map((rowColumnMap) =>
          Object.assign({}, safeOuterValuesMap, rowColumnMap),
        );
        result += SubtableTemplate.buildRepeatedTemplateText({
          body: blockContent,
          rowValuesMaps,
          targetFieldType,
        });
      }

      lastIndex = pattern.lastIndex;
    }
    result += PlaceholderResolver.resolveTemplate({
      body: safeBody.slice(lastIndex),
      valuesMap: safeOuterValuesMap,
      targetFieldType,
    });
    return result;
  };

  const TemplateBodyResolver = {
    extractPlaceholderCodes,
    resolveBlockTableCode,
    resolveTemplateBody,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemplateBodyResolver;
  } else {
    root.TemplateInsert = root.TemplateInsert || {};
    root.TemplateInsert.TemplateBodyResolver = TemplateBodyResolver;
  }
})(typeof window !== 'undefined' ? window : globalThis);
