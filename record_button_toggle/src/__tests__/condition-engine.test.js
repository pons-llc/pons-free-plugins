'use strict';

const ConditionEngine = require('../js/lib/condition-engine');

describe('ConditionEngine.evaluateCondition', () => {
  test('RADIO_BUTTON/DROP_DOWNはEQ/NEQで文字列一致判定する', () => {
    const record = { status: { value: 'A' } };
    const condition = {
      conditionOperator: 'AND',
      children: [
        {
          fieldType: 'RADIO_BUTTON',
          fieldCode: 'status',
          operator: 'EQ',
          value: 'A',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, condition)).toBe(true);

    const neq = {
      conditionOperator: 'AND',
      children: [
        {
          fieldType: 'DROP_DOWN',
          fieldCode: 'status',
          operator: 'NEQ',
          value: 'A',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, neq)).toBe(false);
  });

  test('CHECK_BOXはCONTAINS/NOT_CONTAINSで配列に含まれるかを判定する', () => {
    const record = { tags: { value: ['x', 'y'] } };
    const contains = {
      conditionOperator: 'AND',
      children: [
        {
          fieldType: 'CHECK_BOX',
          fieldCode: 'tags',
          operator: 'CONTAINS',
          value: 'x',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, contains)).toBe(true);

    const notContains = {
      conditionOperator: 'AND',
      children: [
        {
          fieldType: 'CHECK_BOX',
          fieldCode: 'tags',
          operator: 'NOT_CONTAINS',
          value: 'z',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, notContains)).toBe(true);
  });

  test('CHECK_BOXで値が空配列の場合はCONTAINSが常にfalseになる', () => {
    const record = { tags: { value: [] } };
    const condition = {
      conditionOperator: 'AND',
      children: [
        {
          fieldType: 'CHECK_BOX',
          fieldCode: 'tags',
          operator: 'CONTAINS',
          value: 'x',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, condition)).toBe(false);
  });

  test('DATETIME/DATE/TIMEはDate.parseで数値比較する(GT/GTE/LT/LTE/EQ/NEQ)', () => {
    const record = { due: { value: '2026-08-01T00:00:00Z' } };
    const after = {
      conditionOperator: 'AND',
      children: [
        {
          fieldType: 'DATETIME',
          fieldCode: 'due',
          operator: 'GT',
          value: '2026-07-01T00:00:00Z',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, after)).toBe(true);

    const before = {
      conditionOperator: 'AND',
      children: [
        {
          fieldType: 'DATETIME',
          fieldCode: 'due',
          operator: 'LT',
          value: '2026-07-01T00:00:00Z',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, before)).toBe(false);
  });

  test('日時が不正な値(パース不能)の場合、GT系の比較は常にfalseになる', () => {
    const record = { due: { value: 'not-a-date' } };
    const condition = {
      conditionOperator: 'AND',
      children: [
        {
          fieldType: 'DATETIME',
          fieldCode: 'due',
          operator: 'GT',
          value: '2026-07-01',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, condition)).toBe(false);
  });

  test('STATUSはフィールドコードに関わらずrecord.ステータスを固定名で読む', () => {
    const record = {
      ステータス: { value: '承認済み' },
      statusCode: { value: '未着手' },
    };
    const condition = {
      conditionOperator: 'AND',
      children: [
        {
          fieldType: 'STATUS',
          fieldCode: 'statusCode',
          operator: 'EQ',
          value: '承認済み',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, condition)).toBe(true);
  });

  test('IS_EMPTY/IS_NOT_EMPTYはフィールド種別を問わず値の有無を判定する', () => {
    const record = { memo: { value: '' }, tags: { value: [] } };
    const emptyCondition = {
      conditionOperator: 'AND',
      children: [
        { fieldType: 'DROP_DOWN', fieldCode: 'memo', operator: 'IS_EMPTY' },
        { fieldType: 'CHECK_BOX', fieldCode: 'tags', operator: 'IS_EMPTY' },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, emptyCondition)).toBe(
      true,
    );
  });

  test('OR結合はいずれか1つの条件が真であれば真になる', () => {
    const record = { status: { value: 'B' } };
    const condition = {
      conditionOperator: 'OR',
      children: [
        {
          fieldType: 'RADIO_BUTTON',
          fieldCode: 'status',
          operator: 'EQ',
          value: 'A',
        },
        {
          fieldType: 'RADIO_BUTTON',
          fieldCode: 'status',
          operator: 'EQ',
          value: 'B',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, condition)).toBe(true);
  });

  test('条件が0件の場合は「一致なし」として扱う', () => {
    const record = { status: { value: 'A' } };
    expect(
      ConditionEngine.evaluateCondition(record, {
        conditionOperator: 'AND',
        children: [],
      }),
    ).toBe(false);
  });

  test('存在しないフィールドを参照してもtrueを返さない', () => {
    const record = { status: { value: 'A' } };
    const condition = {
      conditionOperator: 'AND',
      children: [
        {
          fieldType: 'RADIO_BUTTON',
          fieldCode: 'not_exist',
          operator: 'EQ',
          value: 'A',
        },
      ],
    };
    expect(ConditionEngine.evaluateCondition(record, condition)).toBe(false);
  });
});
