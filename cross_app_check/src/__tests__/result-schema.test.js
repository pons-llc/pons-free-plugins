const ResultSchema = require('../js/lib/result-schema');
const Reconcile = require('../js/lib/reconcile');
const ConfigStore = require('../js/lib/config-store');

const validResult = () =>
  Reconcile.buildResult({
    config: ConfigStore.normalize({
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
      ],
    }),
    baseRecords: [
      {
        $id: { value: '1' },
        宛名番号: { value: 'A-001' },
        氏名: { value: '山田花子' },
      },
      {
        $id: { value: '2' },
        宛名番号: { value: 'A-002' },
        氏名: { value: '鈴木一郎' },
      },
    ],
    targetRecordSets: [
      [
        {
          $id: { value: '11' },
          宛名番号: { value: 'A-001' },
          面談日: { value: '2026-05-01' },
        },
      ],
    ],
    runId: 'run-1',
    runAt: '2026-08-18T01:00:00Z',
  });

describe('serialize / parse の往復', () => {
  test('突合結果をJSONにして読み戻せる', () => {
    const original = validResult();
    const restored = ResultSchema.parse(ResultSchema.serialize(original));

    expect(restored.runId).toBe('run-1');
    expect(restored.baseApp.appId).toBe('570');
    expect(restored.targets[0].label).toBe('面談');
    expect(restored.rows).toHaveLength(2);
    expect(restored.rows[0].name).toBe('山田花子');
    expect(restored.rows[0].targets[0].submitted).toBe(true);
    expect(restored.rows[0].targets[0].lastDate).toBe('2026-05-01');
    expect(restored.rows[1].targets[0].submitted).toBe(false);
    expect(restored.summary.perTarget[0].unsubmitted).toBe(1);
  });
});

describe('parse — 壊れた入力を弾く', () => {
  test('JSONとして読めない文字列は例外', () => {
    expect(() => ResultSchema.parse('{壊れている')).toThrow(
      /JSONを読み取れませんでした/,
    );
  });

  test('オブジェクト以外は例外', () => {
    expect(() => ResultSchema.parse('[]')).toThrow(/形式が正しくありません/);
    expect(() => ResultSchema.parse('"文字列"')).toThrow(
      /形式が正しくありません/,
    );
  });

  test('対応していないschemaVersionは例外', () => {
    expect(() => ResultSchema.parse('{"schemaVersion":99}')).toThrow(
      /対応していない結果ファイルの形式/,
    );
  });

  test('schemaVersionが無いものも弾く', () => {
    expect(() => ResultSchema.parse('{"rows":[]}')).toThrow(
      /対応していない結果ファイルの形式/,
    );
  });
});

describe('sanitize — 差し替えられた添付ファイルを想定した防御', () => {
  test('レコードIDは数字だけのものしか通さない(リンク組み立てに使うため)', () => {
    const sanitized = ResultSchema.sanitize({
      schemaVersion: 1,
      targets: [{ appId: '571', label: '面談' }],
      rows: [
        {
          key: 'A-001',
          name: '山田花子',
          // eslint-disable-next-line no-script-url
          baseRecordIds: ['12', 'javascript:alert(1)', '../../etc', '34'],
          targets: [
            { submitted: true, count: 1, recordIds: ['11', '<script>'] },
          ],
        },
      ],
    });
    expect(sanitized.rows[0].baseRecordIds).toEqual(['12', '34']);
    expect(sanitized.rows[0].targets[0].recordIds).toEqual(['11']);
  });

  test('アプリIDが数字でなければ空にする', () => {
    const sanitized = ResultSchema.sanitize({
      schemaVersion: 1,
      baseApp: { appId: 'https://evil.example.com' },
      targets: [{ appId: '../../570', label: 'x' }],
      rows: [],
    });
    expect(sanitized.baseApp.appId).toBe('');
    expect(sanitized.targets[0].appId).toBe('');
  });

  test('submitted は真偽値以外を false に倒す', () => {
    const sanitized = ResultSchema.sanitize({
      schemaVersion: 1,
      targets: [{ appId: '571', label: '面談' }],
      rows: [{ key: 'A', targets: [{ submitted: 'true' }] }],
    });
    expect(sanitized.rows[0].targets[0].submitted).toBe(false);
  });

  test('件数は非負整数に丸める', () => {
    const sanitized = ResultSchema.sanitize({
      schemaVersion: 1,
      targets: [{ appId: '571', label: '面談' }],
      summary: {
        baseCount: -5,
        perTarget: [{ submitted: 'abc', unsubmitted: 2.7 }],
      },
      rows: [{ key: 'A', targets: [{ count: -1 }] }],
    });
    expect(sanitized.summary.baseCount).toBe(0);
    expect(sanitized.summary.perTarget[0].submitted).toBe(0);
    expect(sanitized.summary.perTarget[0].unsubmitted).toBe(2);
    expect(sanitized.rows[0].targets[0].count).toBe(0);
  });

  test('行のtargetsが足りなくても対象アプリ数ぶんの列に揃える', () => {
    const sanitized = ResultSchema.sanitize({
      schemaVersion: 1,
      targets: [
        { appId: '571', label: '面談' },
        { appId: '572', label: '教室' },
      ],
      rows: [{ key: 'A' }],
    });
    expect(sanitized.rows[0].targets).toHaveLength(2);
    expect(sanitized.rows[0].targets[0].submitted).toBe(false);
    expect(sanitized.rows[0].targets[1].count).toBe(0);
  });

  test('rowsやtargetsが配列でなくても落ちない', () => {
    const sanitized = ResultSchema.sanitize({
      schemaVersion: 1,
      rows: 'これは配列ではない',
      targets: null,
    });
    expect(sanitized.rows).toEqual([]);
    expect(sanitized.targets).toEqual([]);
  });

  test('氏名などの文字列は文字列として保つ(描画側でtextContentに入れる)', () => {
    const sanitized = ResultSchema.sanitize({
      schemaVersion: 1,
      targets: [],
      rows: [
        {
          key: '<img src=x onerror=alert(1)>',
          name: { evil: true },
          targets: [],
        },
      ],
    });
    expect(sanitized.rows[0].key).toBe('<img src=x onerror=alert(1)>');
    expect(typeof sanitized.rows[0].name).toBe('string');
  });

  test('ラベルが空なら既定の表記に戻す', () => {
    const sanitized = ResultSchema.sanitize({ schemaVersion: 1, labels: {} });
    expect(sanitized.labels.submitted).toBe('提出済');
    expect(sanitized.labels.unsubmitted).toBe('未提出');
  });
});
