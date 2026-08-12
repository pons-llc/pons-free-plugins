const Grouping = require('../js/lib/grouping');

describe('isGroupableField', () => {
  test('USER_SELECT, ORGANIZATION_SELECT, GROUP_SELECT, DROP_DOWN, RADIO_BUTTON, STATUS are groupable', () => {
    [
      'USER_SELECT',
      'ORGANIZATION_SELECT',
      'GROUP_SELECT',
      'DROP_DOWN',
      'RADIO_BUTTON',
      'STATUS',
    ].forEach((type) => expect(Grouping.isGroupableField({ type })).toBe(true));
  });

  test('other field types are not groupable', () => {
    expect(Grouping.isGroupableField({ type: 'SINGLE_LINE_TEXT' })).toBe(false);
  });

  test('a missing field is not groupable', () => {
    expect(Grouping.isGroupableField(undefined)).toBe(false);
  });
});

describe('buildDayGroups', () => {
  const evt = (groupKey, groupLabel) => ({
    groupKey,
    groupLabel,
    start: new Date(),
    end: new Date(),
  });

  test('returns a single "すべて" group when there are no events and no grouping', () => {
    const groups = Grouping.buildDayGroups([]);
    expect(groups).toEqual([{ key: '', label: 'すべて', events: [] }]);
  });

  test('groups events by groupKey, with unlabeled ("") group sorted last', () => {
    const groups = Grouping.buildDayGroups([
      evt('bob', 'Bob'),
      evt('', ''),
      evt('alice', 'Alice'),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['alice', 'bob', '']);
    expect(groups[2].label).toBe('(未設定)');
  });

  test('sorts named groups by label in Japanese locale order', () => {
    const groups = Grouping.buildDayGroups([
      evt('z', 'ゼータ'),
      evt('a', 'アルファ'),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['a', 'z']);
  });
});
