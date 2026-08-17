const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('未設定のときは既定値を返す', () => {
    const config = ConfigStore.load({});
    expect(config.schemaVersion).toBe(1);
    expect(config.baseApp.appId).toBe('');
    expect(config.targets).toHaveLength(1);
    expect(config.limits.maxBaseRecords).toBe(5000);
    expect(config.limits.maxHistoryRows).toBe(20);
    expect(config.labels.submitted).toBe('提出済');
    expect(config.labels.unsubmitted).toBe('未提出');
  });

  test('getConfig()の戻り値がnull/undefinedでも既定値を返す', () => {
    expect(ConfigStore.load(null).targets).toHaveLength(1);
    expect(ConfigStore.load(undefined).targets).toHaveLength(1);
  });

  test('壊れたJSONでも例外を投げず既定値を返す', () => {
    const config = ConfigStore.load({ config: '{壊れている' });
    expect(config.baseApp.appId).toBe('');
    expect(config.targets).toHaveLength(1);
  });

  test('保存済みの設定を復元する', () => {
    const saved = ConfigStore.serialize({
      baseApp: {
        appId: '570',
        appName: '妊娠届',
        keyFieldCode: '宛名番号',
        keyFieldType: 'SINGLE_LINE_TEXT',
        nameFieldCode: '氏名',
        query: '提出日 >= "2026-04-01"',
      },
      targets: [
        {
          appId: '571',
          appName: '面談予約',
          label: '面談',
          keyFieldCode: '宛名番号',
          keyFieldType: 'SINGLE_LINE_TEXT',
          dateFieldCode: '面談日',
          query: '',
        },
      ],
      limits: { maxBaseRecords: 100, maxHistoryRows: 5 },
      labels: { submitted: '済', unsubmitted: '未' },
    });

    const config = ConfigStore.load(saved);
    expect(config.baseApp.appId).toBe('570');
    expect(config.baseApp.query).toBe('提出日 >= "2026-04-01"');
    expect(config.targets[0].label).toBe('面談');
    expect(config.targets[0].dateFieldCode).toBe('面談日');
    expect(config.limits.maxHistoryRows).toBe(5);
    expect(config.labels.unsubmitted).toBe('未');
  });

  test('アプリIDの前後の空白を落とす', () => {
    const config = ConfigStore.load(
      ConfigStore.serialize({ baseApp: { appId: '  570 ' }, targets: [] }),
    );
    expect(config.baseApp.appId).toBe('570');
  });
});

describe('ConfigStore.normalize', () => {
  test('targetsが空配列なら空の対象アプリ1件を補う', () => {
    const config = ConfigStore.normalize({ targets: [] });
    expect(config.targets).toHaveLength(1);
    expect(config.targets[0].appId).toBe('');
  });

  test('不正なlimitsは既定値に置き換える', () => {
    const config = ConfigStore.normalize({
      limits: { maxBaseRecords: 0, maxHistoryRows: 'abc' },
    });
    expect(config.limits.maxBaseRecords).toBe(5000);
    expect(config.limits.maxHistoryRows).toBe(20);
  });

  test('空文字のラベルは既定値に戻す', () => {
    const config = ConfigStore.normalize({ labels: { submitted: '' } });
    expect(config.labels.submitted).toBe('提出済');
  });
});

describe('ConfigStore.serialize', () => {
  test('config キー1つに JSON 文字列として詰める', () => {
    const serialized = ConfigStore.serialize(ConfigStore.createDefaultConfig());
    expect(Object.keys(serialized)).toEqual(['config']);
    expect(typeof serialized.config).toBe('string');
    expect(JSON.parse(serialized.config).schemaVersion).toBe(1);
  });
});
