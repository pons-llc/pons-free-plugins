const StatusActions = require('../js/lib/status-actions');

describe('listActionsForStatus', () => {
  const actions = [
    { name: '申請する', from: '未処理', to: '申請中' },
    { name: '承認', from: '申請中', to: '完了' },
    { name: '差し戻す', from: '申請中', to: '未処理' },
  ];

  test('現在のステータスに一致するアクションだけを返す', () => {
    expect(StatusActions.listActionsForStatus(actions, '申請中')).toEqual([
      { name: '承認', from: '申請中', to: '完了' },
      { name: '差し戻す', from: '申請中', to: '未処理' },
    ]);
  });

  test('一致するアクションが無ければ空配列', () => {
    expect(StatusActions.listActionsForStatus(actions, '完了')).toEqual([]);
  });

  test('actionsが未定義でも空配列を返す', () => {
    expect(StatusActions.listActionsForStatus(undefined, '完了')).toEqual([]);
  });
});

describe('isAssigneeRequired', () => {
  test('遷移先がONEでentitiesが1件以上あればtrue', () => {
    const states = {
      完了: {
        index: '2',
        assignee: {
          type: 'ONE',
          entities: [{ entity: { type: 'USER', code: 'sato' } }],
        },
      },
    };
    expect(StatusActions.isAssigneeRequired(states, '完了')).toBe(true);
  });

  test('遷移先がONEでもentitiesが0件ならfalse', () => {
    const states = {
      完了: { index: '2', assignee: { type: 'ONE', entities: [] } },
    };
    expect(StatusActions.isAssigneeRequired(states, '完了')).toBe(false);
  });

  test('遷移先がALLならfalse(先頭ステータスでなければ)', () => {
    const states = {
      処理中: {
        index: '1',
        assignee: {
          type: 'ALL',
          entities: [{ entity: { type: 'USER', code: 'sato' } }],
        },
      },
    };
    expect(StatusActions.isAssigneeRequired(states, '処理中')).toBe(false);
  });

  test('遷移先がANYならfalse(先頭ステータスでなければ)', () => {
    const states = {
      処理中: {
        index: '1',
        assignee: {
          type: 'ANY',
          entities: [{ entity: { type: 'USER', code: 'sato' } }],
        },
      },
    };
    expect(StatusActions.isAssigneeRequired(states, '処理中')).toBe(false);
  });

  test('最初のステータス(index=0)に戻し、作業者が設定されていればtrue', () => {
    const states = {
      未処理: {
        index: '0',
        assignee: {
          type: 'ALL',
          entities: [{ entity: { type: 'USER', code: 'sato' } }],
        },
      },
    };
    expect(StatusActions.isAssigneeRequired(states, '未処理')).toBe(true);
  });

  test('遷移先のステータス定義が無ければfalse', () => {
    expect(StatusActions.isAssigneeRequired({}, '存在しない')).toBe(false);
  });
});
