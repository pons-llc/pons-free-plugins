'use strict';

const { load, serialize, DEFAULTS } = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('未設定(rawConfigがnull)の場合はデフォルト値を返す', () => {
    expect(load(null)).toEqual(DEFAULTS);
  });

  test('保存済みの値をパースして返す', () => {
    const raw = {
      assigneeFieldCode: JSON.stringify('worker'),
      dateFieldCode: JSON.stringify('due_date'),
      endDateFieldCode: JSON.stringify('end_due_date'),
      templateFieldCodes: JSON.stringify(['title', 'memo']),
      groupCodes: JSON.stringify(['g1', 'g2']),
    };
    expect(load(raw)).toEqual({
      assigneeFieldCode: 'worker',
      dateFieldCode: 'due_date',
      endDateFieldCode: 'end_due_date',
      templateFieldCodes: ['title', 'memo'],
      groupCodes: ['g1', 'g2'],
    });
  });

  test('壊れたJSONは既定値にフォールバックする', () => {
    const raw = {
      assigneeFieldCode: 'not-json',
      templateFieldCodes: 'not-json-array',
      groupCodes: '{}',
    };
    const result = load(raw);
    expect(result.assigneeFieldCode).toBe('');
    expect(result.templateFieldCodes).toEqual([]);
    expect(result.groupCodes).toEqual([]);
  });
});

describe('ConfigStore.serialize', () => {
  test('保存用の文字列オブジェクトに変換する', () => {
    const serialized = serialize({
      assigneeFieldCode: 'worker',
      dateFieldCode: '',
      endDateFieldCode: 'end_due_date',
      templateFieldCodes: ['title'],
      groupCodes: ['g1'],
    });
    expect(JSON.parse(serialized.assigneeFieldCode)).toBe('worker');
    expect(JSON.parse(serialized.dateFieldCode)).toBe('');
    expect(JSON.parse(serialized.endDateFieldCode)).toBe('end_due_date');
    expect(JSON.parse(serialized.templateFieldCodes)).toEqual(['title']);
    expect(JSON.parse(serialized.groupCodes)).toEqual(['g1']);
  });

  test('配列でない値は空配列として保存する', () => {
    const serialized = serialize({});
    expect(JSON.parse(serialized.templateFieldCodes)).toEqual([]);
    expect(JSON.parse(serialized.groupCodes)).toEqual([]);
  });
});
