(function (root) {
  'use strict';

  // レコード+条件(AND/OR結合の複数条件)から、条件を満たすかどうかを判定する。
  // kintoneに依存しない純粋関数。subtable_cross_app_insertの発動条件と同じ演算子セット・
  // フラットなAND/OR結合(ネストなし)を採用している。

  const OPERATORS = [
    'EQ',
    'NEQ',
    'GT',
    'GTE',
    'LT',
    'LTE',
    'CONTAINS',
    'NOT_CONTAINS',
    'IS_EMPTY',
    'IS_NOT_EMPTY',
  ];

  const stringOf = (raw) => {
    if (raw === undefined || raw === null) {
      return '';
    }
    if (Array.isArray(raw)) {
      return raw.join(',');
    }
    return String(raw);
  };

  const isEmptyValue = (raw) => {
    if (raw === undefined || raw === null) {
      return true;
    }
    if (Array.isArray(raw)) {
      return raw.length === 0;
    }
    return String(raw).length === 0;
  };

  const evaluateClause = (record, clause) => {
    const field = record ? record[clause.fieldCode] : undefined;
    const raw = field ? field.value : undefined;

    switch (clause.operator) {
      case 'IS_EMPTY':
        return isEmptyValue(raw);
      case 'IS_NOT_EMPTY':
        return !isEmptyValue(raw);
      case 'EQ':
        return stringOf(raw) === stringOf(clause.value);
      case 'NEQ':
        return stringOf(raw) !== stringOf(clause.value);
      case 'CONTAINS':
        return stringOf(raw).includes(stringOf(clause.value));
      case 'NOT_CONTAINS':
        return !stringOf(raw).includes(stringOf(clause.value));
      case 'GT':
      case 'GTE':
      case 'LT':
      case 'LTE': {
        const a = Number(raw);
        const b = Number(clause.value);
        if (Number.isNaN(a) || Number.isNaN(b)) {
          return false;
        }
        if (clause.operator === 'GT') return a > b;
        if (clause.operator === 'GTE') return a >= b;
        if (clause.operator === 'LT') return a < b;
        return a <= b;
      }
      default:
        return false;
    }
  };

  // 条件(条件が0件の場合は「一致なし」として扱う)を評価する。
  const evaluateCondition = (record, condition) => {
    const children =
      condition && Array.isArray(condition.children) ? condition.children : [];
    if (children.length === 0) {
      return false;
    }
    if (condition.conditionOperator === 'OR') {
      return children.some((clause) => evaluateClause(record, clause));
    }
    return children.every((clause) => evaluateClause(record, clause));
  };

  const ConditionEngine = { OPERATORS, evaluateCondition };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConditionEngine;
  } else {
    root.ListHighlight = root.ListHighlight || {};
    root.ListHighlight.ConditionEngine = ConditionEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
