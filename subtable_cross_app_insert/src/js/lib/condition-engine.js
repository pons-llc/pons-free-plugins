(function (root) {
  'use strict';

  // kintoneに依存しない発動条件エンジン。
  // ノードは次の2種類:
  //   { type: 'clause', fieldCode, operator, value }
  //   { type: 'group', conditionOperator: 'AND'|'OR', children: [node, ...] }
  // record はkintoneのレコード形式({ fieldCode: { value } })を想定するが、
  // サブテーブルの行(rowValue)にも同じ形で使える。

  const isEmptyValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return true;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return false;
  };

  const toComparable = (value) => {
    if (Array.isArray(value)) {
      return value.join(',');
    }
    if (value === null || value === undefined) {
      return '';
    }
    return value;
  };

  const sign = (x, y) => {
    if (x < y) {
      return -1;
    }
    if (x > y) {
      return 1;
    }
    return 0;
  };

  const compareOrder = (fieldValue, compareValue) => {
    const a = toComparable(fieldValue);
    const b = toComparable(compareValue);
    const numA = Number(a);
    const numB = Number(b);
    const bothNumeric =
      a !== '' && b !== '' && !Number.isNaN(numA) && !Number.isNaN(numB);
    if (bothNumeric) {
      return sign(numA, numB);
    }
    return sign(String(a), String(b));
  };

  const contains = (fieldValue, compareValue) => {
    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(String(compareValue));
    }
    return String(toComparable(fieldValue)).includes(String(compareValue));
  };

  const OPERATORS = {
    EQ: (fieldValue, compareValue) =>
      String(toComparable(fieldValue)) === String(compareValue),
    NEQ: (fieldValue, compareValue) =>
      String(toComparable(fieldValue)) !== String(compareValue),
    GT: (fieldValue, compareValue) =>
      compareOrder(fieldValue, compareValue) > 0,
    GTE: (fieldValue, compareValue) =>
      compareOrder(fieldValue, compareValue) >= 0,
    LT: (fieldValue, compareValue) =>
      compareOrder(fieldValue, compareValue) < 0,
    LTE: (fieldValue, compareValue) =>
      compareOrder(fieldValue, compareValue) <= 0,
    CONTAINS: (fieldValue, compareValue) => contains(fieldValue, compareValue),
    NOT_CONTAINS: (fieldValue, compareValue) =>
      !contains(fieldValue, compareValue),
    IS_EMPTY: (fieldValue) => isEmptyValue(fieldValue),
    IS_NOT_EMPTY: (fieldValue) => !isEmptyValue(fieldValue),
  };

  const evaluateClause = (node, record) => {
    const field = record ? record[node.fieldCode] : undefined;
    const fieldValue = field ? field.value : '';
    const op = OPERATORS[node.operator];
    if (!op) {
      // 未知の演算子は「一致しない」扱いにする(誤設定で意図せず発動しないよう安全側に倒す)。
      return false;
    }
    return op(fieldValue, node.value);
  };

  const evaluateGroup = (node, record) => {
    const children = node.children || [];
    if (children.length === 0) {
      // 条件が1つも設定されていないグループは「常に発動」を表す。
      return true;
    }
    if (node.conditionOperator === 'OR') {
      return children.some((child) => evaluate(child, record));
    }
    // デフォルトはAND。
    return children.every((child) => evaluate(child, record));
  };

  const evaluate = (node, record) => {
    if (!node) {
      // 条件ツリー自体が未設定(null/undefined)の場合も「常に発動」扱いにする。
      return true;
    }
    if (node.type === 'group') {
      return evaluateGroup(node, record);
    }
    return evaluateClause(node, record);
  };

  const ConditionEngine = { evaluate, OPERATORS: Object.keys(OPERATORS) };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConditionEngine;
  } else {
    root.SubtableCrossAppInsert = root.SubtableCrossAppInsert || {};
    root.SubtableCrossAppInsert.ConditionEngine = ConditionEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
