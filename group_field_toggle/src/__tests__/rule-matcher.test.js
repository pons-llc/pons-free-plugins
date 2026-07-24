'use strict';

const RuleMatcher = require('../js/lib/rule-matcher');

const record = { status: { value: '対応中' } };

const matchRule = (overrides) =>
  Object.assign(
    {
      targetFieldCode: 'group_a',
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
  test('対象グループフィールドが一致するルールの中で、設定順で最初に一致したルールを返す', () => {
    const rules = [
      matchRule({ action: 'CLOSED' }),
      matchRule({ action: 'OPEN' }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules, 'group_a')).toBe(
      rules[0],
    );
  });

  test('対象グループフィールドが異なるルールは無視する', () => {
    const rules = [
      matchRule({ targetFieldCode: 'group_b', action: 'CLOSED' }),
      matchRule({ targetFieldCode: 'group_a', action: 'OPEN' }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules, 'group_a')).toBe(
      rules[1],
    );
  });

  test('一致しない条件のルールを飛ばし、最初に一致したものを返す', () => {
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
      matchRule({ action: 'OPEN' }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules, 'group_a')).toBe(
      rules[1],
    );
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
        action: 'OPEN',
      }),
      { targetFieldCode: 'group_a', mode: 'ALWAYS', action: 'CLOSED' },
    ];
    expect(RuleMatcher.findMatchingRule(record, rules, 'group_a')).toBe(
      rules[1],
    );
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
    expect(RuleMatcher.findMatchingRule(record, rules, 'group_a')).toBeNull();
  });

  test('ルールが0件ならnullを返す', () => {
    expect(RuleMatcher.findMatchingRule(record, [], 'group_a')).toBeNull();
  });
});
