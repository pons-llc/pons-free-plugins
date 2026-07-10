(function (root) {
  'use strict';

  const RuleMatcher =
    typeof module !== 'undefined' && module.exports
      ? require('./rule-matcher')
      : root.ListHighlight.RuleMatcher;

  // レコードの配列+ルールの配列+対象列コードの配列から、kintone.app.setRecordListStyle()に渡す
  // config.bodyを組み立てる。一致したレコードの列すべてに同じ背景色を設定することで、行全体を
  // 強調しているように見せる(idea.mdの「技術アプローチ」参照)。kintoneに依存しない純粋関数。
  const buildStyleConfig = (records, rules, columnCodes) => {
    const list = Array.isArray(records) ? records : [];
    const columns = Array.isArray(columnCodes) ? columnCodes : [];

    return list.reduce((body, record) => {
      const rule = RuleMatcher.findMatchingRule(record, rules);
      const recordId = record && record.$id ? record.$id.value : undefined;
      if (!rule || !recordId) {
        return body;
      }
      body.push({
        recordId,
        style: columns.map((column) => ({
          column,
          background: { backgroundColor: rule.backgroundColor },
        })),
      });
      return body;
    }, []);
  };

  const StyleBuilder = { buildStyleConfig };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StyleBuilder;
  } else {
    root.ListHighlight = root.ListHighlight || {};
    root.ListHighlight.StyleBuilder = StyleBuilder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
