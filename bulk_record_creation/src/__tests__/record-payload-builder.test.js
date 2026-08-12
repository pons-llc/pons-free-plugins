'use strict';

const { buildRecords } = require('../js/lib/record-payload-builder');

describe('buildRecords', () => {
  const templatePatch = {
    title: { value: 'タスク' },
    memo: { value: 'メモ' },
  };

  test('対象者・日付のどちらも無ければテンプレート値のみで1件作る', () => {
    const records = buildRecords({ templatePatch });
    expect(records).toEqual([
      { title: { value: 'タスク' }, memo: { value: 'メモ' } },
    ]);
  });

  test('対象者のみ指定した場合、対象者の数だけレコードを作る', () => {
    const records = buildRecords({
      templatePatch,
      assignee: {
        fieldCode: 'worker',
        entries: [
          { code: 'sato', name: '佐藤' },
          { code: 'kato', name: '加藤' },
        ],
      },
    });
    expect(records).toEqual([
      {
        title: { value: 'タスク' },
        memo: { value: 'メモ' },
        worker: { value: [{ code: 'sato' }] },
      },
      {
        title: { value: 'タスク' },
        memo: { value: 'メモ' },
        worker: { value: [{ code: 'kato' }] },
      },
    ]);
  });

  test('日付のみ指定した場合、日付の数だけレコードを作る', () => {
    const records = buildRecords({
      templatePatch,
      dates: { fieldCode: 'due_date', values: ['2024-01-01', '2024-01-08'] },
    });
    expect(records).toEqual([
      {
        title: { value: 'タスク' },
        memo: { value: 'メモ' },
        due_date: { value: '2024-01-01' },
      },
      {
        title: { value: 'タスク' },
        memo: { value: 'メモ' },
        due_date: { value: '2024-01-08' },
      },
    ]);
  });

  test('対象者×日付の直積でレコードを作る(対象者を外側、日付を内側の順)', () => {
    const records = buildRecords({
      templatePatch: { title: { value: 'タスク' } },
      assignee: {
        fieldCode: 'worker',
        entries: [
          { code: 'sato', name: '佐藤' },
          { code: 'kato', name: '加藤' },
        ],
      },
      dates: { fieldCode: 'due_date', values: ['2024-01-01', '2024-01-08'] },
    });
    expect(records).toHaveLength(4);
    expect(
      records.map((r) => [r.worker.value[0].code, r.due_date.value]),
    ).toEqual([
      ['sato', '2024-01-01'],
      ['sato', '2024-01-08'],
      ['kato', '2024-01-01'],
      ['kato', '2024-01-08'],
    ]);
  });

  test('対象者entriesが空配列の場合は0件になる(積の性質)', () => {
    const records = buildRecords({
      templatePatch,
      assignee: { fieldCode: 'worker', entries: [] },
      dates: { fieldCode: 'due_date', values: ['2024-01-01'] },
    });
    expect(records).toEqual([]);
  });

  test('生成したレコード同士がtemplatePatchの参照を共有しない', () => {
    const records = buildRecords({
      templatePatch,
      assignee: {
        fieldCode: 'worker',
        entries: [{ code: 'sato', name: '佐藤' }],
      },
    });
    records[0].title.value = '書き換え';
    expect(templatePatch.title.value).toBe('タスク');
  });

  test('終了日時フィールドが指定されている場合、valuesと同じ添字のendValuesを対で書き込む(直積の次元は増やさない)', () => {
    const records = buildRecords({
      templatePatch: { title: { value: 'タスク' } },
      assignee: {
        fieldCode: 'worker',
        entries: [{ code: 'sato', name: '佐藤' }],
      },
      dates: {
        fieldCode: 'start_datetime',
        values: ['2024-01-01T09:00:00Z', '2024-01-01T10:00:00Z'],
        endFieldCode: 'end_datetime',
        endValues: ['2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z'],
      },
    });
    expect(records).toHaveLength(2);
    expect(records).toEqual([
      {
        title: { value: 'タスク' },
        worker: { value: [{ code: 'sato' }] },
        start_datetime: { value: '2024-01-01T09:00:00Z' },
        end_datetime: { value: '2024-01-01T10:00:00Z' },
      },
      {
        title: { value: 'タスク' },
        worker: { value: [{ code: 'sato' }] },
        start_datetime: { value: '2024-01-01T10:00:00Z' },
        end_datetime: { value: '2024-01-01T11:00:00Z' },
      },
    ]);
  });
});
