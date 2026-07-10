const QueryBuilder = require('../js/lib/query-builder');

describe('QueryBuilder.escapeStringLiteral', () => {
  test('escapes backslashes before double quotes', () => {
    expect(QueryBuilder.escapeStringLiteral('sample\\2\\')).toBe(
      'sample\\\\2\\\\',
    );
  });

  test('escapes double quotes', () => {
    expect(QueryBuilder.escapeStringLiteral('sample"1"')).toBe('sample\\"1\\"');
  });
});

describe('QueryBuilder.formatValue', () => {
  test('a NUMBER field is formatted as an unquoted numeric literal', () => {
    expect(QueryBuilder.formatValue('>', '10', 'NUMBER')).toBe('10');
  });

  test('a non-NUMBER field is formatted as a quoted, escaped string literal', () => {
    expect(
      QueryBuilder.formatValue('=', 'サイボウズ株式会社', 'SINGLE_LINE_TEXT'),
    ).toBe('"サイボウズ株式会社"');
  });

  test('in/not in wrap a single value in parentheses', () => {
    expect(QueryBuilder.formatValue('in', 'A', 'DROP_DOWN')).toBe('("A")');
  });

  test('in/not in wrap an array of values in a comma-separated parenthesised list', () => {
    expect(QueryBuilder.formatValue('in', ['A', 'B'], 'DROP_DOWN')).toBe(
      '("A", "B")',
    );
  });

  test('throws when a NUMBER value cannot be parsed as a number', () => {
    expect(() => QueryBuilder.formatValue('=', 'abc', 'NUMBER')).toThrow();
  });
});

describe('QueryBuilder.buildConditionClause', () => {
  test('builds a "fieldCode operator value" clause', () => {
    const condition = {
      fieldCode: 'customer_code',
      operator: '=',
      fieldType: 'SINGLE_LINE_TEXT',
    };
    expect(QueryBuilder.buildConditionClause(condition, 'C001')).toBe(
      'customer_code = "C001"',
    );
  });

  test('throws when fieldCode is missing', () => {
    expect(() =>
      QueryBuilder.buildConditionClause(
        { operator: '=', fieldType: 'SINGLE_LINE_TEXT' },
        'x',
      ),
    ).toThrow();
  });

  test('throws when operator is missing', () => {
    expect(() =>
      QueryBuilder.buildConditionClause(
        { fieldCode: 'a', fieldType: 'SINGLE_LINE_TEXT' },
        'x',
      ),
    ).toThrow();
  });
});

describe('QueryBuilder.resolveConditionValue', () => {
  test('CONSTANT returns the condition value as-is', () => {
    const condition = { valueSource: 'CONSTANT', value: 'C001' };
    expect(QueryBuilder.resolveConditionValue(condition, {})).toBe('C001');
  });

  test('RECORD_FIELD reads the value from the current record', () => {
    const condition = {
      valueSource: 'RECORD_FIELD',
      sourceFieldCode: 'customer_code',
    };
    const currentRecord = {
      customer_code: { type: 'SINGLE_LINE_TEXT', value: 'C002' },
    };
    expect(QueryBuilder.resolveConditionValue(condition, currentRecord)).toBe(
      'C002',
    );
  });

  test('RECORD_FIELD throws when the referenced field is missing from the current record', () => {
    const condition = {
      valueSource: 'RECORD_FIELD',
      sourceFieldCode: 'missing_field',
    };
    expect(() => QueryBuilder.resolveConditionValue(condition, {})).toThrow();
  });
});

describe('QueryBuilder.buildQuery', () => {
  test('joins multiple conditions with "and"', () => {
    const conditions = [
      {
        fieldCode: 'status',
        operator: 'in',
        fieldType: 'DROP_DOWN',
        valueSource: 'CONSTANT',
        value: ['対応中'],
      },
      {
        fieldCode: 'amount',
        operator: '>=',
        fieldType: 'NUMBER',
        valueSource: 'CONSTANT',
        value: '100',
      },
    ];
    expect(QueryBuilder.buildQuery(conditions, {})).toBe(
      'status in ("対応中") and amount >= 100',
    );
  });

  test('resolves RECORD_FIELD conditions against the current record', () => {
    const conditions = [
      {
        fieldCode: 'customer_code',
        operator: '=',
        fieldType: 'SINGLE_LINE_TEXT',
        valueSource: 'RECORD_FIELD',
        sourceFieldCode: 'own_customer_code',
      },
    ];
    const currentRecord = {
      own_customer_code: { type: 'SINGLE_LINE_TEXT', value: 'C003' },
    };
    expect(QueryBuilder.buildQuery(conditions, currentRecord)).toBe(
      'customer_code = "C003"',
    );
  });

  test('returns an empty string when there are no conditions', () => {
    expect(QueryBuilder.buildQuery([], {})).toBe('');
  });
});
