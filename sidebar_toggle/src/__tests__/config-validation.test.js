'use strict';

const ConfigValidation = require('../js/lib/config-validation');

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

describe('ConfigValidation.validateRules', () => {
  test('空配列は許可する', () => {
    expect(ConfigValidation.validateRules([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('配列以外は拒否する', () => {
    expect(ConfigValidation.validateRules(null).valid).toBe(false);
  });

  test('正しいMATCHルールを許可する', () => {
    expect(ConfigValidation.validateRules([matchRule()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('正しいALWAYSルールを許可する(条件不要)', () => {
    const result = ConfigValidation.validateRules([
      { mode: 'ALWAYS', action: 'CLOSED' },
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('MATCHルールは条件が1つ以上必要', () => {
    const result = ConfigValidation.validateRules([
      matchRule({ condition: { conditionOperator: 'AND', children: [] } }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('条件のフィールド種別が不正なら拒否する', () => {
    const result = ConfigValidation.validateRules([
      matchRule({
        condition: {
          conditionOperator: 'AND',
          children: [
            { fieldType: 'NUMBER', fieldCode: 'x', operator: 'EQ', value: '1' },
          ],
        },
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('フィールド未選択を拒否する', () => {
    const result = ConfigValidation.validateRules([
      matchRule({
        condition: {
          conditionOperator: 'AND',
          children: [
            {
              fieldType: 'DROP_DOWN',
              fieldCode: '',
              operator: 'EQ',
              value: 'x',
            },
          ],
        },
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('フィールド種別で許可されていない演算子を拒否する(CHECK_BOXにGTは使えない)', () => {
    const result = ConfigValidation.validateRules([
      matchRule({
        condition: {
          conditionOperator: 'AND',
          children: [
            {
              fieldType: 'CHECK_BOX',
              fieldCode: 'tags',
              operator: 'GT',
              value: 'x',
            },
          ],
        },
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('IS_EMPTY/IS_NOT_EMPTY以外は値の入力を必須にする', () => {
    const result = ConfigValidation.validateRules([
      matchRule({
        condition: {
          conditionOperator: 'AND',
          children: [
            {
              fieldType: 'DROP_DOWN',
              fieldCode: 'status',
              operator: 'EQ',
              value: '',
            },
          ],
        },
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('IS_EMPTYは値が無くても許可する', () => {
    const result = ConfigValidation.validateRules([
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
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('サイドバーの動作が不正な値なら拒否する', () => {
    const result = ConfigValidation.validateRules([
      matchRule({ action: 'INVALID' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('条件モードが不正な値なら拒否する', () => {
    const result = ConfigValidation.validateRules([
      matchRule({ mode: 'SOMETHING' }),
    ]);
    expect(result.valid).toBe(false);
  });
});
