'use strict';

const MobileUrl = require('../js/lib/mobile-url');

describe('MobileUrl.build', () => {
  test('origin・appId・recordIdから正しいモバイル版URLを組み立てる', () => {
    // 実機(Puppeteer)でログイン後に確認済みのURL形式: `/k/m/{appId}/show?record={recordId}`。
    // `#record=`(PC版と同じハッシュ形式)はモバイル側では400エラー(CB_VA01)になるため
    // クエリ文字列形式を使う(idea.md参照)。
    expect(
      MobileUrl.build({
        origin: 'https://example.cybozu.com',
        appId: 12,
        recordId: 34,
      }),
    ).toBe('https://example.cybozu.com/k/m/12/show?record=34');
  });

  test('文字列形式の数値も受け付ける', () => {
    expect(
      MobileUrl.build({
        origin: 'https://example.cybozu.com',
        appId: '12',
        recordId: '34',
      }),
    ).toBe('https://example.cybozu.com/k/m/12/show?record=34');
  });

  test('appIdが不正な場合はnullを返す', () => {
    expect(
      MobileUrl.build({
        origin: 'https://example.cybozu.com',
        appId: 'abc',
        recordId: 34,
      }),
    ).toBeNull();
    expect(
      MobileUrl.build({
        origin: 'https://example.cybozu.com',
        appId: 0,
        recordId: 34,
      }),
    ).toBeNull();
    expect(
      MobileUrl.build({
        origin: 'https://example.cybozu.com',
        appId: -1,
        recordId: 34,
      }),
    ).toBeNull();
  });

  test('recordIdが不正な場合はnullを返す', () => {
    expect(
      MobileUrl.build({
        origin: 'https://example.cybozu.com',
        appId: 12,
        recordId: null,
      }),
    ).toBeNull();
    expect(
      MobileUrl.build({
        origin: 'https://example.cybozu.com',
        appId: 12,
        recordId: 'x',
      }),
    ).toBeNull();
  });

  test('originが空の場合はnullを返す', () => {
    expect(MobileUrl.build({ origin: '', appId: 12, recordId: 34 })).toBeNull();
  });
});
