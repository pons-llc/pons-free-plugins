const DefinitionStore = require('../js/lib/definition-store');

const recordWith = (text) => ({
  cac_definition: { type: 'MULTI_LINE_TEXT', value: text },
});

describe('loadFromRecord', () => {
  test('未設定のレコードでは空の定義を返す', () => {
    const definition = DefinitionStore.loadFromRecord(
      recordWith(''),
      'cac_definition',
    );
    expect(definition.schemaVersion).toBe(1);
    expect(definition.baseApp.appId).toBe('');
    expect(definition.targets).toHaveLength(1);
  });

  test('フィールドが無いレコードでも落ちない', () => {
    expect(
      DefinitionStore.loadFromRecord({}, 'cac_definition').baseApp.appId,
    ).toBe('');
    expect(
      DefinitionStore.loadFromRecord(null, 'cac_definition').targets,
    ).toHaveLength(1);
    expect(
      DefinitionStore.loadFromRecord(recordWith('{}'), '').targets,
    ).toHaveLength(1);
  });

  test('壊れたJSONでも例外を投げず空の定義を返す', () => {
    const definition = DefinitionStore.loadFromRecord(
      recordWith('{これは壊れている'),
      'cac_definition',
    );
    expect(definition.baseApp.appId).toBe('');
  });

  test('保存した定義を復元できる', () => {
    const text = DefinitionStore.serialize({
      baseApp: {
        appId: '676',
        appName: '妊娠届',
        keyFieldCode: '宛名番号',
        keyFieldType: 'SINGLE_LINE_TEXT',
        nameFieldCode: '氏名',
        query: '提出日 >= "2026-04-01"',
        viewId: '123',
        sourceUrl: 'https://sample.cybozu.com/k/676/?view=123',
      },
      targets: [
        {
          appId: '677',
          appName: '面談予約',
          label: '面談',
          keyFieldCode: '宛名番号',
          keyFieldType: 'SINGLE_LINE_TEXT',
          dateFieldCode: '面談日',
          query: '',
          viewId: '',
          sourceUrl: 'https://sample.cybozu.com/k/677/',
        },
      ],
    });

    const definition = DefinitionStore.loadFromRecord(
      recordWith(text),
      'cac_definition',
    );
    expect(definition.baseApp.appId).toBe('676');
    expect(definition.baseApp.query).toBe('提出日 >= "2026-04-01"');
    expect(definition.baseApp.viewId).toBe('123');
    expect(definition.baseApp.sourceUrl).toContain('/k/676/');
    expect(definition.targets[0].label).toBe('面談');
    expect(definition.targets[0].dateFieldCode).toBe('面談日');
  });
});

describe('normalize', () => {
  test('targetsが空なら空の対象アプリ1件を補う', () => {
    expect(DefinitionStore.normalize({ targets: [] }).targets).toHaveLength(1);
  });

  test('targetsが配列でなくても落ちない', () => {
    expect(
      DefinitionStore.normalize({ targets: 'これは配列ではない' }).targets,
    ).toHaveLength(1);
  });

  test('アプリIDの前後の空白を落とす', () => {
    const definition = DefinitionStore.normalize({
      baseApp: { appId: '  676 ' },
      targets: [{ appId: ' 677 ' }],
    });
    expect(definition.baseApp.appId).toBe('676');
    expect(definition.targets[0].appId).toBe('677');
  });

  test('未知のキーは持ち越さない(保存内容を定義済みの形に揃える)', () => {
    const definition = DefinitionStore.normalize({
      baseApp: { appId: '676', 余計なもの: 'x' },
      targets: [],
      悪意のあるキー: 'y',
    });
    expect(definition.baseApp.余計なもの).toBeUndefined();
    expect(definition.悪意のあるキー).toBeUndefined();
  });
});

describe('isEmpty', () => {
  test('何も設定されていなければ true', () => {
    expect(DefinitionStore.isEmpty(DefinitionStore.createDefault())).toBe(true);
    expect(DefinitionStore.isEmpty(null)).toBe(true);
  });

  test('基準アプリだけでも設定されていれば false', () => {
    expect(
      DefinitionStore.isEmpty({ baseApp: { appId: '676' }, targets: [] }),
    ).toBe(false);
  });

  test('対象アプリだけ設定されていても false', () => {
    expect(
      DefinitionStore.isEmpty({ baseApp: {}, targets: [{ appId: '677' }] }),
    ).toBe(false);
  });
});

describe('serialize', () => {
  test('JSON文字列として書き出せる', () => {
    const text = DefinitionStore.serialize(DefinitionStore.createDefault());
    expect(typeof text).toBe('string');
    expect(JSON.parse(text).schemaVersion).toBe(1);
  });
});
