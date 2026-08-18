const Reconcile = require('../js/lib/reconcile');
const DefinitionStore = require('../js/lib/definition-store');

const baseRecord = (id, key, name) => ({
  $id: { type: '__ID__', value: String(id) },
  宛名番号: { type: 'SINGLE_LINE_TEXT', value: key },
  氏名: { type: 'SINGLE_LINE_TEXT', value: name },
});

const targetRecord = (id, key, date) => ({
  $id: { type: '__ID__', value: String(id) },
  宛名番号: { type: 'SINGLE_LINE_TEXT', value: key },
  面談日: { type: 'DATE', value: date },
});

const buildDefinition = () =>
  DefinitionStore.normalize({
    baseApp: {
      appId: '570',
      appName: '妊娠届',
      keyFieldCode: '宛名番号',
      keyFieldType: 'SINGLE_LINE_TEXT',
      nameFieldCode: '氏名',
      query: '',
    },
    targets: [
      {
        appId: '571',
        appName: '妊娠時面談予約',
        label: '面談',
        keyFieldCode: '宛名番号',
        keyFieldType: 'SINGLE_LINE_TEXT',
        dateFieldCode: '面談日',
        query: '',
      },
    ],
  });

const run = (baseRecords, targetRecords, definition) =>
  Reconcile.buildResult({
    definition: definition || buildDefinition(),
    baseRecords,
    targetRecordSets: [targetRecords],
    runId: 'run-1',
    runAt: '2026-08-18T01:00:00Z',
  });

describe('buildResult — 基本の突合', () => {
  test('基準アプリにあって対象アプリに無い人を未提出として出す', () => {
    const result = run(
      [baseRecord(1, 'A-001', '山田花子'), baseRecord(2, 'A-002', '鈴木一郎')],
      [targetRecord(11, 'A-001', '2026-05-01')],
    );

    expect(result.rows).toHaveLength(2);

    const yamada = result.rows.find((row) => row.key === 'A-001');
    expect(yamada.name).toBe('山田花子');
    expect(yamada.targets[0].submitted).toBe(true);
    expect(yamada.targets[0].count).toBe(1);
    expect(yamada.targets[0].lastDate).toBe('2026-05-01');
    expect(yamada.targets[0].recordIds).toEqual(['11']);

    const suzuki = result.rows.find((row) => row.key === 'A-002');
    expect(suzuki.targets[0].submitted).toBe(false);
    expect(suzuki.targets[0].count).toBe(0);
    expect(suzuki.targets[0].lastDate).toBeNull();
    expect(suzuki.targets[0].recordIds).toEqual([]);
  });

  test('母集団は基準アプリ。対象アプリにしか居ない人は行にしない', () => {
    const result = run(
      [baseRecord(1, 'A-001', '山田花子')],
      [
        targetRecord(11, 'A-001', '2026-05-01'),
        targetRecord(12, 'X-999', '2026-05-02'),
      ],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].key).toBe('A-001');
  });

  test('サマリに対象件数と未提出件数が入る', () => {
    const result = run(
      [
        baseRecord(1, 'A-001', '山田花子'),
        baseRecord(2, 'A-002', '鈴木一郎'),
        baseRecord(3, 'A-003', '佐藤次郎'),
      ],
      [targetRecord(11, 'A-001', '2026-05-01')],
    );

    expect(result.summary.baseCount).toBe(3);
    expect(result.summary.perTarget[0].label).toBe('面談');
    expect(result.summary.perTarget[0].submitted).toBe(1);
    expect(result.summary.perTarget[0].unsubmitted).toBe(2);
    expect(result.summary.unsubmittedAny).toBe(2);
  });

  test('結果にschemaVersionと実行情報を含める', () => {
    const result = run([baseRecord(1, 'A-001', '山田花子')], []);
    expect(result.schemaVersion).toBe(1);
    expect(result.runId).toBe('run-1');
    expect(result.runAt).toBe('2026-08-18T01:00:00Z');
    expect(result.baseApp.appId).toBe('570');
    expect(result.targets[0].appId).toBe('571');
  });
});

describe('buildResult — ラベル', () => {
  test('提出済/未提出の表記はプラグイン設定側(labels)から受け取る', () => {
    const result = Reconcile.buildResult({
      definition: buildDefinition(),
      labels: { submitted: '済', unsubmitted: '未' },
      baseRecords: [baseRecord(1, 'A-001', '山田花子')],
      targetRecordSets: [[]],
      runId: 'run-1',
      runAt: '2026-08-18T01:00:00Z',
    });
    expect(result.labels).toEqual({ submitted: '済', unsubmitted: '未' });
  });

  test('labelsを渡さなければ既定の表記になる', () => {
    const result = run([baseRecord(1, 'A-001', '山田花子')], []);
    expect(result.labels).toEqual({
      submitted: '提出済',
      unsubmitted: '未提出',
    });
  });
});

describe('buildResult — 端のケース', () => {
  test('キーが空の基準レコードは行にせず skippedNoKey に数える', () => {
    const result = run(
      [
        baseRecord(1, 'A-001', '山田花子'),
        baseRecord(2, '', '氏名だけ'),
        baseRecord(3, '   ', '空白'),
      ],
      [],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.summary.skippedNoKey).toBe(2);
  });

  test('基準アプリでキーが重複していたら1行にまとめる', () => {
    const result = run(
      [baseRecord(1, 'A-001', '山田花子'), baseRecord(2, 'A-001', '山田花子')],
      [],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].baseRecordIds).toEqual(['1', '2']);
    expect(result.summary.baseCount).toBe(1);
  });

  test('対象アプリに同じキーが複数あれば件数と最終提出日を集約する', () => {
    const result = run(
      [baseRecord(1, 'A-001', '山田花子')],
      [
        targetRecord(11, 'A-001', '2026-05-01'),
        targetRecord(12, 'A-001', '2026-07-20'),
        targetRecord(13, 'A-001', '2026-06-10'),
      ],
    );
    expect(result.rows[0].targets[0].count).toBe(3);
    expect(result.rows[0].targets[0].lastDate).toBe('2026-07-20');
    expect(result.rows[0].targets[0].recordIds).toEqual(['11', '12', '13']);
  });

  test('提出日フィールド未設定なら lastDate は null のまま', () => {
    const definition = buildDefinition();
    definition.targets[0].dateFieldCode = '';
    const result = run(
      [baseRecord(1, 'A-001', '山田花子')],
      [targetRecord(11, 'A-001', '2026-05-01')],
      definition,
    );
    expect(result.rows[0].targets[0].submitted).toBe(true);
    expect(result.rows[0].targets[0].lastDate).toBeNull();
  });

  test('基準アプリが0件でも落ちない', () => {
    const result = run([], []);
    expect(result.rows).toEqual([]);
    expect(result.summary.baseCount).toBe(0);
    expect(result.summary.perTarget[0].submitted).toBe(0);
    expect(result.summary.perTarget[0].unsubmitted).toBe(0);
  });

  test('行の並びは基準アプリの取得順を保つ', () => {
    const result = run(
      [
        baseRecord(3, 'C', 'c'),
        baseRecord(1, 'A', 'a'),
        baseRecord(2, 'B', 'b'),
      ],
      [],
    );
    expect(result.rows.map((row) => row.key)).toEqual(['C', 'A', 'B']);
  });
});

describe('buildResult — 対象アプリが複数', () => {
  const multiDefinition = () =>
    DefinitionStore.normalize({
      baseApp: {
        appId: '570',
        appName: '妊娠届',
        keyFieldCode: '宛名番号',
        keyFieldType: 'SINGLE_LINE_TEXT',
        nameFieldCode: '氏名',
      },
      targets: [
        {
          appId: '571',
          label: '面談',
          keyFieldCode: '宛名番号',
          keyFieldType: 'SINGLE_LINE_TEXT',
          dateFieldCode: '面談日',
        },
        {
          appId: '572',
          label: '教室',
          keyFieldCode: '宛名番号',
          keyFieldType: 'SINGLE_LINE_TEXT',
          dateFieldCode: '',
        },
      ],
    });

  test('対象アプリごとに列が並び、どれか未提出なら unsubmittedAny に数える', () => {
    const result = Reconcile.buildResult({
      definition: multiDefinition(),
      baseRecords: [
        baseRecord(1, 'A-001', '山田花子'),
        baseRecord(2, 'A-002', '鈴木一郎'),
      ],
      targetRecordSets: [
        [targetRecord(11, 'A-001', '2026-05-01')],
        [targetRecord(21, 'A-001', null), targetRecord(22, 'A-002', null)],
      ],
      runId: 'run-1',
      runAt: '2026-08-18T01:00:00Z',
    });

    const yamada = result.rows.find((row) => row.key === 'A-001');
    expect(yamada.targets.map((cell) => cell.submitted)).toEqual([true, true]);

    const suzuki = result.rows.find((row) => row.key === 'A-002');
    expect(suzuki.targets.map((cell) => cell.submitted)).toEqual([false, true]);

    expect(result.summary.perTarget[0].unsubmitted).toBe(1);
    expect(result.summary.perTarget[1].unsubmitted).toBe(0);
    expect(result.summary.unsubmittedAny).toBe(1);
  });

  test('ラベル未設定ならアプリ名、それも無ければアプリIDで代用する', () => {
    const definition = DefinitionStore.normalize({
      baseApp: {
        appId: '570',
        keyFieldCode: '宛名番号',
        keyFieldType: 'SINGLE_LINE_TEXT',
      },
      targets: [
        { appId: '571', appName: '面談予約', keyFieldCode: '宛名番号' },
        { appId: '572', keyFieldCode: '宛名番号' },
      ],
    });
    const result = Reconcile.buildResult({
      definition,
      baseRecords: [baseRecord(1, 'A-001', '山田花子')],
      targetRecordSets: [[], []],
      runId: 'run-1',
      runAt: '2026-08-18T01:00:00Z',
    });
    expect(result.summary.perTarget[0].label).toBe('面談予約');
    expect(result.summary.perTarget[1].label).toBe('アプリ572');
  });
});

describe('latestDate', () => {
  test('日時(DATETIME)でも文字列比較で最大値が取れる', () => {
    const records = [
      { d: { value: '2026-05-01T10:00:00Z' } },
      { d: { value: '2026-05-01T22:00:00Z' } },
      { d: { value: '2026-04-30T23:00:00Z' } },
    ];
    expect(Reconcile.latestDate(records, 'd')).toBe('2026-05-01T22:00:00Z');
  });

  test('空値やnullは無視する', () => {
    const records = [
      { d: { value: null } },
      { d: { value: '' } },
      { d: { value: '2026-05-01' } },
    ];
    expect(Reconcile.latestDate(records, 'd')).toBe('2026-05-01');
  });

  test('すべて空ならnull', () => {
    expect(Reconcile.latestDate([{ d: { value: '' } }], 'd')).toBeNull();
    expect(Reconcile.latestDate([], 'd')).toBeNull();
  });
});
