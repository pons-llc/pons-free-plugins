const ProcessSetup = require('../js/lib/process-setup.js');

const opts = {
  completeStatus: '完了',
  creatorFieldCode: '作成者',
  approverCode: 'admin',
};

describe('buildDefaultProcess', () => {
  test('未申請 → 承認待ち → 完了 の承認フロー', () => {
    const body = ProcessSetup.buildDefaultProcess(opts);
    expect(body.enable).toBe(true);
    expect(Object.keys(body.states)).toEqual(['未申請', '承認待ち', '完了']);
    expect(body.states['未申請']).toEqual({
      name: '未申請',
      index: '0',
      assignee: {
        type: 'ONE',
        entities: [{ entity: { type: 'FIELD_ENTITY', code: '作成者' } }],
      },
    });
    expect(body.states['承認待ち'].assignee).toEqual({
      type: 'ANY',
      entities: [{ entity: { type: 'USER', code: 'admin' } }],
    });
    expect(body.actions.map((a) => [a.name, a.from, a.to])).toEqual([
      ['申請する', '未申請', '承認待ち'],
      ['承認する', '承認待ち', '完了'],
      ['差し戻す', '承認待ち', '未申請'],
    ]);
  });

  test('完了ステータス名を変えられる', () => {
    const body = ProcessSetup.buildDefaultProcess({
      ...opts,
      completeStatus: '反映済み',
    });
    expect(body.states['反映済み'].index).toBe('2');
    expect(body.actions[1].to).toBe('反映済み');
  });

  test('作成者フィールド・承認者が不明なら作業者を空にする', () => {
    const body = ProcessSetup.buildDefaultProcess({
      completeStatus: '完了',
      creatorFieldCode: '',
      approverCode: '',
    });
    expect(body.states['未申請'].assignee.entities).toEqual([]);
    expect(body.states['承認待ち'].assignee.entities).toEqual([]);
  });
});

describe('planProcessSetup', () => {
  test('一度も設定していない(statesがnull)なら既定フローを作成', () => {
    const plan = ProcessSetup.planProcessSetup(
      { enable: false, states: null, actions: null, revision: '3' },
      opts,
    );
    expect(plan.action).toBe('create');
    expect(plan.body.states['完了']).toBeDefined();
  });

  test('既定フローのステータス名と完了ステータス名が重なるとエラー', () => {
    const plan = ProcessSetup.planProcessSetup(
      { enable: false, states: null, actions: null },
      { ...opts, completeStatus: '承認待ち' },
    );
    expect(plan.action).toBe('error');
  });

  const configured = {
    states: {
      未処理: {
        name: '未処理',
        index: '0',
        assignee: { type: 'ONE', entities: [] },
      },
      完了: {
        name: '完了',
        index: '1',
        assignee: { type: 'ONE', entities: [] },
      },
    },
    actions: [
      {
        name: '完了にする',
        from: '未処理',
        to: '完了',
        filterCond: '',
        type: 'PRIMARY',
      },
    ],
  };

  test('設定済みでOFFなら、既存のステータス・アクションのままONにする', () => {
    const plan = ProcessSetup.planProcessSetup(
      { enable: false, ...configured },
      opts,
    );
    expect(plan).toEqual({
      action: 'enable',
      body: {
        enable: true,
        states: configured.states,
        actions: configured.actions,
      },
    });
  });

  test('ONで完了ステータスがあれば何もしない', () => {
    expect(
      ProcessSetup.planProcessSetup({ enable: true, ...configured }, opts)
        .action,
    ).toBe('none');
  });

  test('完了ステータスが無ければエラー(既存の設定は勝手に変えない)', () => {
    const plan = ProcessSetup.planProcessSetup(
      { enable: true, ...configured },
      { ...opts, completeStatus: '反映済み' },
    );
    expect(plan.action).toBe('error');
    expect(plan.error).toMatch(/反映済み/);
  });

  test('完了ステータスへ遷移するアクションが無ければエラー', () => {
    const plan = ProcessSetup.planProcessSetup(
      { enable: true, states: configured.states, actions: [] },
      opts,
    );
    expect(plan.action).toBe('error');
  });
});

describe('isCompletingAction', () => {
  test('完了ステータスへ変わるアクションだけ', () => {
    const ev = (status, next) => ({
      status: { value: status },
      nextStatus: { value: next },
    });
    expect(
      ProcessSetup.isCompletingAction(ev('承認待ち', '完了'), '完了'),
    ).toBe(true);
    expect(
      ProcessSetup.isCompletingAction(ev('未申請', '承認待ち'), '完了'),
    ).toBe(false);
    // 複数人の承認待ちでステータスが変わらない場合
    expect(ProcessSetup.isCompletingAction(ev('完了', '完了'), '完了')).toBe(
      false,
    );
    expect(ProcessSetup.isCompletingAction({}, '完了')).toBe(false);
  });
});
