'use strict';

const SortComparator = require('../js/lib/sort-comparator');

const row = (id, name, age) => ({
  id: String(id),
  value: {
    name: { type: 'SINGLE_LINE_TEXT', value: name },
    age: { type: 'NUMBER', value: age },
  },
});

describe('SortComparator.sortRows (single key)', () => {
  test('sorts strings ascending', () => {
    const rows = [row(1, 'charlie'), row(2, 'alice'), row(3, 'bob')];
    const result = SortComparator.sortRows(rows, [
      { columnCode: 'name', order: 'ASC', valueType: 'STRING' },
    ]);
    expect(result.map((r) => r.value.name.value)).toEqual([
      'alice',
      'bob',
      'charlie',
    ]);
  });

  test('sorts strings descending', () => {
    const rows = [row(1, 'charlie'), row(2, 'alice'), row(3, 'bob')];
    const result = SortComparator.sortRows(rows, [
      { columnCode: 'name', order: 'DESC', valueType: 'STRING' },
    ]);
    expect(result.map((r) => r.value.name.value)).toEqual([
      'charlie',
      'bob',
      'alice',
    ]);
  });

  test('sorts numbers numerically, not lexicographically', () => {
    const rows = [row(1, 'a', '9'), row(2, 'b', '10'), row(3, 'c', '2')];
    const result = SortComparator.sortRows(rows, [
      { columnCode: 'age', order: 'ASC', valueType: 'NUMBER' },
    ]);
    expect(result.map((r) => r.value.age.value)).toEqual(['2', '9', '10']);
  });

  test('does not mutate the original array', () => {
    const rows = [row(1, 'b'), row(2, 'a')];
    const original = [...rows];
    SortComparator.sortRows(rows, [
      { columnCode: 'name', order: 'ASC', valueType: 'STRING' },
    ]);
    expect(rows).toEqual(original);
  });
});

describe('SortComparator.sortRows (multiple keys)', () => {
  test('uses the second key to break ties on the first key', () => {
    const rows = [
      row(1, 'team-a', '30'),
      row(2, 'team-a', '20'),
      row(3, 'team-b', '10'),
      row(4, 'team-a', '25'),
    ];
    const result = SortComparator.sortRows(rows, [
      { columnCode: 'name', order: 'ASC', valueType: 'STRING' },
      { columnCode: 'age', order: 'ASC', valueType: 'NUMBER' },
    ]);
    expect(result.map((r) => [r.value.name.value, r.value.age.value])).toEqual([
      ['team-a', '20'],
      ['team-a', '25'],
      ['team-a', '30'],
      ['team-b', '10'],
    ]);
  });
});

describe('SortComparator.sortRows edge cases', () => {
  test('returns an empty array when rows is empty', () => {
    expect(
      SortComparator.sortRows([], [{ columnCode: 'name', order: 'ASC' }]),
    ).toEqual([]);
  });

  test('returns rows unchanged (as a copy) when sortKeys is empty', () => {
    const rows = [row(1, 'b'), row(2, 'a')];
    const result = SortComparator.sortRows(rows, []);
    expect(result).toEqual(rows);
    expect(result).not.toBe(rows);
  });

  test('treats a missing column value as an empty string for STRING comparisons', () => {
    const rows = [row(1, 'b'), { id: '2', value: {} }];
    const result = SortComparator.sortRows(rows, [
      { columnCode: 'name', order: 'ASC', valueType: 'STRING' },
    ]);
    expect(result[0].id).toBe('2');
  });
});
