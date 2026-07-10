(function (root) {
  'use strict';

  // 関連レコード一覧フィールドの設定(GET /k/v1/app/form/fields.json の referenceTable)と、
  // 自レコードの値・除外条件から、参照先アプリへの集計用クエリ文字列を合成する。
  //
  // referenceTable の形:
  //   {
  //     relatedApp: { app: '3', code: '' },
  //     condition: { field: 'このアプリのフィールド', relatedField: '参照先アプリのフィールド' },
  //     filterCond: '数値_0 > 10 and 数値_1 > 20', // 「さらに絞り込む条件」。未設定なら空文字列
  //   }

  // クエリ内の文字列リテラルをダブルクォートで囲むため、内部のダブルクォートをエスケープする。
  const escapeForQuery = (value) => String(value).replace(/"/g, '\\"');

  // 関連付けフィールド(condition.relatedField)への一致条件を1句として組み立てる。
  // isNumericMatchField が true の場合は数値フィールドとして扱い、値をクオートしない
  // (kintoneのクエリ記法では数値フィールドの比較値はクオートしない)。
  const buildMatchClause = (relatedField, matchValue, isNumericMatchField) => {
    if (isNumericMatchField) {
      return `${relatedField} = ${matchValue}`;
    }
    return `${relatedField} = "${escapeForQuery(matchValue)}"`;
  };

  // 複数のクエリ句(空文字列は無視)を " and " で結合する。1句のみの場合は括弧を付けない。
  const combineWithAnd = (clauses) => {
    const nonEmpty = clauses
      .map((c) => (c || '').trim())
      .filter((c) => c.length > 0);
    if (nonEmpty.length === 0) {
      return '';
    }
    if (nonEmpty.length === 1) {
      return nonEmpty[0];
    }
    return nonEmpty.map((c) => `(${c})`).join(' and ');
  };

  // referenceTable設定 + 自レコードの一致値 + 除外条件(exclusionCond)から
  // 集計対象を絞り込むクエリ文字列を組み立てる。
  //
  // options:
  //   - matchValue: 自レコードの condition.field の値(関連付けフィールドに一致させる値)
  //   - isNumericMatchField: matchValue が数値フィールドの値かどうか
  //   - exclusionCond: 設定画面で指定した除外条件(クエリの断片。空文字列可)
  const build = (
    referenceTable,
    { matchValue, isNumericMatchField = false, exclusionCond = '' } = {},
  ) => {
    if (
      !referenceTable ||
      !referenceTable.condition ||
      !referenceTable.condition.relatedField
    ) {
      throw new Error(
        'referenceTable.condition.relatedField が指定されていません。',
      );
    }
    const matchClause = buildMatchClause(
      referenceTable.condition.relatedField,
      matchValue,
      isNumericMatchField,
    );
    return combineWithAnd([
      matchClause,
      referenceTable.filterCond,
      exclusionCond,
    ]);
  };

  const QueryBuilder = {
    build,
    combineWithAnd,
    buildMatchClause,
    escapeForQuery,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QueryBuilder;
  } else {
    root.RelatedRecordSummary = root.RelatedRecordSummary || {};
    root.RelatedRecordSummary.QueryBuilder = QueryBuilder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
