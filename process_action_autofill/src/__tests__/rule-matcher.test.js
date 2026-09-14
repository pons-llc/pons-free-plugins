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
        {
          actionNames: ['承認する'],
          fromStatuses: ['未処理'],
          toStatuses: ['承認済'],
        },
        ctx,
      ),
    ).toBe(true);
  });

  test('全項目が未指定(空配列/undefined)ならワイルドカードとして常にtrue', () => {
    expect(
      matchesFilter({ actionNames: [], fromStatuses: [], toStatuses: [] }, ctx),
    ).toBe(true);
    expect(matchesFilter({}, ctx)).toBe(true);
    expect(matchesFilter(null, ctx)).toBe(true);
  });

  test('1項目だけ指定して、それが一致すればtrue(他はワイルドカード)', () => {
    expect(matchesFilter({ actionNames: ['承認する'] }, ctx)).toBe(true);
  });

  test('指定した項目が一致しなければfalse', () => {
    expect(matchesFilter({ actionNames: ['却下する'] }, ctx)).toBe(false);
    expect(matchesFilter({ fromStatuses: ['処理中'] }, ctx)).toBe(false);
    expect(matchesFilter({ toStatuses: ['差し戻し'] }, ctx)).toBe(false);
  });

  test('同じ項目内で複数選択した場合はいずれかに一致すればtrue(OR)', () => {
    expect(matchesFilter({ actionNames: ['却下する', '承認する'] }, ctx)).toBe(
      true,
    );
    expect(matchesFilter({ actionNames: ['却下する', '差し戻す'] }, ctx)).toBe(
      false,
    );
  });

  test('異なる項目間はすべてを満たす必要がある(AND)', () => {
    expect(
      matchesFilter(
        { actionNames: ['承認する'], toStatuses: ['差し戻し'] },
        ctx,
      ),
    ).toBe(false);
    expect(
      matchesFilter(
        { actionNames: ['承認する'], toStatuses: ['承認済', '差し戻し'] },
        ctx,
      ),
    ).toBe(true);
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
      { id: 'a', filter: { actionNames: ['承認する'] } },
      { id: 'b', filter: { actionNames: ['却下する'] } },
      { id: 'c', filter: {} },
    ];
    expect(matchRules(rules, ctx).map((r) => r.id)).toEqual(['a', 'c']);
  });

  test('rulesが空配列/undefinedの場合は空配列を返す', () => {
    expect(matchRules([], ctx)).toEqual([]);
    expect(matchRules(undefined, ctx)).toEqual([]);
  });
});
