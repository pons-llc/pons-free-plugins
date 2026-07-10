const ConditionEngine = require('../js/lib/condition-engine');

describe('ConditionEngine.evaluate — clause operators', () => {
  test('EQ: matches when the field value equals the comparison value', () => {
    const node = {
      type: 'clause',
      fieldCode: 'status',
      operator: 'EQ',
      value: 'done',
    };
    expect(ConditionEngine.evaluate(node, { status: { value: 'done' } })).toBe(
      true,
    );
    expect(ConditionEngine.evaluate(node, { status: { value: 'open' } })).toBe(
      false,
    );
  });

  test('NEQ: matches when the field value differs from the comparison value', () => {
    const node = {
      type: 'clause',
      fieldCode: 'status',
      operator: 'NEQ',
      value: 'done',
    };
    expect(ConditionEngine.evaluate(node, { status: { value: 'open' } })).toBe(
      true,
    );
    expect(ConditionEngine.evaluate(node, { status: { value: 'done' } })).toBe(
      false,
    );
  });

  test('GT/GTE/LT/LTE compare numerically when both sides look numeric', () => {
    const gt = {
      type: 'clause',
      fieldCode: 'amount',
      operator: 'GT',
      value: '100',
    };
    expect(ConditionEngine.evaluate(gt, { amount: { value: '150' } })).toBe(
      true,
    );
    expect(ConditionEngine.evaluate(gt, { amount: { value: '100' } })).toBe(
      false,
    );

    const gte = {
      type: 'clause',
      fieldCode: 'amount',
      operator: 'GTE',
      value: '100',
    };
    expect(ConditionEngine.evaluate(gte, { amount: { value: '100' } })).toBe(
      true,
    );

    const lt = {
      type: 'clause',
      fieldCode: 'amount',
      operator: 'LT',
      value: '100',
    };
    expect(ConditionEngine.evaluate(lt, { amount: { value: '99' } })).toBe(
      true,
    );

    const lte = {
      type: 'clause',
      fieldCode: 'amount',
      operator: 'LTE',
      value: '100',
    };
    expect(ConditionEngine.evaluate(lte, { amount: { value: '100' } })).toBe(
      true,
    );
  });

  test('GT/LT fall back to lexical string comparison for non-numeric values (e.g. ISO dates)', () => {
    const node = {
      type: 'clause',
      fieldCode: 'date',
      operator: 'GT',
      value: '2026-01-01',
    };
    expect(
      ConditionEngine.evaluate(node, { date: { value: '2026-07-09' } }),
    ).toBe(true);
    expect(
      ConditionEngine.evaluate(node, { date: { value: '2025-12-31' } }),
    ).toBe(false);
  });

  test('CONTAINS matches substrings for text fields', () => {
    const node = {
      type: 'clause',
      fieldCode: 'memo',
      operator: 'CONTAINS',
      value: '至急',
    };
    expect(
      ConditionEngine.evaluate(node, {
        memo: { value: 'これは至急の案件です' },
      }),
    ).toBe(true);
    expect(
      ConditionEngine.evaluate(node, { memo: { value: '通常案件' } }),
    ).toBe(false);
  });

  test('CONTAINS matches array membership for multi-value fields (checkbox etc.)', () => {
    const node = {
      type: 'clause',
      fieldCode: 'tags',
      operator: 'CONTAINS',
      value: 'urgent',
    };
    expect(
      ConditionEngine.evaluate(node, { tags: { value: ['urgent', 'vip'] } }),
    ).toBe(true);
    expect(ConditionEngine.evaluate(node, { tags: { value: ['vip'] } })).toBe(
      false,
    );
  });

  test('NOT_CONTAINS is the negation of CONTAINS', () => {
    const node = {
      type: 'clause',
      fieldCode: 'memo',
      operator: 'NOT_CONTAINS',
      value: '至急',
    };
    expect(
      ConditionEngine.evaluate(node, { memo: { value: '通常案件' } }),
    ).toBe(true);
    expect(
      ConditionEngine.evaluate(node, {
        memo: { value: 'これは至急の案件です' },
      }),
    ).toBe(false);
  });

  test('IS_EMPTY / IS_NOT_EMPTY treat missing fields, blank strings and empty arrays as empty', () => {
    const isEmpty = { type: 'clause', fieldCode: 'memo', operator: 'IS_EMPTY' };
    expect(ConditionEngine.evaluate(isEmpty, { memo: { value: '' } })).toBe(
      true,
    );
    expect(ConditionEngine.evaluate(isEmpty, { memo: { value: 'x' } })).toBe(
      false,
    );
    expect(ConditionEngine.evaluate(isEmpty, {})).toBe(true);
    expect(ConditionEngine.evaluate(isEmpty, { tags: { value: [] } })).toBe(
      true,
    );

    const isNotEmpty = {
      type: 'clause',
      fieldCode: 'memo',
      operator: 'IS_NOT_EMPTY',
    };
    expect(ConditionEngine.evaluate(isNotEmpty, { memo: { value: 'x' } })).toBe(
      true,
    );
    expect(ConditionEngine.evaluate(isNotEmpty, { memo: { value: '' } })).toBe(
      false,
    );
  });

  test('an unknown operator is treated as non-matching rather than throwing', () => {
    const node = {
      type: 'clause',
      fieldCode: 'memo',
      operator: 'NOPE',
      value: 'x',
    };
    expect(ConditionEngine.evaluate(node, { memo: { value: 'x' } })).toBe(
      false,
    );
  });
});

describe('ConditionEngine.evaluate — AND/OR groups', () => {
  const record = {
    status: { value: 'done' },
    amount: { value: '500' },
  };

  test('AND group requires every child to match', () => {
    const node = {
      type: 'group',
      conditionOperator: 'AND',
      children: [
        { type: 'clause', fieldCode: 'status', operator: 'EQ', value: 'done' },
        { type: 'clause', fieldCode: 'amount', operator: 'GTE', value: '500' },
      ],
    };
    expect(ConditionEngine.evaluate(node, record)).toBe(true);

    const failing = {
      type: 'group',
      conditionOperator: 'AND',
      children: [
        { type: 'clause', fieldCode: 'status', operator: 'EQ', value: 'done' },
        { type: 'clause', fieldCode: 'amount', operator: 'GT', value: '500' },
      ],
    };
    expect(ConditionEngine.evaluate(failing, record)).toBe(false);
  });

  test('OR group requires at least one child to match', () => {
    const node = {
      type: 'group',
      conditionOperator: 'OR',
      children: [
        { type: 'clause', fieldCode: 'status', operator: 'EQ', value: 'open' },
        { type: 'clause', fieldCode: 'amount', operator: 'GTE', value: '500' },
      ],
    };
    expect(ConditionEngine.evaluate(node, record)).toBe(true);
  });

  test('a group with no children evaluates to true (no condition means always trigger)', () => {
    const node = { type: 'group', conditionOperator: 'AND', children: [] };
    expect(ConditionEngine.evaluate(node, record)).toBe(true);
  });

  test('groups can be nested arbitrarily (AND containing an OR)', () => {
    const node = {
      type: 'group',
      conditionOperator: 'AND',
      children: [
        { type: 'clause', fieldCode: 'status', operator: 'EQ', value: 'done' },
        {
          type: 'group',
          conditionOperator: 'OR',
          children: [
            {
              type: 'clause',
              fieldCode: 'amount',
              operator: 'GT',
              value: '1000',
            },
            {
              type: 'clause',
              fieldCode: 'amount',
              operator: 'EQ',
              value: '500',
            },
          ],
        },
      ],
    };
    expect(ConditionEngine.evaluate(node, record)).toBe(true);
  });

  test('a null/undefined condition tree is treated as always-true (unconfigured = always trigger)', () => {
    expect(ConditionEngine.evaluate(null, record)).toBe(true);
    expect(ConditionEngine.evaluate(undefined, record)).toBe(true);
  });
});
