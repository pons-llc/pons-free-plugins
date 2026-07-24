'use strict';

const RuleMatcher = require('../js/lib/rule-matcher');

const record = { status: { value: '対応中' } };

const matchRule = (overrides) =>
  Object.assign(
    {
      targetButton: 'ADD',
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
      action: 'HIDE',
    },
    overrides,
  );

describe('RuleMatcher.findMatchingRule', () => {
  test('対象ボタンが一致するルールの中で、設定順で最初に一致したルールを返す', () => {
    const rules = [
      matchRule({ action: 'HIDE' }),
      matchRule({ action: 'SHOW' }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules, 'ADD')).toBe(rules[0]);
  });

  test('対象ボタンが異なるルールは無視する', () => {
    const rules = [
      matchRule({ targetButton: 'EDIT', action: 'HIDE' }),
      matchRule({ targetButton: 'ADD', action: 'SHOW' }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules, 'ADD')).toBe(rules[1]);
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
        action: 'HIDE',
      }),
      matchRule({ action: 'SHOW' }),
    ];
    expect(RuleMatcher.findMatchingRule(record, rules, 'ADD')).toBe(rules[1]);
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
        action: 'SHOW',
      }),
      { targetButton: 'ADD', mode: 'ALWAYS', action: 'HIDE' },
    ];
    expect(RuleMatcher.findMatchingRule(record, rules, 'ADD')).toBe(rules[1]);
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
    expect(RuleMatcher.findMatchingRule(record, rules, 'ADD')).toBeNull();
  });

  test('ルールが0件ならnullを返す', () => {
    expect(RuleMatcher.findMatchingRule(record, [], 'ADD')).toBeNull();
  });

  test('record が null(レコード文脈が無い画面)の場合、MATCHルールは一致しない', () => {
    const rules = [matchRule({ action: 'HIDE' })];
    expect(RuleMatcher.findMatchingRule(null, rules, 'ADD')).toBeNull();
  });

  test('record が null でも、ALWAYSルールは一致する', () => {
    const rules = [{ targetButton: 'ADD', mode: 'ALWAYS', action: 'HIDE' }];
    expect(RuleMatcher.findMatchingRule(null, rules, 'ADD')).toBe(rules[0]);
  });

  test('record が null の場合、IS_EMPTY条件のMATCHルールも誤って一致させない', () => {
    const rules = [
      matchRule({
        condition: {
          conditionOperator: 'AND',
          children: [
            {
              fieldType: 'DROP_DOWN',
              fieldCode: 'status',
              operator: 'IS_EMPTY',
            },
          ],
        },
      }),
    ];
    expect(RuleMatcher.findMatchingRule(null, rules, 'ADD')).toBeNull();
  });
});
