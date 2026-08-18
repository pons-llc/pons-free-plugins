const ConfigStore = require('../js/lib/config-store');

// プラグイン設定に残すのは、アプリ全体で共通の既定値・上限だけ。
// 「どのアプリをどう突き合わせるか」はレコード単位(definition-store)に持つ。
describe('ConfigStore.load', () => {
  test('未設定のときは既定値を返す', () => {
    const config = ConfigStore.load({});
    expect(config.schemaVersion).toBe(2);
    expect(config.limits.maxBaseRecords).toBe(5000);
    expect(config.limits.maxHistoryRows).toBe(20);
    expect(config.labels.submitted).toBe('提出済');
    expect(config.labels.unsubmitted).toBe('未提出');
  });

  test('getConfig()の戻り値がnull/undefinedでも既定値を返す', () => {
    expect(ConfigStore.load(null).limits.maxHistoryRows).toBe(20);
    expect(ConfigStore.load(undefined).labels.submitted).toBe('提出済');
  });

  test('壊れたJSONでも例外を投げず既定値を返す', () => {
    expect(
      ConfigStore.load({ config: '{壊れている' }).limits.maxBaseRecords,
    ).toBe(5000);
  });

  test('保存した設定を復元する', () => {
    const saved = ConfigStore.serialize({
      limits: { maxBaseRecords: 100, maxHistoryRows: 5 },
      labels: { submitted: '済', unsubmitted: '未' },
    });
    const config = ConfigStore.load(saved);
    expect(config.limits.maxBaseRecords).toBe(100);
    expect(config.limits.maxHistoryRows).toBe(5);
    expect(config.labels.submitted).toBe('済');
    expect(config.labels.unsubmitted).toBe('未');
  });

  test('旧バージョン(突合設定を含む形)の設定が残っていても既定値として読める', () => {
    const legacy = {
      config: JSON.stringify({
        schemaVersion: 1,
        baseApp: { appId: '570', keyFieldCode: '宛名番号' },
        targets: [{ appId: '571' }],
        limits: { maxBaseRecords: 300, maxHistoryRows: 10 },
        labels: { submitted: '済', unsubmitted: '未' },
      }),
    };
    const config = ConfigStore.load(legacy);
    // 上限・ラベルは引き継ぎ、突合設定は持ち込まない(レコード側へ移ったため)
    expect(config.limits.maxBaseRecords).toBe(300);
    expect(config.labels.submitted).toBe('済');
    expect(config.baseApp).toBeUndefined();
    expect(config.targets).toBeUndefined();
  });
});

describe('ConfigStore.normalize', () => {
  test('不正なlimitsは既定値に置き換える', () => {
    const config = ConfigStore.normalize({
      limits: { maxBaseRecords: 0, maxHistoryRows: 'abc' },
    });
    expect(config.limits.maxBaseRecords).toBe(5000);
    expect(config.limits.maxHistoryRows).toBe(20);
  });

  test('空文字のラベルは既定値に戻す', () => {
    expect(
      ConfigStore.normalize({ labels: { submitted: '' } }).labels.submitted,
    ).toBe('提出済');
  });
});

describe('ConfigStore.serialize', () => {
  test('config キー1つに JSON 文字列として詰める', () => {
    const serialized = ConfigStore.serialize(ConfigStore.createDefaultConfig());
    expect(Object.keys(serialized)).toEqual(['config']);
    expect(JSON.parse(serialized.config).schemaVersion).toBe(2);
  });
});
