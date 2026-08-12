const SelectionPartitioner = require('../js/lib/selection-partitioner');

const STATUS_FIELD = 'ステータス';

const statusSettings = {
  enable: true,
  states: {
    未処理: { index: '0', assignee: { type: 'ONE', entities: [] } },
    申請中: {
      index: '1',
      assignee: {
        type: 'ALL',
        entities: [{ entity: { type: 'USER', code: 'boss' } }],
      },
    },
    完了: { index: '2', assignee: { type: 'ONE', entities: [] } },
    差戻中: {
      index: '1',
      assignee: {
        type: 'ONE',
        entities: [{ entity: { type: 'USER', code: 'sato' } }],
      },
    },
  },
  actions: [
    { name: '申請する', from: '未処理', to: '申請中' },
    { name: '承認', from: '申請中', to: '完了' },
    { name: '差し戻す', from: '申請中', to: '差戻中' }, // 遷移先がONE+entities有り = assignee必須
  ],
};

const record = (id, status) => ({
  id,
  revision: '1',
  [STATUS_FIELD]: { type: 'STATUS', value: status },
});

describe('collectAvailableActionNames', () => {
  test('選択中レコードの現在のステータスから実行できるアクション名の和集合を返す', () => {
    const records = [record(1, '未処理'), record(2, '申請中')];
    expect(
      SelectionPartitioner.collectAvailableActionNames(
        records,
        STATUS_FIELD,
        statusSettings,
      ),
    ).toEqual(['申請する', '承認']);
  });

  test('assignee必須のアクションは候補から除外する', () => {
    const records = [record(3, '申請中')];
    const names = SelectionPartitioner.collectAvailableActionNames(
      records,
      STATUS_FIELD,
      statusSettings,
    );
    expect(names).not.toContain('差し戻す');
    expect(names).toContain('承認');
  });

  test('該当するアクションが無ければ空配列', () => {
    const records = [record(4, '完了')];
    expect(
      SelectionPartitioner.collectAvailableActionNames(
        records,
        STATUS_FIELD,
        statusSettings,
      ),
    ).toEqual([]);
  });
});

describe('partitionForAction', () => {
  test('現在のステータスがfromと一致するレコードはeligibleになる', () => {
    const records = [record(1, '未処理'), record(2, '完了')];
    const result = SelectionPartitioner.partitionForAction(
      records,
      STATUS_FIELD,
      '申請する',
      statusSettings,
    );
    expect(result.eligible).toEqual([
      { id: 1, revision: '1', action: '申請する' },
    ]);
    expect(result.ineligible).toEqual([{ id: 2, reason: 'STATUS_MISMATCH' }]);
  });

  test('assignee必須の遷移はASSIGNEE_REQUIREDとしてineligibleになる', () => {
    const records = [record(5, '申請中')];
    const result = SelectionPartitioner.partitionForAction(
      records,
      STATUS_FIELD,
      '差し戻す',
      statusSettings,
    );
    expect(result.eligible).toEqual([]);
    expect(result.ineligible).toEqual([{ id: 5, reason: 'ASSIGNEE_REQUIRED' }]);
  });

  test('空配列を渡すと両方空', () => {
    const result = SelectionPartitioner.partitionForAction(
      [],
      STATUS_FIELD,
      '承認',
      statusSettings,
    );
    expect(result).toEqual({ eligible: [], ineligible: [] });
  });
});
