'use strict';

const CycleCheck = require('../js/lib/cycle-check');

const record = (id, parent) => ({
  $id: { type: '__ID__', value: id },
  parent_code: { type: 'SINGLE_LINE_TEXT', value: parent },
});

// Tree: 1 (root) -> 2 -> 3 -> 4
const records = [
  record('1', ''),
  record('2', '1'),
  record('3', '2'),
  record('4', '3'),
];

describe('CycleCheck.wouldCreateCycle', () => {
  test('rejects moving a record to be its own parent', () => {
    expect(
      CycleCheck.wouldCreateCycle(records, '2', '2', 'parent_code', '$id'),
    ).toBe(true);
  });

  test('rejects moving a record under its own descendant', () => {
    // Moving record 2 under record 4 (a descendant of 2) would create a cycle.
    expect(
      CycleCheck.wouldCreateCycle(records, '2', '4', 'parent_code', '$id'),
    ).toBe(true);
  });

  test('allows moving a record under an unrelated record', () => {
    const unrelated = [...records, record('5', '')];
    expect(
      CycleCheck.wouldCreateCycle(unrelated, '2', '5', 'parent_code', '$id'),
    ).toBe(false);
  });

  test('allows moving a record to become a root (empty new parent)', () => {
    expect(
      CycleCheck.wouldCreateCycle(records, '3', '', 'parent_code', '$id'),
    ).toBe(false);
  });

  test('allows moving a record under its own current ancestor (still a valid, non-cyclic move)', () => {
    // Moving record 4 under record 1 (its grandparent) is fine, no cycle.
    expect(
      CycleCheck.wouldCreateCycle(records, '4', '1', 'parent_code', '$id'),
    ).toBe(false);
  });

  test('does not hang when the existing data already contains a cycle', () => {
    const cyclic = [record('A', 'B'), record('B', 'A')];
    expect(() =>
      CycleCheck.wouldCreateCycle(cyclic, 'A', 'B', 'parent_code', '$id'),
    ).not.toThrow();
  });
});
