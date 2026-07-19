'use strict';

const FormModel = require('../js/lib/form-model');

const row = (values) => ({
  value: Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, { value: v }]),
  ),
});

describe('validateFormLayout', () => {
  test('正常なレイアウトはエラーなし', () => {
    const result = FormModel.validateFormLayout([
      row({ insert_column: 'text_1', field_type: '文字列', choice: '' }),
      row({
        insert_column: 'text_2',
        field_type: 'ラジオボタン',
        choice: 'A,B',
      }),
    ]);
    expect(result.isValid).toBe(true);
    expect(result.messages).toEqual([]);
  });

  test('フィールドコードの重複と未入力を検出する', () => {
    const result = FormModel.validateFormLayout([
      row({ insert_column: 'text_1', field_type: '文字列', choice: '' }),
      row({ insert_column: 'text_1', field_type: '文字列', choice: '' }),
      row({ insert_column: '', field_type: '文字列', choice: '' }),
    ]);
    expect(result.isValid).toBe(false);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toContain('重複');
    expect(result.messages[1]).toContain('第3行');
  });

  test('選択肢必須タイプで選択肢が空ならエラー', () => {
    ['ラジオボタン', 'ドロップダウン', 'チェックボックス'].forEach((type) => {
      const result = FormModel.validateFormLayout([
        row({ insert_column: 'text_1', field_type: type, choice: '  ' }),
      ]);
      expect(result.isValid).toBe(false);
      expect(result.messages[0]).toContain('選択肢は必須');
    });
  });
});

describe('sortLayoutByOrder', () => {
  test('order昇順に並び、元配列は変更されない', () => {
    const rows = [
      row({ insert_column: 'b', order: '2' }),
      row({ insert_column: 'a', order: '1' }),
      row({ insert_column: 'c', order: '' }), // 数値化できない場合は0扱い
    ];
    const sorted = FormModel.sortLayoutByOrder(rows);
    expect(sorted.map((r) => r.value.insert_column.value)).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(rows[0].value.insert_column.value).toBe('b');
  });
});

describe('parseChoices', () => {
  test('カンマ区切りをトリムして分解し、空要素は除く', () => {
    expect(FormModel.parseChoices(' A, B ,,C ')).toEqual(['A', 'B', 'C']);
    expect(FormModel.parseChoices('')).toEqual([]);
    expect(FormModel.parseChoices(null)).toEqual([]);
  });
});

describe('日時変換', () => {
  test('toDatetimeLocalはローカル日時のinput値形式を返す', () => {
    expect(FormModel.toDatetimeLocal('')).toBe('');
    expect(FormModel.toDatetimeLocal('invalid')).toBe('');
    // タイムゾーン依存を避けるためパターンのみ検証
    expect(FormModel.toDatetimeLocal('2026-07-19T10:30:00Z')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    );
  });

  test('fromDatetimeLocalToISOはISO(ミリ秒なし)を返し、往復で値が保たれる', () => {
    expect(FormModel.fromDatetimeLocalToISO('')).toBeNull();
    expect(FormModel.fromDatetimeLocalToISO('invalid')).toBeNull();
    const iso = FormModel.fromDatetimeLocalToISO('2026-07-19T10:30');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(FormModel.toDatetimeLocal(iso)).toBe('2026-07-19T10:30');
  });
});

describe('evaluateCondition', () => {
  test('チェックボックス(配列)の含む/等しい', () => {
    expect(FormModel.evaluateCondition(['A', 'B'], '含む', 'A')).toBe(true);
    expect(FormModel.evaluateCondition(['A', 'B'], '等しい', 'A')).toBe(false);
    expect(FormModel.evaluateCondition(['A'], '等しい', 'A')).toBe(true);
    expect(FormModel.evaluateCondition(['A'], '以上', 'A')).toBe(false);
  });

  test('数値として解釈できる場合は数値比較する', () => {
    expect(FormModel.evaluateCondition('10', '以上', '9')).toBe(true);
    expect(FormModel.evaluateCondition('10', 'より小さい', '9')).toBe(false);
    // 文字列比較なら"10" < "9"になるところ
    expect(FormModel.evaluateCondition('10', '以下', '9')).toBe(false);
  });

  test('文字列比較と含む', () => {
    expect(FormModel.evaluateCondition('東京都', '含む', '東京')).toBe(true);
    expect(FormModel.evaluateCondition('東京都', '等しい', '東京')).toBe(false);
    expect(FormModel.evaluateCondition('', '等しくない', 'A')).toBe(true);
    expect(FormModel.evaluateCondition('A', '不明な演算子', 'A')).toBe(false);
  });
});

describe('normalizeConditionRule / computeRequiredStates', () => {
  const layout = [
    row({ insert_column: 'text_1', field_type: '文字列' }),
    row({ insert_column: 'text_2', field_type: '文字列' }),
  ];

  test('フラット形式とテーブル形式の両方を読める', () => {
    const flat = {
      triggerField: 'text_1',
      targetField: 'text_2',
      operator: '等しい',
      value: 'x',
      action: '必須にする',
    };
    expect(FormModel.normalizeConditionRule(flat)).toEqual(flat);

    const wrapped = row({
      condition: 'text_1',
      target_column: 'text_2',
      valid: '等しい',
      valid_value: 'x',
      valid_action: '必須にする',
    });
    expect(FormModel.normalizeConditionRule(wrapped)).toEqual(flat);
  });

  test('条件成立でtargetが必須になる', () => {
    const conditions = [
      {
        triggerField: 'text_1',
        targetField: 'text_2',
        operator: '等しい',
        value: 'はい',
        action: '必須にする',
      },
    ];
    const getValue = (code) => (code === 'text_1' ? 'はい' : '');
    expect(
      FormModel.computeRequiredStates(layout, conditions, getValue),
    ).toEqual({
      text_1: false,
      text_2: true,
    });
  });

  test('条件不成立・条件が配列でない場合は必須にならない', () => {
    const conditions = [
      {
        triggerField: 'text_1',
        targetField: 'text_2',
        operator: '等しい',
        value: 'はい',
        action: '必須にする',
      },
    ];
    expect(
      FormModel.computeRequiredStates(layout, conditions, () => 'いいえ'),
    ).toEqual({
      text_1: false,
      text_2: false,
    });
    expect(
      FormModel.computeRequiredStates(layout, 'not-array', () => 'はい'),
    ).toEqual({
      text_1: false,
      text_2: false,
    });
  });
});

describe('buildSettingJson / parseSettingJson', () => {
  test('conditionはJSON文字列をパースして配列で保存する(旧仕様のバグ修正)', () => {
    const layout = [row({ insert_column: 'text_1' })];
    const json = FormModel.buildSettingJson(
      layout,
      '[{"triggerField":"text_1"}]',
    );
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.condition)).toBe(true);
    expect(parsed.condition[0].triggerField).toBe('text_1');
  });

  test('condition未入力・不正JSONは空配列になる', () => {
    const layout = [row({ insert_column: 'text_1' })];
    expect(
      JSON.parse(FormModel.buildSettingJson(layout, '')).condition,
    ).toEqual([]);
    expect(
      JSON.parse(FormModel.buildSettingJson(layout, '{invalid')).condition,
    ).toEqual([]);
    expect(
      JSON.parse(FormModel.buildSettingJson(layout, '{"a":1}')).condition,
    ).toEqual([]);
  });

  test('parseSettingJsonは旧形式(conditionが文字列)も読める', () => {
    const legacy = JSON.stringify({
      layout: [row({ insert_column: 'text_1' })],
      condition: '[{"triggerField":"text_1"}]',
    });
    const parsed = FormModel.parseSettingJson(legacy);
    expect(parsed.layout).toHaveLength(1);
    expect(parsed.condition).toEqual([{ triggerField: 'text_1' }]);
  });

  test('parseSettingJsonは不正入力で空を返す', () => {
    expect(FormModel.parseSettingJson('')).toEqual({
      layout: [],
      condition: [],
    });
    expect(FormModel.parseSettingJson('{invalid')).toEqual({
      layout: [],
      condition: [],
    });
    expect(FormModel.parseSettingJson('{"layout": "x"}')).toEqual({
      layout: [],
      condition: [],
    });
  });
});

describe('buildRelatedLinksHtml (XSS対策)', () => {
  const linkRow = (url, label) =>
    row({ link_link: url, link_display_label: label });

  test('http/httpsのURLのみリンク化し、ラベル・URLをエスケープする', () => {
    const html = FormModel.buildRelatedLinksHtml([
      linkRow('https://example.com/?a=1&b=2', '<b>参考</b>'),
    ]);
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(html).toContain('&lt;b&gt;参考&lt;/b&gt;');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('<b>');
  });

  test('javascript:スキームや空URLは無視する', () => {
    expect(
      FormModel.buildRelatedLinksHtml([linkRow('javascript:alert(1)', 'x')]),
    ).toBe('');
    expect(FormModel.buildRelatedLinksHtml([linkRow('', 'x')])).toBe('');
    expect(
      FormModel.buildRelatedLinksHtml([linkRow('ftp://example.com', 'x')]),
    ).toBe('');
  });

  test('ラベルが空ならURLを表示ラベルにする', () => {
    const html = FormModel.buildRelatedLinksHtml([
      linkRow('https://example.com', ''),
    ]);
    expect(html).toContain('>https://example.com</a>');
  });

  test('href属性を壊すダブルクォート入りURLもエスケープされる', () => {
    const html = FormModel.buildRelatedLinksHtml([
      linkRow('https://example.com/"onmouseover="alert(1)', 'x'),
    ]);
    expect(html).not.toContain('"onmouseover');
    expect(html).toContain('&quot;onmouseover=&quot;');
  });
});
