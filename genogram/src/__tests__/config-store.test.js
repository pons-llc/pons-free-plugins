'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore', () => {
  test('nullなら既定値(JSONフィールドは非表示)', () => {
    expect(ConfigStore.load(null)).toEqual({
      jsonField: '',
      spaceId: '',
      hideJsonField: true,
    });
  });

  test('保存値を読み込み、serializeで文字列に戻す', () => {
    const config = ConfigStore.load({
      jsonField: 'genogram_json',
      spaceId: 'genogram_space',
      hideJsonField: 'false',
    });
    expect(config).toEqual({
      jsonField: 'genogram_json',
      spaceId: 'genogram_space',
      hideJsonField: false,
    });
    expect(ConfigStore.serialize(config)).toEqual({
      jsonField: 'genogram_json',
      spaceId: 'genogram_space',
      hideJsonField: 'false',
    });
  });

  test('isConfiguredは両方そろっているときだけtrue', () => {
    expect(ConfigStore.isConfigured({ jsonField: 'a', spaceId: 'b' })).toBe(
      true,
    );
    expect(ConfigStore.isConfigured({ jsonField: 'a', spaceId: '' })).toBe(
      false,
    );
  });
});

describe('listCandidates', () => {
  const fields = {
    json: { type: 'MULTI_LINE_TEXT', code: 'json', label: 'データ' },
    memo: { type: 'MULTI_LINE_TEXT', code: 'memo', label: 'メモ欄' },
    text: { type: 'SINGLE_LINE_TEXT', code: 'text', label: '文字列' },
    tbl: {
      type: 'SUBTABLE',
      code: 'tbl',
      fields: {
        inner: { type: 'MULTI_LINE_TEXT', code: 'inner', label: '内側' },
      },
    },
  };
  const layout = [
    {
      type: 'ROW',
      fields: [
        { type: 'MULTI_LINE_TEXT', code: 'json' },
        { type: 'SPACER', elementId: 'sp1' },
        { type: 'SPACER', elementId: '' },
      ],
    },
    {
      type: 'GROUP',
      code: 'g',
      layout: [
        {
          type: 'ROW',
          fields: [
            { type: 'SPACER', elementId: 'sp2' },
            { type: 'MULTI_LINE_TEXT', code: 'memo' },
          ],
        },
      ],
    },
    {
      type: 'SUBTABLE',
      code: 'tbl',
      fields: [{ type: 'MULTI_LINE_TEXT', code: 'inner' }],
    },
  ];

  test('テーブル外の文字列(複数行)と、要素IDのあるスペースをレイアウト順に返す(グループ内を含む)', () => {
    const result = ConfigStore.listCandidates(fields, layout);
    expect(result.textFields).toEqual([
      { code: 'json', label: 'データ' },
      { code: 'memo', label: 'メモ欄' },
    ]);
    expect(result.spaces).toEqual(['sp1', 'sp2']);
  });

  test('レイアウトがnullでも落ちない', () => {
    expect(ConfigStore.listCandidates({}, null)).toEqual({
      textFields: [],
      spaces: [],
    });
  });
});
