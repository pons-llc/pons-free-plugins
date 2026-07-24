'use strict';

const SidebarAction = require('../js/lib/sidebar-action');

describe('SidebarAction.resolveShowSideBarState', () => {
  test('CLOSEDルールは"CLOSED"を返す', () => {
    expect(SidebarAction.resolveShowSideBarState({ action: 'CLOSED' })).toBe(
      'CLOSED',
    );
  });

  test('OPEN_COMMENTSルールは"COMMENTS"を返す', () => {
    expect(
      SidebarAction.resolveShowSideBarState({ action: 'OPEN_COMMENTS' }),
    ).toBe('COMMENTS');
  });

  test('OPEN_HISTORYルールは"HISTORY"を返す', () => {
    expect(
      SidebarAction.resolveShowSideBarState({ action: 'OPEN_HISTORY' }),
    ).toBe('HISTORY');
  });

  test('一致するルールが無い(null)場合はnullを返し、何もしないことを示す', () => {
    expect(SidebarAction.resolveShowSideBarState(null)).toBeNull();
  });

  test('未知のactionの場合もnullを返す(安全側フォールバック)', () => {
    expect(
      SidebarAction.resolveShowSideBarState({ action: 'UNKNOWN' }),
    ).toBeNull();
  });
});
