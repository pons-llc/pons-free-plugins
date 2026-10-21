const OptionChanges = require('../js/lib/option-changes.js');

const e = (from, label) => ({ from, label });

const dropDown = {
  type: 'DROP_DOWN',
  code: 'kind',
  label: '種別',
  options: {
    A: { label: 'A', index: '0' },
    B: { label: 'B', index: '1' },
    C: { label: 'C', index: '2' },
  },
  defaultValue: 'B',
};
const radio = {
  type: 'RADIO_BUTTON',
  code: 'r',
  label: 'ラジオ',
  options: {
    はい: { label: 'はい', index: '0' },
    いいえ: { label: 'いいえ', index: '1' },
  },
  defaultValue: 'はい',
};
const checkBox = {
  type: 'CHECK_BOX',
  code: 'cb',
  label: 'チェック',
  options: {
    x: { label: 'x', index: '0' },
    y: { label: 'y', index: '1' },
    z: { label: 'z', index: '2' },
  },
  defaultValue: ['x', 'z'],
};

describe('normalizeRows', () => {
  test('削除指定の行と、名前が空の追加行を除き、名前の前後の空白を除く', () => {
    expect(
      OptionChanges.normalizeRows([
        { from: 'A', label: ' A ', deleted: false },
        { from: 'B', label: 'B', deleted: true },
        { from: '', label: '  ', deleted: false },
        { from: '', label: ' D', deleted: false },
        { from: 'C', label: '', deleted: false },
      ]),
    ).toEqual([e('A', 'A'), e('', 'D'), e('C', '')]);
  });
});

describe('validateEntries(形のみ)', () => {
  test('1つ以上の {from, label} の配列', () => {
    expect(OptionChanges.validateEntries([])).toMatch(/1つ以上/);
    expect(OptionChanges.validateEntries(['A'])).not.toBe('');
    expect(OptionChanges.validateEntries([{ label: 'A' }])).not.toBe('');
    expect(OptionChanges.validateEntries([e('A', 'A')])).toBe('');
  });

  test('名前が空・名前の重複は不可', () => {
    expect(OptionChanges.validateEntries([e('A', '')])).toMatch(/空/);
    expect(OptionChanges.validateEntries([e('A', 'X'), e('', 'X')])).toMatch(
      /重複/,
    );
  });

  test('同じ既存の選択肢を2回使うのは不可', () => {
    expect(OptionChanges.validateEntries([e('A', 'A'), e('A', 'A2')])).not.toBe(
      '',
    );
  });
});

describe('validateEntries(現在の選択肢に照らす)', () => {
  const current = ['A', 'B', 'C'];

  test('変更元が現在の選択肢に無ければ不可(依頼後に選択肢が変わった等)', () => {
    expect(OptionChanges.validateEntries([e('Z', 'Z2')], current)).toMatch(
      /見つかりません/,
    );
  });

  test('追加する選択肢に既存の選択肢名は使えない', () => {
    expect(
      OptionChanges.validateEntries([e('A', 'A'), e('', 'B')], current),
    ).toMatch(/既存/);
  });

  test('別の既存の選択肢の名前への変更は不可(入れ替え・統合は意図しない値の変化になるため)', () => {
    expect(
      OptionChanges.validateEntries([e('A', 'B'), e('B', 'A')], current),
    ).toMatch(/既存/);
    // Bを削除してAをBに変える(統合)も不可
    expect(
      OptionChanges.validateEntries([e('A', 'B'), e('C', 'C')], current),
    ).toMatch(/既存/);
  });

  test('並べ替え・追加・名前変更・削除の組み合わせ', () => {
    expect(
      OptionChanges.validateEntries(
        [e('A', 'A'), e('C', 'C'), e('', 'D'), e('B', 'B2')],
        current,
      ),
    ).toBe('');
  });
});

describe('buildOptionsPatch', () => {
  test('キーは変更前の名前(追加は新しい名前)、labelは変更後の名前、indexは並び順', () => {
    const { patch, notes } = OptionChanges.buildOptionsPatch(
      [e('A', 'A'), e('C', 'C'), e('', 'D'), e('B', 'B2')],
      { ...dropDown, defaultValue: 'A' },
    );
    expect(patch).toEqual({
      options: {
        A: { label: 'A', index: '0' },
        C: { label: 'C', index: '1' },
        D: { label: 'D', index: '2' },
        B: { label: 'B2', index: '3' },
      },
    });
    expect(notes).toEqual([]);
  });

  test('初期値の選択肢の名前を変えたら、初期値も新しい名前にする', () => {
    const { patch, notes } = OptionChanges.buildOptionsPatch(
      [e('A', 'A'), e('B', 'B2'), e('C', 'C')],
      dropDown,
    );
    expect(patch.defaultValue).toBe('B2');
    expect(notes[0]).toMatch(/B2/);
  });

  test('ドロップダウンの初期値を削除したら空にする', () => {
    const { patch } = OptionChanges.buildOptionsPatch(
      [e('A', 'A'), e('C', 'C')],
      dropDown,
    );
    expect(patch.defaultValue).toBe('');
  });

  test('ラジオボタンの初期値を削除したら先頭の選択肢にする', () => {
    const { patch } = OptionChanges.buildOptionsPatch(
      [e('いいえ', 'いいえ'), e('', 'たぶん')],
      radio,
    );
    expect(patch.defaultValue).toBe('いいえ');
  });

  test('チェックボックスは名前変更を追従し、削除したものを除く', () => {
    const { patch } = OptionChanges.buildOptionsPatch(
      [e('x', 'X'), e('y', 'y')],
      checkBox,
    );
    expect(patch.defaultValue).toEqual(['X']);
  });

  test('初期値が変わらなければdefaultValueは送らない', () => {
    const { patch } = OptionChanges.buildOptionsPatch(
      [e('B', 'B'), e('A', 'A'), e('C', 'C')],
      dropDown,
    );
    expect(patch.defaultValue).toBeUndefined();
  });
});

describe('describe / deletedLabels / isNoop', () => {
  const before = ['A', 'B', 'C'];
  const after = [e('A', 'A'), e('', 'D'), e('B', 'B2')];

  test('変更後の一覧を、追加・名前変更・削除がわかる文言にする', () => {
    expect(OptionChanges.describe(before, after)).toBe(
      ['A', 'D(追加)', 'B → B2(名前を変更)', 'C(削除)'].join('\n'),
    );
  });

  test('変更前が不明でも表示できる', () => {
    expect(OptionChanges.describe(null, after)).toBe(
      ['A', 'D(追加)', 'B → B2(名前を変更)'].join('\n'),
    );
  });

  test('削除される選択肢', () => {
    expect(OptionChanges.deletedLabels(before, after)).toEqual(['C']);
    expect(OptionChanges.renamed(after)).toEqual([e('B', 'B2')]);
  });

  test('並び順も名前も同じなら変更なし', () => {
    expect(
      OptionChanges.isNoop(before, [e('A', 'A'), e('B', 'B'), e('C', 'C')]),
    ).toBe(true);
    expect(
      OptionChanges.isNoop(before, [e('B', 'B'), e('A', 'A'), e('C', 'C')]),
    ).toBe(false);
  });
});
