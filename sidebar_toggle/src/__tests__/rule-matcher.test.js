'use strict';

const RuleMatcher = require('../js/lib/rule-matcher');

const record = { status: { value: '対応中' } };

const matchRule = (overrides) =>
  Object.assign(
    {
      mode: 'MATCH',
      condition: {
        conditionOperator: 'AND',
        children: [
          {
            fieldType: 'DROP_DOWN',
            fieldCode: 'status',
            operator: 'EQ',
            value: '対応中',
          },
        ],
      },
      action: 'CLOSED',
    },
    overrides,
  );

describe('RuleMatcher.findMatchingRule', () => {
  test('設定順で最初に一致したルールを返す', () => {
    const rules = [
      matchRule({ action: 'CLOSED' }),
      matchRule({ action: 'OPEN_COMMENTS' }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules)).toBe(rules[0]);
  });

  test('一致しないルールを飛ばし、最初に一致したものを返す', () => {
    const rules = [
      matchRule({
        condition: {
          conditionOperator: 'AND',
          children: [
            {
              fieldType: 'DROP_DOWN',
              fieldCode: 'status',
              operator: 'EQ',
              value: '完了',
            },
          ],
        },
        action: 'CLOSED',
      }),
      matchRule({ action: 'OPEN_COMMENTS' }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules)).toBe(rules[1]);
  });

  test('mode: ALWAYSのルールは条件を無視して常に一致する', () => {
    const rules = [
      matchRule({
        condition: {
          conditionOperator: 'AND',
          children: [
            {
              fieldType: 'DROP_DOWN',
              fieldCode: 'status',
              operator: 'EQ',
              value: '完了',
            },
          ],
        },
        action: 'OPEN_COMMENTS',
      }),
      { mode: 'ALWAYS', action: 'CLOSED' },
    ];
    expect(RuleMatcher.findMatchingRule(record, rules)).toBe(rules[1]);
  });

  test('一致するルールが無ければnullを返す', () => {
    const rules = [
      matchRule({
        condition: {
          conditionOperator: 'AND',
          children: [
            {
              fieldType: 'DROP_DOWN',
              fieldCode: 'status',
              operator: 'EQ',
              value: '完了',
            },
          ],
        },
      }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules)).toBeNull();
  });

  test('ルールが0件ならnullを返す', () => {
    expect(RuleMatcher.findMatchingRule(record, [])).toBeNull();
  });
});
