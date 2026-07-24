'use strict';

const ButtonAction = require('../js/lib/button-action');

describe('ButtonAction.resolveButtonState', () => {
  test('SHOWルールは"VISIBLE"を返す', () => {
    expect(ButtonAction.resolveButtonState({ action: 'SHOW' })).toBe('VISIBLE');
  });

  test('HIDEルールは"HIDDEN"を返す', () => {
    expect(ButtonAction.resolveButtonState({ action: 'HIDE' })).toBe('HIDDEN');
  });

  test('一致するルールが無い(null)場合はnullを返し、何もしないことを示す', () => {
    expect(ButtonAction.resolveButtonState(null)).toBeNull();
  });

  test('未知のactionの場合もnullを返す(安全側フォールバック)', () => {
    expect(ButtonAction.resolveButtonState({ action: 'UNKNOWN' })).toBeNull();
  });
});
