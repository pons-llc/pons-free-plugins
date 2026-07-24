'use strict';

const GroupFieldAction = require('../js/lib/group-field-action');

describe('GroupFieldAction.resolveIsOpen', () => {
  test('OPENルールはtrueを返す', () => {
    expect(GroupFieldAction.resolveIsOpen({ action: 'OPEN' })).toBe(true);
  });

  test('CLOSEDルールはfalseを返す(falsyだがnullとは区別される)', () => {
    expect(GroupFieldAction.resolveIsOpen({ action: 'CLOSED' })).toBe(false);
  });

  test('一致するルールが無い(null)場合はnullを返し、何もしないことを示す', () => {
    expect(GroupFieldAction.resolveIsOpen(null)).toBeNull();
  });

  test('未知のactionの場合もnullを返す(安全側フォールバック)', () => {
    expect(GroupFieldAction.resolveIsOpen({ action: 'UNKNOWN' })).toBeNull();
  });
});
