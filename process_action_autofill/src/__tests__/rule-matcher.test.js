const { matchesFilter, matchRules } = require('../js/lib/rule-matcher');

describe('matchesFilter', () => {
  const ctx = {
    actionName: '承認する',
    fromStatus: '未処理',
    toStatus: '承認済',
  };

  test('全項目が一致すればtrue', () => {
    expect(
      matchesFilter(
        { actionName: '承認する', fromStatus: '未処理', toStatus: '承認済' },
        ctx,
      ),
    ).toBe(true);
  });

  test('全項目が未指定(null)ならワイルドカードとして常にtrue', () => {
    expect(
      matchesFilter(
        { actionName: null, fromStatus: null, toStatus: null },
        ctx,
      ),
    ).toBe(true);
    expect(matchesFilter({}, ctx)).toBe(true);
    expect(matchesFilter(null, ctx)).toBe(true);
  });

  test('空文字列もワイルドカードとして扱う', () => {
    expect(
      matchesFilter({ actionName: '', fromStatus: '', toStatus: '' }, ctx),
    ).toBe(true);
  });

  test('1項目だけ指定して、それが一致すればtrue(他はワイルドカード)', () => {
    expect(matchesFilter({ actionName: '承認する' }, ctx)).toBe(true);
  });

  test('指定した項目が一致しなければfalse', () => {
    expect(matchesFilter({ actionName: '却下する' }, ctx)).toBe(false);
    expect(matchesFilter({ fromStatus: '処理中' }, ctx)).toBe(false);
    expect(matchesFilter({ toStatus: '差し戻し' }, ctx)).toBe(false);
  });

  test('複数項目のAND条件: 一部が一致しなければfalse', () => {
    expect(
      matchesFilter({ actionName: '承認する', toStatus: '差し戻し' }, ctx),
    ).toBe(false);
  });
});

describe('matchRules', () => {
  const ctx = {
    actionName: '承認する',
    fromStatus: '未処理',
    toStatus: '承認済',
  };

  test('一致したルールのみを設定順のまま返す', () => {
    const rules = [
      { id: 'a', filter: { actionName: '承認する' } },
      { id: 'b', filter: { actionName: '却下する' } },
      { id: 'c', filter: {} },
    ];
    expect(matchRules(rules, ctx).map((r) => r.id)).toEqual(['a', 'c']);
  });

  test('rulesが空配列/undefinedの場合は空配列を返す', () => {
    expect(matchRules([], ctx)).toEqual([]);
    expect(matchRules(undefined, ctx)).toEqual([]);
  });
});
