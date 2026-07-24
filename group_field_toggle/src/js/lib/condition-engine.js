(function (root) {
  'use strict';

  // レコード+条件(AND/OR結合の複数条件)から、条件を満たすかどうかを判定する。
  // kintoneに依存しない純粋関数。list_highlightの条件エンジンを土台に、フィールド種別ごとに
  // 演算子・値の比較方法を変える拡張を加えている(idea.mdの「ルールの条件」参照)。

  const STATUS_FIELD_NAME = 'ステータス';

  // フィールド種別ごとに使える演算子(config-validation.jsでも参照する)。
  const OPERATORS_BY_TYPE = {
    DATETIME: [
      'GT',
      'GTE',
      'LT',
      'LTE',
      'EQ',
      'NEQ',
      'IS_EMPTY',
      'IS_NOT_EMPTY',
    ],
    DATE: ['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ', 'IS_EMPTY', 'IS_NOT_EMPTY'],
    TIME: ['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ', 'IS_EMPTY', 'IS_NOT_EMPTY'],
    RADIO_BUTTON: ['EQ', 'NEQ', 'IS_EMPTY', 'IS_NOT_EMPTY'],
    DROP_DOWN: ['EQ', 'NEQ', 'IS_EMPTY', 'IS_NOT_EMPTY'],
    CHECK_BOX: ['CONTAINS', 'NOT_CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'],
    STATUS: ['EQ', 'NEQ', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  };

  const FIELD_TYPES = Object.keys(OPERATORS_BY_TYPE);

  const isEmptyValue = (raw) => {
    if (raw === undefined || raw === null) {
      return true;
    }
    if (Array.isArray(raw)) {
      return raw.length === 0;
    }
    return String(raw).length === 0;
  };

  // STATUS(プロセス管理ステータス)はフィールドコードではなく固定名でアクセスする
  // (kintoneのフィールド形式の仕様。カテゴリー・ステータス・作業者の3フィールドのみ該当。
  // status_arrowプラグインと同じ扱い)。
  const readRawValue = (record, clause) => {
    if (!record) {
      return undefined;
    }
    const key =
      clause.fieldType === 'STATUS' ? STATUS_FIELD_NAME : clause.fieldCode;
    const field = record[key];
    return field ? field.value : undefined;
  };

  const stringOf = (raw) => {
    if (raw === undefined || raw === null) {
      return '';
    }
    return String(raw);
  };

  const evaluateStringClause = (raw, clause) => {
    switch (clause.operator) {
      case 'EQ':
        return stringOf(raw) === stringOf(clause.value);
      case 'NEQ':
        return stringOf(raw) !== stringOf(clause.value);
      default:
        return false;
    }
  };

  const evaluateCheckboxClause = (raw, clause) => {
    const selected = Array.isArray(raw) ? raw : [];
    switch (clause.operator) {
      case 'CONTAINS':
        return selected.includes(clause.value);
      case 'NOT_CONTAINS':
        return !selected.includes(clause.value);
      default:
        return false;
    }
  };

  const evaluateDateClause = (raw, clause) => {
    const a = Date.parse(raw);
    const b = Date.parse(clause.value);
    if (Number.isNaN(a) || Number.isNaN(b)) {
      return false;
    }
    switch (clause.operator) {
      case 'GT':
        return a > b;
      case 'GTE':
        return a >= b;
      case 'LT':
        return a < b;
      case 'LTE':
        return a <= b;
      case 'EQ':
        return a === b;
      case 'NEQ':
        return a !== b;
      default:
        return false;
    }
  };

  const evaluateClause = (record, clause) => {
    const raw = readRawValue(record, clause);

    if (clause.operator === 'IS_EMPTY') {
      return isEmptyValue(raw);
    }
    if (clause.operator === 'IS_NOT_EMPTY') {
      return !isEmptyValue(raw);
    }

    switch (clause.fieldType) {
      case 'DATETIME':
      case 'DATE':
      case 'TIME':
        return evaluateDateClause(raw, clause);
      case 'CHECK_BOX':
        return evaluateCheckboxClause(raw, clause);
      case 'RADIO_BUTTON':
      case 'DROP_DOWN':
      case 'STATUS':
        return evaluateStringClause(raw, clause);
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

  const ConditionEngine = { FIELD_TYPES, OPERATORS_BY_TYPE, evaluateCondition };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConditionEngine;
  } else {
    root.GroupFieldToggle = root.GroupFieldToggle || {};
    root.GroupFieldToggle.ConditionEngine = ConditionEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
