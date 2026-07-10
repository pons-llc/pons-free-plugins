'use strict';

const TabVisibility = require('../js/lib/tab-visibility');

describe('TabVisibility.computeVisibility', () => {
  const tabs = [
    { label: '基本情報', itemCodes: ['name', 'address'] },
    { label: '詳細情報', itemCodes: ['note', 'label_1'] },
  ];

  test('marks the active tab items as visible', () => {
    const result = TabVisibility.computeVisibility(tabs, 0);
    expect(result.name).toBe(true);
    expect(result.address).toBe(true);
  });

  test('marks other tabs items as hidden', () => {
    const result = TabVisibility.computeVisibility(tabs, 0);
    expect(result.note).toBe(false);
    expect(result.label_1).toBe(false);
  });

  test('switches visibility when a different tab is active', () => {
    const result = TabVisibility.computeVisibility(tabs, 1);
    expect(result.name).toBe(false);
    expect(result.address).toBe(false);
    expect(result.note).toBe(true);
    expect(result.label_1).toBe(true);
  });

  test('does not include items that belong to no tab', () => {
    const result = TabVisibility.computeVisibility(tabs, 0);
    expect(result).not.toHaveProperty('not_managed_field');
  });

  test('an item assigned to multiple tabs is visible whenever the active tab contains it', () => {
    const overlapTabs = [
      { label: 'A', itemCodes: ['shared', 'a_only'] },
      { label: 'B', itemCodes: ['shared', 'b_only'] },
    ];
    const resultA = TabVisibility.computeVisibility(overlapTabs, 0);
    expect(resultA.shared).toBe(true);
    expect(resultA.a_only).toBe(true);
    expect(resultA.b_only).toBe(false);

    const resultB = TabVisibility.computeVisibility(overlapTabs, 1);
    expect(resultB.shared).toBe(true);
    expect(resultB.a_only).toBe(false);
    expect(resultB.b_only).toBe(true);
  });

  test('returns an empty object when tabs is empty', () => {
    expect(TabVisibility.computeVisibility([], 0)).toEqual({});
  });

  test('hides every managed item when activeTabIndex is out of range', () => {
    const result = TabVisibility.computeVisibility(tabs, 99);
    expect(result).toEqual({
      name: false,
      address: false,
      note: false,
      label_1: false,
    });
  });
});

describe('TabVisibility.resolveDefaultTabIndex', () => {
  const tabs = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];

  test('returns the configured index when it is valid', () => {
    expect(TabVisibility.resolveDefaultTabIndex(tabs, 1)).toBe(1);
  });

  test('falls back to 0 when the configured index is missing', () => {
    expect(TabVisibility.resolveDefaultTabIndex(tabs, undefined)).toBe(0);
  });

  test('falls back to 0 when the configured index is out of range', () => {
    expect(TabVisibility.resolveDefaultTabIndex(tabs, 5)).toBe(0);
    expect(TabVisibility.resolveDefaultTabIndex(tabs, -1)).toBe(0);
  });

  test('falls back to 0 when tabs is empty', () => {
    expect(TabVisibility.resolveDefaultTabIndex([], 0)).toBe(0);
  });
});
