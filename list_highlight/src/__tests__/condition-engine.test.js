'use strict';

const ConditionEngine = require('../js/lib/condition-engine');

const record = (overrides) =>
  Object.assign(
    {
      status: { type: 'DROP_DOWN', value: '対応中' },
      priority: { type: 'NUMBER', value: '3' },
      memo: { type: 'MULTI_LINE_TEXT', value: '' },
    },
    overrides,
  );

describe('ConditionEngine.evaluateCondition (single clause operators)', () => {
  test('EQ matches an exact value', () => {
    const result = ConditionEngine.evaluateCondition(record(), {
      conditionOperator: 'AND',
      children: [{ fieldCode: 'status', operator: 'EQ', value: '対応中' }],
    });
    expect(result).toBe(true);
  });

  test('NEQ matches when values differ', () => {
    const result = ConditionEngine.evaluateCondition(record(), {
      conditionOperator: 'AND',
      children: [{ fieldCode: 'status', operator: 'NEQ', value: '完了' }],
    });
    expect(result).toBe(true);
  });

  test('CONTAINS matches a substring', () => {
    const result = ConditionEngine.evaluateCondition(
      record({ memo: { value: '至急対応してください' } }),
      {
        conditionOperator: 'AND',
        children: [{ fieldCode: 'memo', operator: 'CONTAINS', value: '至急' }],
      },
    );
    expect(result).toBe(true);
  });

  test('NOT_CONTAINS matches when the substring is absent', () => {
    const result = ConditionEngine.evaluateCondition(record(), {
      conditionOperator: 'AND',
      children: [
        { fieldCode: 'memo', operator: 'NOT_CONTAINS', value: '至急' },
      ],
    });
    expect(result).toBe(true);
  });

  test('GT/GTE/LT/LTE compare numerically', () => {
    const rec = record();
    expect(
      ConditionEngine.evaluateCondition(rec, {
        conditionOperator: 'AND',
        children: [{ fieldCode: 'priority', operator: 'GT', value: '2' }],
      }),
    ).toBe(true);
    expect(
      ConditionEngine.evaluateCondition(rec, {
        conditionOperator: 'AND',
        children: [{ fieldCode: 'priority', operator: 'GTE', value: '3' }],
      }),
    ).toBe(true);
    expect(
      ConditionEngine.evaluateCondition(rec, {
        conditionOperator: 'AND',
        children: [{ fieldCode: 'priority', operator: 'LT', value: '3' }],
      }),
    ).toBe(false);
    expect(
      ConditionEngine.evaluateCondition(rec, {
        conditionOperator: 'AND',
        children: [{ fieldCode: 'priority', operator: 'LTE', value: '3' }],
      }),
    ).toBe(true);
  });

  test('IS_EMPTY matches an empty string value', () => {
    const result = ConditionEngine.evaluateCondition(record(), {
      conditionOperator: 'AND',
      children: [{ fieldCode: 'memo', operator: 'IS_EMPTY' }],
    });
    expect(result).toBe(true);
  });

  test('IS_NOT_EMPTY matches a non-empty value', () => {
    const result = ConditionEngine.evaluateCondition(record(), {
      conditionOperator: 'AND',
      children: [{ fieldCode: 'status', operator: 'IS_NOT_EMPTY' }],
    });
    expect(result).toBe(true);
  });
});

describe('ConditionEngine.evaluateCondition (AND/OR combination)', () => {
  test('AND requires every clause to match', () => {
    const condition = {
      conditionOperator: 'AND',
      children: [
        { fieldCode: 'status', operator: 'EQ', value: '対応中' },
        { fieldCode: 'priority', operator: 'GTE', value: '5' },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record(), condition)).toBe(false);
  });

  test('OR matches when at least one clause matches', () => {
    const condition = {
      conditionOperator: 'OR',
      children: [
        { fieldCode: 'status', operator: 'EQ', value: '完了' },
        { fieldCode: 'priority', operator: 'GTE', value: '3' },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record(), condition)).toBe(true);
  });

  test('returns false when there are no clauses', () => {
    expect(
      ConditionEngine.evaluateCondition(record(), {
        conditionOperator: 'AND',
        children: [],
      }),
    ).toBe(false);
  });

  test('returns false instead of throwing when the field does not exist on the record', () => {
    const condition = {
      conditionOperator: 'AND',
      children: [{ fieldCode: 'not_exist', operator: 'EQ', value: 'x' }],
    };
    expect(ConditionEngine.evaluateCondition(record(), condition)).toBe(false);
  });
});
