(function (root) {
  'use strict';

  // 設定行(lookup)+自レコードの値から、サーバー側で表現可能な条件のkintoneクエリ文字列を組み立てる。
  // kintoneに依存しない純粋関数。

  const OPERATORS = {
    EXACT_MATCH: 'EXACT_MATCH',
    CONTAINS: 'CONTAINS',
    EQ: 'EQ',
    GTE: 'GTE',
    LTE: 'LTE',
    GT: 'GT',
    LT: 'LT',
    SAME_MONTH: 'SAME_MONTH',
    SAME_DAY: 'SAME_DAY',
  };

  // SAME_MONTH/SAME_DAYはkintoneのクエリ言語で表現できないため、サーバー側のクエリには含めない
  // (idea.mdの「同一月/同一日」参照。js/lib/client-filter.jsでクライアント側フィルタする)。
  const SERVER_OPERATORS = [
    OPERATORS.EXACT_MATCH,
    OPERATORS.CONTAINS,
    OPERATORS.EQ,
    OPERATORS.GTE,
    OPERATORS.LTE,
    OPERATORS.GT,
    OPERATORS.LT,
  ];

  const KINTONE_OPERATOR_SYMBOL = {
    EXACT_MATCH: '=',
    EQ: '=',
    CONTAINS: 'like',
    GTE: '>=',
    LTE: '<=',
    GT: '>',
    LT: '<',
  };

  // kintone公式ドキュメント記載の手順通り、バックスラッシュを先にエスケープしてからダブルクオートを
  // エスケープする(この順序を逆にすると二重エスケープになり壊れる)。
  const escapeQueryValue = (value) =>
    String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // 絞り込み条件の比較値を、固定値または自レコードのフィールド参照から解決する
  // (records_to_subtable_importと同じ設計、判断記録.mdの4番参照)。
  const resolveConditionValue = (condition, selfRecord) => {
    if (condition.valueSource === 'SELF_FIELD') {
      const field = selfRecord
        ? selfRecord[condition.selfFieldCode]
        : undefined;
      return field ? field.value : '';
    }
    return condition.value === undefined || condition.value === null
      ? ''
      : condition.value;
  };

  const buildQuery = (lookup, selfRecord, excludeRecordId) => {
    const clauses = [];

    const keyValue = resolveConditionValue(
      { valueSource: 'SELF_FIELD', selfFieldCode: lookup.selfKeyFieldCode },
      selfRecord,
    );
    // キー一致は部分一致(like)で検索する(user-test.mdフィードバック反映、判断記録.md参照)。
    // kintoneのクエリ言語でlikeが使えるのは文字列(1行)/リンク等の一部フィールド型のみのため、
    // otherKeyFieldCodeの選択肢自体をjs/config.js側で絞り込んでいる。
    clauses.push(
      `${lookup.otherKeyFieldCode} like "${escapeQueryValue(keyValue)}"`,
    );

    (lookup.conditions || [])
      .filter((condition) => SERVER_OPERATORS.includes(condition.operator))
      .forEach((condition) => {
        const value = resolveConditionValue(condition, selfRecord);
        const symbol = KINTONE_OPERATOR_SYMBOL[condition.operator];
        clauses.push(
          `${condition.fieldCode} ${symbol} "${escapeQueryValue(value)}"`,
        );
      });

    // 編集画面では自分自身がヒットしないよう$id除外条件を追加する(idea.mdの「自己参照の除外」参照)。
    // 追加画面ではレコード番号が未確定のため付与しない。
    if (
      excludeRecordId !== undefined &&
      excludeRecordId !== null &&
      excludeRecordId !== ''
    ) {
      clauses.push(`$id != "${escapeQueryValue(String(excludeRecordId))}"`);
    }

    return `${clauses.join(' and ')} order by $id asc limit 500`;
  };

  const QueryBuilder = {
    OPERATORS,
    SERVER_OPERATORS,
    escapeQueryValue,
    resolveConditionValue,
    buildQuery,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QueryBuilder;
  } else {
    root.SelfLookup = root.SelfLookup || {};
    root.SelfLookup.QueryBuilder = QueryBuilder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
