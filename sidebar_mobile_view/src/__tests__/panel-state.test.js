'use strict';

const PanelState = require('../js/lib/panel-state');

describe('PanelState.resolveInitialView', () => {
  test('レコード詳細画面(DETAIL)では、設定に関わらず常にOFF(サイドパネルは触らない)', () => {
    expect(
      PanelState.resolveInitialView({ defaultView: 'IFRAME' }, 'DETAIL'),
    ).toBe('OFF');
    expect(
      PanelState.resolveInitialView({ defaultView: 'NATIVE' }, 'DETAIL'),
    ).toBe('OFF');
  });

  test('編集画面(EDIT)・新規作成画面(CREATE)では、設定のdefaultViewに従う', () => {
    expect(
      PanelState.resolveInitialView({ defaultView: 'IFRAME' }, 'EDIT'),
    ).toBe('IFRAME');
    expect(
      PanelState.resolveInitialView({ defaultView: 'NATIVE' }, 'EDIT'),
    ).toBe('NATIVE');
    expect(
      PanelState.resolveInitialView({ defaultView: 'IFRAME' }, 'CREATE'),
    ).toBe('IFRAME');
    expect(
      PanelState.resolveInitialView({ defaultView: 'unknown' }, 'CREATE'),
    ).toBe('NATIVE');
  });

  test('screenKindを省略した場合は従来通りdefaultViewに従う(後方互換)', () => {
    expect(PanelState.resolveInitialView({ defaultView: 'IFRAME' })).toBe(
      'IFRAME',
    );
    expect(PanelState.resolveInitialView({ defaultView: 'NATIVE' })).toBe(
      'NATIVE',
    );
    expect(PanelState.resolveInitialView({})).toBe('NATIVE');
  });
});

describe('PanelState.toggleView', () => {
  test('IFRAME以外からはIFRAMEへ切り替わる', () => {
    expect(PanelState.toggleView('NATIVE')).toBe('IFRAME');
    expect(PanelState.toggleView('OFF')).toBe('IFRAME');
  });

  test('IFRAMEからは指定したoffStateへ戻る(既定はNATIVE、後方互換)', () => {
    expect(PanelState.toggleView('IFRAME')).toBe('NATIVE');
    expect(PanelState.toggleView('IFRAME', 'OFF')).toBe('OFF');
    expect(PanelState.toggleView('IFRAME', 'NATIVE')).toBe('NATIVE');
  });
});

describe('PanelState.resolveNativeSideBarState', () => {
  test('defaultNativeStateがHISTORYならHISTORYを返す', () => {
    expect(
      PanelState.resolveNativeSideBarState({ defaultNativeState: 'HISTORY' }),
    ).toBe('HISTORY');
  });

  test('defaultNativeStateがCOMMENTSまたは不正な値ならCOMMENTSを返す', () => {
    expect(
      PanelState.resolveNativeSideBarState({ defaultNativeState: 'COMMENTS' }),
    ).toBe('COMMENTS');
    expect(PanelState.resolveNativeSideBarState({})).toBe('COMMENTS');
  });
});

describe('PanelState.resolveToggleButtonLabel', () => {
  test('IFRAME以外(OFF・NATIVE)はモバイル版に切り替えるラベルを返す(ネイティブサイドバーの有無に関わらず)', () => {
    expect(PanelState.resolveToggleButtonLabel('OFF', true)).toMatch(
      /モバイル/,
    );
    expect(PanelState.resolveToggleButtonLabel('NATIVE', true)).toMatch(
      /モバイル/,
    );
    expect(PanelState.resolveToggleButtonLabel('NATIVE', false)).toMatch(
      /モバイル/,
    );
  });

  test('ネイティブサイドバーがある画面(詳細・編集)でIFRAME表示中は、コメント・履歴に戻すラベルを返す', () => {
    expect(PanelState.resolveToggleButtonLabel('IFRAME', true)).toMatch(
      /コメント|履歴/,
    );
  });

  test('ネイティブサイドバーが無い画面(新規作成)でIFRAME表示中は、閉じるラベルを返す', () => {
    expect(PanelState.resolveToggleButtonLabel('IFRAME', false)).toBe(
      'モバイル版を閉じる',
    );
  });

  test('hasNativeSideBarを省略した場合は既定でtrue扱い(後方互換)', () => {
    expect(PanelState.resolveToggleButtonLabel('IFRAME')).toMatch(
      /コメント|履歴/,
    );
  });
});
