const Operations = require('../js/lib/operations.js');

const textField = {
  type: 'SINGLE_LINE_TEXT',
  code: 'title',
  label: '件名',
  noLabel: false,
  required: false,
  minLength: '',
  maxLength: '',
  expression: '',
  hideExpression: false,
  unique: false,
  defaultValue: '',
};
const numberField = {
  type: 'NUMBER',
  code: 'amount',
  label: '金額',
  noLabel: false,
  required: false,
  minValue: '0',
  maxValue: '',
  digit: false,
  unique: false,
  defaultValue: '',
  displayScale: '',
  unit: '',
  unitPosition: 'BEFORE',
};
const dropDown = {
  type: 'DROP_DOWN',
  code: 'kind',
  label: '種別',
  noLabel: false,
  required: false,
  options: {
    B: { label: 'B', index: '1' },
    A: { label: 'A', index: '0' },
  },
  defaultValue: 'A',
};
const radio = {
  type: 'RADIO_BUTTON',
  code: 'radio',
  label: 'ラジオ',
  noLabel: false,
  required: true,
  options: {
    はい: { label: 'はい', index: '0' },
    いいえ: { label: 'いいえ', index: '1' },
  },
  defaultValue: 'はい',
  align: 'HORIZONTAL',
};
const checkBox = {
  type: 'CHECK_BOX',
  code: 'cb',
  label: 'チェック',
  noLabel: false,
  required: false,
  options: {
    x: { label: 'x', index: '0' },
    y: { label: 'y', index: '1' },
    z: { label: 'z', index: '2' },
  },
  defaultValue: ['x', 'z'],
  align: 'HORIZONTAL',
};
const dateField = {
  type: 'DATE',
  code: 'd',
  label: '日付',
  noLabel: false,
  required: false,
  unique: false,
  defaultValue: '',
  defaultNowValue: true,
};
const group = {
  type: 'GROUP',
  code: 'grp',
  label: 'グループ',
  noLabel: false,
  openGroup: true,
};
const subtable = {
  type: 'SUBTABLE',
  code: 'tbl',
  label: '明細',
  noLabel: false,
  fields: {},
};
const recordNumber = {
  type: 'RECORD_NUMBER',
  code: 'レコード番号',
  label: 'レコード番号',
  noLabel: false,
};
const lookupText = {
  ...textField,
  code: 'lk',
  lookup: { relatedApp: { app: '1' }, relatedKeyField: 'x' },
};
const calcText = { ...textField, code: 'auto', expression: 'a & b' };

describe('applicableOperations', () => {
  test('文字列1行: 変更できるプロパティがすべて並ぶ', () => {
    expect(Operations.applicableOperations(textField)).toEqual([
      'label',
      'code',
      'noLabel',
      'required',
      'unique',
      'defaultValue',
      'length',
      'delete',
    ]);
  });

  test('数値: 値の範囲を選べる(文字数の制限は出ない)', () => {
    const ops = Operations.applicableOperations(numberField);
    expect(ops).toContain('range');
    expect(ops).not.toContain('length');
    expect(ops).toContain('defaultValue');
  });

  test('ドロップダウン: 選択肢の変更と初期値', () => {
    const ops = Operations.applicableOperations(dropDown);
    expect(ops).toContain('options');
    expect(ops).toContain('defaultValue');
    expect(ops).not.toContain('unique');
  });

  test('日付: 初期値は対象外(レコード登録時の日時との関係が複雑なため)', () => {
    expect(Operations.applicableOperations(dateField)).not.toContain(
      'defaultValue',
    );
  });

  test('ルックアップ・自動計算の文字列1行は初期値を変更できない', () => {
    expect(Operations.applicableOperations(lookupText)).not.toContain(
      'defaultValue',
    );
    expect(Operations.applicableOperations(calcText)).not.toContain(
      'defaultValue',
    );
  });

  test('グループ・テーブル・レコード番号は削除できない', () => {
    expect(Operations.applicableOperations(group)).toEqual([
      'label',
      'code',
      'noLabel',
    ]);
    expect(Operations.applicableOperations(subtable)).not.toContain('delete');
    expect(Operations.applicableOperations(recordNumber)).not.toContain(
      'delete',
    );
  });

  test('ステータス・作業者・カテゴリーは何も変更できない', () => {
    ['STATUS', 'STATUS_ASSIGNEE', 'CATEGORY'].forEach((type) => {
      expect(
        Operations.applicableOperations({ type, code: type, label: type }),
      ).toEqual([]);
    });
  });
});

describe('currentValue', () => {
  test('選択肢はindex順のラベル配列', () => {
    expect(Operations.currentValue('options', dropDown)).toEqual(['A', 'B']);
  });

  test('文字数・値の範囲は{min, max}', () => {
    expect(Operations.currentValue('length', textField)).toEqual({
      min: '',
      max: '',
    });
    expect(Operations.currentValue('range', numberField)).toEqual({
      min: '0',
      max: '',
    });
  });

  test('真偽値のプロパティは文字列でも真偽値にする', () => {
    expect(
      Operations.currentValue('required', { ...textField, required: 'true' }),
    ).toBe(true);
    expect(Operations.currentValue('noLabel', textField)).toBe(false);
  });

  test('配列の初期値はコピーを返す', () => {
    const value = Operations.currentValue('defaultValue', checkBox);
    expect(value).toEqual(['x', 'z']);
    value.push('y');
    expect(checkBox.defaultValue).toEqual(['x', 'z']);
  });

  test('削除はnull', () => {
    expect(Operations.currentValue('delete', textField)).toBeNull();
  });
});

describe('normalizeInput', () => {
  test('文字列は前後の空白を除く', () => {
    expect(Operations.normalizeInput('label', '  新しい名前 ')).toBe(
      '新しい名前',
    );
  });

  test('選択肢は画面の行から削除指定・空の追加行を除いた {from, label} の配列', () => {
    expect(
      Operations.normalizeInput('options', [
        { from: 'A', label: ' A2 ', deleted: false },
        { from: 'B', label: 'B', deleted: true },
        { from: '', label: '', deleted: false },
      ]),
    ).toEqual([{ from: 'A', label: 'A2' }]);
  });

  test('範囲は前後の空白を除く', () => {
    expect(Operations.normalizeInput('range', { min: ' 1 ', max: '' })).toEqual(
      { min: '1', max: '' },
    );
  });

  test('真偽値はそのまま', () => {
    expect(Operations.normalizeInput('required', true)).toBe(true);
  });
});

describe('validateValue(形の検証のみ: defなし)', () => {
  test('ラベルは空にできない', () => {
    expect(Operations.validateValue('label', '')).toMatch(/入力/);
    expect(Operations.validateValue('label', 'OK')).toBe('');
  });

  test('ラベルに文字列以外は不可', () => {
    expect(Operations.validateValue('label', 1)).not.toBe('');
  });

  test('フィールドコード: 先頭の数字・空白・半角記号は不可、_ と全角文字は可', () => {
    expect(Operations.validateValue('code', '1abc')).not.toBe('');
    expect(Operations.validateValue('code', 'a b')).not.toBe('');
    expect(Operations.validateValue('code', 'a-b')).not.toBe('');
    expect(Operations.validateValue('code', 'a.b')).not.toBe('');
    expect(Operations.validateValue('code', 'abc_1')).toBe('');
    expect(Operations.validateValue('code', '件名＿2')).toBe('');
    expect(Operations.validateValue('code', 'a'.repeat(129))).not.toBe('');
  });

  test('真偽値の変更内容は真偽値のみ', () => {
    expect(Operations.validateValue('required', 'true')).not.toBe('');
    expect(Operations.validateValue('unique', false)).toBe('');
  });

  test('選択肢は1つ以上の {from, label}・名前の重複なし', () => {
    expect(Operations.validateValue('options', [])).not.toBe('');
    expect(Operations.validateValue('options', ['A'])).not.toBe('');
    expect(
      Operations.validateValue('options', [
        { from: 'A', label: 'X' },
        { from: '', label: 'X' },
      ]),
    ).toMatch(/重複/);
    expect(
      Operations.validateValue('options', [{ from: 'A', label: 'A' }]),
    ).toBe('');
  });

  test('選択肢は現在の選択肢に照らして検証する(defあり)', () => {
    expect(
      Operations.validateValue(
        'options',
        [{ from: 'Z', label: 'Z' }],
        dropDown,
      ),
    ).toMatch(/見つかりません/);
  });

  test('文字数は0以上の整数または空、最小≦最大', () => {
    expect(Operations.validateValue('length', { min: '', max: '' })).toBe('');
    expect(Operations.validateValue('length', { min: '1', max: '10' })).toBe(
      '',
    );
    expect(Operations.validateValue('length', { min: '-1', max: '' })).not.toBe(
      '',
    );
    expect(
      Operations.validateValue('length', { min: '1.5', max: '' }),
    ).not.toBe('');
    expect(Operations.validateValue('length', { min: '5', max: '3' })).toMatch(
      /最小/,
    );
  });

  test('値の範囲は数値(負数・小数可)または空、最小≦最大', () => {
    expect(Operations.validateValue('range', { min: '-10.5', max: '3' })).toBe(
      '',
    );
    expect(Operations.validateValue('range', { min: 'abc', max: '' })).not.toBe(
      '',
    );
    expect(Operations.validateValue('range', { min: '10', max: '9' })).toMatch(
      /最小/,
    );
  });

  test('範囲にオブジェクト以外は不可', () => {
    expect(Operations.validateValue('range', '1')).not.toBe('');
    expect(Operations.validateValue('range', null)).not.toBe('');
  });

  test('削除はnullのみ', () => {
    expect(Operations.validateValue('delete', null)).toBe('');
    expect(Operations.validateValue('delete', 'x')).not.toBe('');
  });

  test('初期値は文字列か文字列の配列', () => {
    expect(Operations.validateValue('defaultValue', 'abc')).toBe('');
    expect(Operations.validateValue('defaultValue', ['a'])).toBe('');
    expect(Operations.validateValue('defaultValue', [1])).not.toBe('');
    expect(Operations.validateValue('defaultValue', {})).not.toBe('');
  });

  test('未知の変更内容は不可', () => {
    expect(Operations.validateValue('expression', 'x')).not.toBe('');
  });
});

describe('validateValue(対象フィールドの定義に照らした検証)', () => {
  test('フィールドコードはアプリ内の既存コードと重複不可(自分自身は除く)', () => {
    const ctx = { existingCodes: new Set(['title', 'amount']) };
    expect(Operations.validateValue('code', 'amount', textField, ctx)).toMatch(
      /既に/,
    );
    expect(Operations.validateValue('code', 'title2', textField, ctx)).toBe('');
  });

  test('ドロップダウンの初期値は選択肢のいずれかか空', () => {
    expect(Operations.validateValue('defaultValue', 'B', dropDown)).toBe('');
    expect(Operations.validateValue('defaultValue', '', dropDown)).toBe('');
    expect(Operations.validateValue('defaultValue', 'Z', dropDown)).toMatch(
      /選択肢/,
    );
  });

  test('ラジオボタンの初期値は空にできない', () => {
    expect(Operations.validateValue('defaultValue', '', radio)).not.toBe('');
    expect(Operations.validateValue('defaultValue', 'いいえ', radio)).toBe('');
  });

  test('チェックボックスの初期値は配列で、選択肢に含まれるもののみ', () => {
    expect(Operations.validateValue('defaultValue', ['y'], checkBox)).toBe('');
    expect(Operations.validateValue('defaultValue', 'y', checkBox)).not.toBe(
      '',
    );
    expect(Operations.validateValue('defaultValue', ['w'], checkBox)).toMatch(
      /選択肢/,
    );
  });

  test('文字列フィールドの初期値に配列は不可', () => {
    expect(Operations.validateValue('defaultValue', ['a'], textField)).not.toBe(
      '',
    );
  });

  test('数値フィールドの初期値は数値か空', () => {
    expect(Operations.validateValue('defaultValue', '12', numberField)).toBe(
      '',
    );
    expect(
      Operations.validateValue('defaultValue', 'abc', numberField),
    ).not.toBe('');
  });

  test('対象フィールドで選べない変更内容は不可', () => {
    expect(Operations.validateValue('unique', true, dropDown)).toMatch(
      /変更できません/,
    );
  });
});

describe('buildPropertyPatch', () => {
  test('ラベル・コード・真偽値・初期値はそのプロパティだけ', () => {
    expect(Operations.buildPropertyPatch('label', 'X', textField)).toEqual({
      patch: { label: 'X' },
      notes: [],
    });
    expect(Operations.buildPropertyPatch('required', true, textField)).toEqual({
      patch: { required: true },
      notes: [],
    });
  });

  test('文字数・値の範囲は2つのプロパティ', () => {
    expect(
      Operations.buildPropertyPatch('length', { min: '', max: '10' }, textField)
        .patch,
    ).toEqual({ minLength: '', maxLength: '10' });
    expect(
      Operations.buildPropertyPatch('range', { min: '1', max: '' }, numberField)
        .patch,
    ).toEqual({ minValue: '1', maxValue: '' });
  });

  test('選択肢: キーは変更前の名前、labelは変更後の名前(名前の変更)', () => {
    const { patch } = Operations.buildPropertyPatch(
      'options',
      [
        { from: 'B', label: 'B2' },
        { from: 'A', label: 'A' },
        { from: '', label: 'C' },
      ],
      dropDown,
    );
    expect(patch.options).toEqual({
      B: { label: 'B2', index: '0' },
      A: { label: 'A', index: '1' },
      C: { label: 'C', index: '2' },
    });
  });

  test('選択肢: 初期値が削除されると補正して注記する', () => {
    const { patch, notes } = Operations.buildPropertyPatch(
      'options',
      [{ from: 'B', label: 'B' }],
      dropDown,
    );
    expect(patch.defaultValue).toBe('');
    expect(notes[0]).toMatch(/初期値/);
  });
});

describe('formatValue', () => {
  test('真偽値は変更内容ごとの言葉にする', () => {
    expect(Operations.formatValue('required', true)).toBe('必須');
    expect(Operations.formatValue('noLabel', true)).toBe('表示しない');
    expect(Operations.formatValue('unique', false)).toBe('重複を許可する');
  });

  test('空文字・空配列は(なし)', () => {
    expect(Operations.formatValue('defaultValue', '')).toBe('(なし)');
    expect(Operations.formatValue('defaultValue', [])).toBe('(なし)');
    expect(Operations.formatValue('defaultValue', ['a', 'b'])).toBe('a、b');
  });

  test('範囲の空欄は制限なし', () => {
    expect(Operations.formatValue('range', { min: '1', max: '' })).toBe(
      '最小: 1 / 最大: 制限なし',
    );
  });

  test('選択肢: 変更前(名前の配列)は改行区切り', () => {
    expect(Operations.formatValue('options', ['A', 'B'])).toBe('A\nB');
  });

  test('選択肢: 変更後は追加・名前変更・削除がわかる表示', () => {
    expect(
      Operations.formatValue(
        'options',
        [
          { from: 'A', label: 'A' },
          { from: 'B', label: 'B2' },
          { from: '', label: 'D' },
        ],
        ['A', 'B', 'C'],
      ),
    ).toBe('A\nB → B2(名前を変更)\nD(追加)\nC(削除)');
  });
});

describe('warningsFor', () => {
  test('削除・フィールドコード変更には警告がある', () => {
    expect(Operations.warningsFor('delete', null).length).toBeGreaterThan(0);
    expect(Operations.warningsFor('code', 'x').length).toBeGreaterThan(0);
  });

  test('必須・重複禁止は「する」ときだけ警告', () => {
    expect(Operations.warningsFor('required', true).length).toBe(1);
    expect(Operations.warningsFor('required', false).length).toBe(0);
    expect(Operations.warningsFor('unique', true).length).toBe(1);
  });

  test('選択肢: 名前の変更・削除があるときだけ、それぞれの影響を警告', () => {
    const before = ['A', 'B'];
    expect(
      Operations.warningsFor(
        'options',
        [
          { from: 'B', label: 'B' },
          { from: 'A', label: 'A' },
        ],
        before,
      ),
    ).toEqual([]);
    const renamed = Operations.warningsFor(
      'options',
      [
        { from: 'A', label: 'A2' },
        { from: 'B', label: 'B' },
      ],
      before,
    );
    expect(renamed).toEqual([expect.stringMatching(/既存レコードの値/)]);
    const deleted = Operations.warningsFor(
      'options',
      [{ from: 'A', label: 'A' }],
      before,
    );
    expect(deleted).toEqual([expect.stringMatching(/値として残ります/)]);
  });
});
