const QueryBuilder = require('../js/lib/query-builder');

describe('QueryBuilder.build', () => {
  const baseReferenceTable = {
    relatedApp: { app: '3', code: '' },
    condition: { field: '顧客コード', relatedField: '顧客コード' },
    filterCond: '',
  };

  test('builds a simple match clause when there is no filterCond/exclusionCond', () => {
    const query = QueryBuilder.build(baseReferenceTable, {
      matchValue: 'C001',
    });
    expect(query).toBe('顧客コード = "C001"');
  });

  test('AND-combines the filterCond configured on the field with the match clause', () => {
    const referenceTable = { ...baseReferenceTable, filterCond: '数値_0 > 10' };
    const query = QueryBuilder.build(referenceTable, { matchValue: 'C001' });
    expect(query).toBe('(顧客コード = "C001") and (数値_0 > 10)');
  });

  test('AND-combines the exclusion condition entered on the settings screen', () => {
    const query = QueryBuilder.build(baseReferenceTable, {
      matchValue: 'C001',
      exclusionCond: 'ステータス not in ("完了")',
    });
    expect(query).toBe(
      '(顧客コード = "C001") and (ステータス not in ("完了"))',
    );
  });

  test('AND-combines filterCond and exclusionCond together with the match clause', () => {
    const referenceTable = { ...baseReferenceTable, filterCond: '数値_0 > 10' };
    const query = QueryBuilder.build(referenceTable, {
      matchValue: 'C001',
      exclusionCond: 'ステータス not in ("完了")',
    });
    expect(query).toBe(
      '(顧客コード = "C001") and (数値_0 > 10) and (ステータス not in ("完了"))',
    );
  });

  test('does not quote the match value when the matching field is numeric', () => {
    const referenceTable = {
      ...baseReferenceTable,
      condition: { field: '受注番号', relatedField: '受注番号' },
    };
    const query = QueryBuilder.build(referenceTable, {
      matchValue: '12345',
      isNumericMatchField: true,
    });
    expect(query).toBe('受注番号 = 12345');
  });

  test('escapes double quotes contained in the match value', () => {
    const query = QueryBuilder.build(baseReferenceTable, { matchValue: 'A"B' });
    expect(query).toBe('顧客コード = "A\\"B"');
  });

  // filterCondには LOGINUSER() のような動的条件がそのまま含まれることがある。
  // このライブラリは文字列としてそのままAND結合するだけで、評価はkintone側に委ねる
  // (判断記録.md「動的条件の互換性」を参照)。
  test('passes dynamic conditions such as LOGINUSER() through verbatim', () => {
    const referenceTable = {
      ...baseReferenceTable,
      filterCond: '担当者 in (LOGINUSER())',
    };
    const query = QueryBuilder.build(referenceTable, { matchValue: 'C001' });
    expect(query).toBe('(顧客コード = "C001") and (担当者 in (LOGINUSER()))');
  });

  test('throws when referenceTable.condition.relatedField is missing', () => {
    expect(() =>
      QueryBuilder.build({ condition: {} }, { matchValue: 'x' }),
    ).toThrow();
  });
});

describe('QueryBuilder.combineWithAnd', () => {
  test('ignores blank/empty clauses', () => {
    expect(QueryBuilder.combineWithAnd(['a = 1', '', '  ', 'b = 2'])).toBe(
      '(a = 1) and (b = 2)',
    );
  });

  test('returns an empty string when every clause is blank', () => {
    expect(QueryBuilder.combineWithAnd(['', '  '])).toBe('');
  });

  test('returns the single clause unparenthesized', () => {
    expect(QueryBuilder.combineWithAnd(['a = 1'])).toBe('a = 1');
  });
});
