'use strict';

const QueryBuilder = require('../js/lib/query-builder');

const selfRecord = {
  customer_code: { type: 'SINGLE_LINE_TEXT', value: 'C001' },
  target_year: { type: 'NUMBER', value: '2024' },
  event_date: { type: 'DATE', value: '2024-07-09' },
};

describe('QueryBuilder.escapeQueryValue', () => {
  test('escapes backslashes before quotes', () => {
    expect(QueryBuilder.escapeQueryValue('sample"1"')).toBe('sample\\"1\\"');
    expect(QueryBuilder.escapeQueryValue('sample\\2\\')).toBe(
      'sample\\\\2\\\\',
    );
  });

  test('leaves ordinary strings untouched', () => {
    expect(QueryBuilder.escapeQueryValue('C001')).toBe('C001');
  });
});

describe('QueryBuilder.resolveConditionValue', () => {
  test('returns the fixed value when valueSource is FIXED', () => {
    const value = QueryBuilder.resolveConditionValue(
      { valueSource: 'FIXED', value: 'ABC' },
      selfRecord,
    );
    expect(value).toBe('ABC');
  });

  test('resolves the value from the self record when valueSource is SELF_FIELD', () => {
    const value = QueryBuilder.resolveConditionValue(
      { valueSource: 'SELF_FIELD', selfFieldCode: 'customer_code' },
      selfRecord,
    );
    expect(value).toBe('C001');
  });

  test('returns an empty string when the referenced self field does not exist', () => {
    const value = QueryBuilder.resolveConditionValue(
      { valueSource: 'SELF_FIELD', selfFieldCode: 'not_exist' },
      selfRecord,
    );
    expect(value).toBe('');
  });
});

describe('QueryBuilder.buildQuery', () => {
  test('builds the key-match clause from the self record value', () => {
    const query = QueryBuilder.buildQuery(
      {
        selfKeyFieldCode: 'customer_code',
        otherKeyFieldCode: 'code',
        conditions: [],
      },
      selfRecord,
      null,
    );
    expect(query).toBe('code like "C001" order by $id asc limit 500');
  });

  test('appends server-expressible conditions with and', () => {
    const query = QueryBuilder.buildQuery(
      {
        selfKeyFieldCode: 'customer_code',
        otherKeyFieldCode: 'code',
        conditions: [
          {
            fieldCode: 'year',
            operator: 'EQ',
            valueSource: 'SELF_FIELD',
            selfFieldCode: 'target_year',
          },
          {
            fieldCode: 'category',
            operator: 'CONTAINS',
            valueSource: 'FIXED',
            value: '定期',
          },
        ],
      },
      selfRecord,
      null,
    );
    expect(query).toBe(
      'code like "C001" and year = "2024" and category like "定期" order by $id asc limit 500',
    );
  });

  test('excludes client-only operators (SAME_MONTH/SAME_DAY) from the query', () => {
    const query = QueryBuilder.buildQuery(
      {
        selfKeyFieldCode: 'customer_code',
        otherKeyFieldCode: 'code',
        conditions: [
          {
            fieldCode: 'event_date',
            operator: 'SAME_MONTH',
            valueSource: 'SELF_FIELD',
            selfFieldCode: 'event_date',
          },
        ],
      },
      selfRecord,
      null,
    );
    expect(query).toBe('code like "C001" order by $id asc limit 500');
  });

  test('appends a $id exclusion clause when excludeRecordId is given (edit screen)', () => {
    const query = QueryBuilder.buildQuery(
      {
        selfKeyFieldCode: 'customer_code',
        otherKeyFieldCode: 'code',
        conditions: [],
      },
      selfRecord,
      42,
    );
    expect(query).toBe(
      'code like "C001" and $id != "42" order by $id asc limit 500',
    );
  });

  test('escapes quotes and backslashes found in resolved values', () => {
    const query = QueryBuilder.buildQuery(
      {
        selfKeyFieldCode: 'customer_code',
        otherKeyFieldCode: 'code',
        conditions: [],
      },
      { customer_code: { type: 'SINGLE_LINE_TEXT', value: 'A"B\\C' } },
      null,
    );
    expect(query).toBe('code like "A\\"B\\\\C" order by $id asc limit 500');
  });

  test('does not append a $id exclusion clause on the create screen (no excludeRecordId)', () => {
    const query = QueryBuilder.buildQuery(
      {
        selfKeyFieldCode: 'customer_code',
        otherKeyFieldCode: 'code',
        conditions: [],
      },
      selfRecord,
      undefined,
    );
    expect(query).not.toContain('$id !=');
  });
});
