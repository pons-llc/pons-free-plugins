(function (root) {
  'use strict';

  // 取得元アプリへのクエリ文字列を、検索条件の配列(フィールドコード・演算子・値)から合成する。
  // 値は「固定値(CONSTANT)」または「自レコードのフィールド参照(RECORD_FIELD)」のいずれかで、
  // resolveConditionValue()がその切り替えを担う(構想1・4と共通のインターフェース)。

  // NUMBERフィールドの値はクエリ上で引用符なしの数値リテラルとして扱う。
  // それ以外(文字列・選択肢・日付など)はダブルクオートで囲んだ文字列リテラルとして扱う
  // (kintoneのクエリ記法上、日付/日時も文字列として引用符付きで指定するため)。
  const NUMERIC_FIELD_TYPES = ['NUMBER', 'CALC'];

  const SET_OPERATORS = ['in', 'not in'];

  // クエリ文字列内のダブルクオート・バックスラッシュをエスケープする
  // (kintoneクエリの書き方: エスケープ処理の節に準拠)。
  const escapeStringLiteral = (value) =>
    String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const formatLiteral = (value, fieldType) => {
    if (NUMERIC_FIELD_TYPES.includes(fieldType)) {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw new Error(`数値として解釈できない値です: ${String(value)}`);
      }
      return String(num);
    }
    return `"${escapeStringLiteral(value)}"`;
  };

  const formatValue = (operator, value, fieldType) => {
    if (SET_OPERATORS.includes(operator)) {
      const values = Array.isArray(value) ? value : [value];
      return `(${values.map((v) => formatLiteral(v, fieldType)).join(', ')})`;
    }
    return formatLiteral(value, fieldType);
  };

  // 1件の検索条件(フィールドコード・演算子・型)と、解決済みの値から「フィールドコード 演算子 値」節を作る。
  const buildConditionClause = (condition, resolvedValue) => {
    if (!condition || !condition.fieldCode || !condition.operator) {
      throw new Error('検索条件にはfieldCodeとoperatorが必須です');
    }
    return `${condition.fieldCode} ${condition.operator} ${formatValue(
      condition.operator,
      resolvedValue,
      condition.fieldType,
    )}`;
  };

  // 値ソース(CONSTANT/RECORD_FIELD)に応じて、実際にクエリへ埋め込む値を解決する。
  // RECORD_FIELDの場合は現在開いているレコード(kintone.app.record.get()の戻り値のrecord)から読む。
  const resolveConditionValue = (condition, currentRecord) => {
    if (!condition) {
      throw new Error('検索条件が指定されていません');
    }
    if (condition.valueSource === 'RECORD_FIELD') {
      const sourceFieldCode = condition.sourceFieldCode;
      const sourceField =
        currentRecord && sourceFieldCode
          ? currentRecord[sourceFieldCode]
          : null;
      if (!sourceField) {
        throw new Error(
          `自レコードのフィールドが見つかりません: ${String(sourceFieldCode)}`,
        );
      }
      return sourceField.value;
    }
    return condition.value;
  };

  // 検索条件配列全体を"and"で連結したクエリ文字列(order by / limit / offsetは含まない)を組み立てる。
  // ページング用の$id条件や並び順は、id-paging.jsが別途付与する。
  const buildQuery = (conditions, currentRecord) => {
    const clauses = (conditions || []).map((condition) => {
      const resolvedValue = resolveConditionValue(condition, currentRecord);
      return buildConditionClause(condition, resolvedValue);
    });
    return clauses.join(' and ');
  };

  const QueryBuilder = {
    escapeStringLiteral,
    formatLiteral,
    formatValue,
    buildConditionClause,
    resolveConditionValue,
    buildQuery,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QueryBuilder;
  } else {
    root.RecordsToSubtable = root.RecordsToSubtable || {};
    root.RecordsToSubtable.QueryBuilder = QueryBuilder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
