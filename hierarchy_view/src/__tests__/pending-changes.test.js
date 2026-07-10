'use strict';

const PendingChanges = require('../js/lib/pending-changes');

describe('PendingChanges.setChange', () => {
  test('adds a new change without mutating the original object', () => {
    const original = {};
    const result = PendingChanges.setChange(original, '1', '2');
    expect(result).toEqual({ 1: '2' });
    expect(original).toEqual({});
  });

  test('overwrites an existing change for the same record (last write wins)', () => {
    const first = PendingChanges.setChange({}, '1', '2');
    const second = PendingChanges.setChange(first, '1', '3');
    expect(second).toEqual({ 1: '3' });
  });

  test('keeps changes for other records untouched', () => {
    const changes = PendingChanges.setChange({ 5: '9' }, '1', '2');
    expect(changes).toEqual({ 1: '2', 5: '9' });
  });
});

describe('PendingChanges.buildUpdateRequestBodies', () => {
  test('builds a single request body for a small change set', () => {
    const changes = { 1: '10', 2: '' };
    const bodies = PendingChanges.buildUpdateRequestBodies(
      42,
      changes,
      'parent_code',
    );
    expect(bodies).toEqual([
      {
        app: 42,
        records: [
          { id: '1', record: { parent_code: { value: '10' } } },
          { id: '2', record: { parent_code: { value: '' } } },
        ],
      },
    ]);
  });

  test('splits into multiple request bodies when exceeding the chunk size', () => {
    const changes = {};
    for (let i = 1; i <= 150; i += 1) {
      changes[i] = String(i);
    }
    const bodies = PendingChanges.buildUpdateRequestBodies(
      42,
      changes,
      'parent_code',
    );
    expect(bodies).toHaveLength(2);
    expect(bodies[0].records).toHaveLength(100);
    expect(bodies[1].records).toHaveLength(50);
  });

  test('returns an empty array when there are no pending changes', () => {
    expect(
      PendingChanges.buildUpdateRequestBodies(42, {}, 'parent_code'),
    ).toEqual([]);
  });

  test('respects a custom chunk size', () => {
    const changes = { 1: 'a', 2: 'b', 3: 'c' };
    const bodies = PendingChanges.buildUpdateRequestBodies(
      42,
      changes,
      'parent_code',
      2,
    );
    expect(bodies).toHaveLength(2);
    expect(bodies[0].records).toHaveLength(2);
    expect(bodies[1].records).toHaveLength(1);
  });
});
