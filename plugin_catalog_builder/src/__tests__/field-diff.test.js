const FieldDiff = require('../js/lib/field-diff.js');

describe('diffMissingFields', () => {
  test('既存フィールドが1つも無ければ、必要な定義がすべて返る', () => {
    const missing = FieldDiff.diffMissingFields({});
    expect(missing.map((d) => d.code)).toEqual([
      'plugin_id',
      'plugin_name',
      'plugin_version',
      'plugin_detail',
      'pcb_apps_table',
    ]);
  });

  test('一部が既存なら、残りだけが返る', () => {
    const existing = {
      plugin_id: { type: 'SINGLE_LINE_TEXT', code: 'plugin_id' },
      pcb_apps_table: { type: 'SUBTABLE', code: 'pcb_apps_table' },
    };
    const missing = FieldDiff.diffMissingFields(existing);
    expect(missing.map((d) => d.code)).toEqual([
      'plugin_name',
      'plugin_version',
      'plugin_detail',
    ]);
  });

  test('すべて既存なら空配列(2回目以降の設定保存で400エラーを起こさない)', () => {
    const existing = {};
    FieldDiff.REQUIRED_FIELD_DEFINITIONS.forEach((def) => {
      existing[def.code] = { type: def.type, code: def.code };
    });
    expect(FieldDiff.diffMissingFields(existing)).toEqual([]);
  });

  test('existingPropertiesがnull/undefinedでも例外にならない', () => {
    expect(FieldDiff.diffMissingFields(null).length).toBe(5);
    expect(FieldDiff.diffMissingFields(undefined).length).toBe(5);
  });
});

describe('buildAddFieldsPayload', () => {
  test('フィールドコードをキーとするオブジェクトを組み立てる', () => {
    const missing = [
      { code: 'plugin_id', type: 'SINGLE_LINE_TEXT', label: 'プラグインID' },
    ];
    const payload = FieldDiff.buildAddFieldsPayload(missing);
    expect(Object.keys(payload)).toEqual(['plugin_id']);
    expect(payload.plugin_id.label).toBe('プラグインID');
  });

  test('空配列なら空オブジェクト', () => {
    expect(FieldDiff.buildAddFieldsPayload([])).toEqual({});
  });
});
