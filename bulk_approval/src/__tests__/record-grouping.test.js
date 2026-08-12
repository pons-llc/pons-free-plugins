const RecordGrouping = require('../js/lib/record-grouping');

const STATUS_FIELD = 'ステータス';

const record = (id, status) => ({
  id,
  revision: '1',
  [STATUS_FIELD]: { type: 'STATUS', value: status },
});

const statusSettings = {
  states: {
    未処理: { index: '0' },
    申請中: { index: '1' },
    完了: { index: '2' },
  },
};

describe('groupRecordsByStatus', () => {
  test('現在のステータスごとにレコードをグループ化する', () => {
    const records = [
      record(1, '未処理'),
      record(2, '申請中'),
      record(3, '未処理'),
    ];
    const groups = RecordGrouping.groupRecordsByStatus(
      records,
      STATUS_FIELD,
      statusSettings,
    );
    expect(groups).toEqual([
      { status: '未処理', records: [record(1, '未処理'), record(3, '未処理')] },
      { status: '申請中', records: [record(2, '申請中')] },
    ]);
  });

  test('グループの並び順はプロセス管理のステータス順(index昇順)になる', () => {
    const records = [
      record(1, '完了'),
      record(2, '未処理'),
      record(3, '申請中'),
    ];
    const groups = RecordGrouping.groupRecordsByStatus(
      records,
      STATUS_FIELD,
      statusSettings,
    );
    expect(groups.map((g) => g.status)).toEqual(['未処理', '申請中', '完了']);
  });

  test('states側にステータス定義が見つからない場合は末尾に回す', () => {
    const records = [record(1, '不明'), record(2, '未処理')];
    const groups = RecordGrouping.groupRecordsByStatus(
      records,
      STATUS_FIELD,
      statusSettings,
    );
    expect(groups.map((g) => g.status)).toEqual(['未処理', '不明']);
  });

  test('空配列を渡すと空配列を返す', () => {
    expect(
      RecordGrouping.groupRecordsByStatus([], STATUS_FIELD, statusSettings),
    ).toEqual([]);
  });
});

describe('buildExecutionBatch', () => {
  test('グループ選択をPUT用のレコード配列に平坦化する', () => {
    const groupSelections = [
      {
        actionName: '申請する',
        records: [
          { id: 1, revision: '1' },
          { id: 2, revision: '2' },
        ],
      },
      {
        actionName: '承認',
        records: [{ id: 3, revision: '1' }],
      },
    ];
    expect(RecordGrouping.buildExecutionBatch(groupSelections)).toEqual([
      { id: 1, revision: '1', action: '申請する' },
      { id: 2, revision: '2', action: '申請する' },
      { id: 3, revision: '1', action: '承認' },
    ]);
  });

  test('空配列を渡すと空配列を返す', () => {
    expect(RecordGrouping.buildExecutionBatch([])).toEqual([]);
    expect(RecordGrouping.buildExecutionBatch(undefined)).toEqual([]);
  });
});
