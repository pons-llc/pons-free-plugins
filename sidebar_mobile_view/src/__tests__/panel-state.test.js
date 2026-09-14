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
  test('現在NATIVE表示中はモバイル版に切り替えるラベルを返す(ネイティブサイドバーの有無に関わらず)', () => {
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
