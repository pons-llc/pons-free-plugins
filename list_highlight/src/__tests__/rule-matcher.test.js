'use strict';

const RuleMatcher = require('../js/lib/rule-matcher');

const record = { status: { type: 'DROP_DOWN', value: '対応中' } };

const rule = (overrides) =>
  Object.assign(
    {
      condition: {
        conditionOperator: 'AND',
        children: [{ fieldCode: 'status', operator: 'EQ', value: '対応中' }],
      },
      backgroundColor: '#ff0000',
    },
    overrides,
  );

describe('RuleMatcher.findMatchingRule', () => {
  test('returns the first matching rule', () => {
    const rules = [
      rule({ backgroundColor: '#111111' }),
      rule({ backgroundColor: '#222222' }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules)).toBe(rules[0]);
  });

  test('skips non-matching rules and returns the first one that matches', () => {
    const rules = [
      rule({
        condition: {
          conditionOperator: 'AND',
          children: [{ fieldCode: 'status', operator: 'EQ', value: '完了' }],
        },
        backgroundColor: '#111111',
      }),
      rule({ backgroundColor: '#222222' }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules)).toBe(rules[1]);
  });

  test('returns null when no rule matches', () => {
    const rules = [
      rule({
        condition: {
          conditionOperator: 'AND',
          children: [{ fieldCode: 'status', operator: 'EQ', value: '完了' }],
        },
      }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules)).toBeNull();
  });

  test('returns null when the rule list is empty', () => {
    expect(RuleMatcher.findMatchingRule(record, [])).toBeNull();
  });
});
