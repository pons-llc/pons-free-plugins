'use strict';

const PanelState = require('../js/lib/panel-state');

describe('PanelState.resolveInitialView', () => {
  test('defaultViewがIFRAMEならIFRAMEを返す', () => {
    expect(PanelState.resolveInitialView({ defaultView: 'IFRAME' })).toBe(
      'IFRAME',
    );
  });

  test('defaultViewがNATIVEまたは不正な値ならNATIVEを返す', () => {
    expect(PanelState.resolveInitialView({ defaultView: 'NATIVE' })).toBe(
      'NATIVE',
    );
    expect(PanelState.resolveInitialView({ defaultView: 'unknown' })).toBe(
      'NATIVE',
    );
    expect(PanelState.resolveInitialView({})).toBe('NATIVE');
  });
});

describe('PanelState.toggleView', () => {
  test('NATIVEとIFRAMEを反転する', () => {
    expect(PanelState.toggleView('NATIVE')).toBe('IFRAME');
    expect(PanelState.toggleView('IFRAME')).toBe('NATIVE');
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
  test('現在NATIVE表示中はモバイル版に切り替えるラベルを返す', () => {
    expect(PanelState.resolveToggleButtonLabel('NATIVE')).toMatch(/モバイル/);
  });

  test('現在IFRAME表示中はコメント・履歴に戻すラベルを返す', () => {
    expect(PanelState.resolveToggleButtonLabel('IFRAME')).toMatch(
      /コメント|履歴/,
    );
  });
});
