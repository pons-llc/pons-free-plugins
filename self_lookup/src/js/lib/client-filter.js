(function (root) {
  'use strict';

  const QueryBuilder =
    typeof module !== 'undefined' && module.exports
      ? require('./query-builder')
      : root.SelfLookup.QueryBuilder;

  // サーバー側のクエリでは表現できないSAME_MONTH/SAME_DAY条件を、取得済みの候補レコード群に対して
  // クライアント側で判定する(idea.mdの「同一月/同一日」、判断記録.mdの2番参照)。

  const CLIENT_ONLY_OPERATORS = ['SAME_MONTH', 'SAME_DAY'];

  const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

  // DATE("YYYY-MM-DD")・DATETIME(ISO8601、先頭が同じ日付部分)から月・日を取り出す。
  // タイムゾーン変換は行わない(値の日付部分をそのまま読む簡易実装、判断記録.md参照)。
  const extractMonth = (value) => {
    const matched = DATE_PATTERN.exec(value || '');
    return matched ? Number(matched[2]) : null;
  };
  const extractDay = (value) => {
    const matched = DATE_PATTERN.exec(value || '');
    return matched ? Number(matched[3]) : null;
  };

  const getFieldValue = (record, fieldCode) => {
    const field = record ? record[fieldCode] : undefined;
    return field ? field.value : undefined;
  };

  const matchesClientCondition = (candidateRecord, condition, selfRecord) => {
    const candidateValue = getFieldValue(candidateRecord, condition.fieldCode);
    const compareValue = QueryBuilder.resolveConditionValue(
      condition,
      selfRecord,
    );

    if (condition.operator === 'SAME_MONTH') {
      const a = extractMonth(candidateValue);
      const b = extractMonth(compareValue);
      return a !== null && b !== null && a === b;
    }
    if (condition.operator === 'SAME_DAY') {
      const a = extractDay(candidateValue);
      const b = extractDay(compareValue);
      return a !== null && b !== null && a === b;
    }
    return true;
  };

  // 候補レコード群(サーバー側条件で既に絞り込み済み)から、クライアント側限定の条件をすべて満たす
  // 最初の1件を選ぶ。候補が$id昇順で渡される前提のため、返る結果も$id昇順で最初の一致になる。
  const pickMatchedRecord = (candidateRecords, lookup, selfRecord) => {
    const list = Array.isArray(candidateRecords) ? candidateRecords : [];
    const clientConditions = (lookup.conditions || []).filter((condition) =>
      CLIENT_ONLY_OPERATORS.includes(condition.operator),
    );
    const found = list.find((record) =>
      clientConditions.every((condition) =>
        matchesClientCondition(record, condition, selfRecord),
      ),
    );
    return found || null;
  };

  const ClientFilter = { CLIENT_ONLY_OPERATORS, pickMatchedRecord };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClientFilter;
  } else {
    root.SelfLookup = root.SelfLookup || {};
    root.SelfLookup.ClientFilter = ClientFilter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
