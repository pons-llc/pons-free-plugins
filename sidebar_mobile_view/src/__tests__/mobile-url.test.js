'use strict';

const MobileUrl = require('../js/lib/mobile-url');

describe('MobileUrl.buildRecordUrl', () => {
  test('origin・appId・recordIdから正しいモバイル版レコード詳細URLを組み立てる', () => {
    // 実機(Puppeteer)でログイン後に確認済みのURL形式: `/k/m/{appId}/show?record={recordId}`。
    // `#record=`(PC版と同じハッシュ形式)はモバイル側では400エラー(CB_VA01)になるため
    // クエリ文字列形式を使う(idea.md参照)。
    expect(
      MobileUrl.buildRecordUrl({
        origin: 'https://example.cybozu.com',
        appId: 12,
        recordId: 34,
      }),
    ).toBe('https://example.cybozu.com/k/m/12/show?record=34');
  });

  test('文字列形式の数値も受け付ける', () => {
    expect(
      MobileUrl.buildRecordUrl({
        origin: 'https://example.cybozu.com',
        appId: '12',
        recordId: '34',
      }),
    ).toBe('https://example.cybozu.com/k/m/12/show?record=34');
  });

  test('appIdが不正な場合はnullを返す', () => {
    expect(
      MobileUrl.buildRecordUrl({
        origin: 'https://example.cybozu.com',
        appId: 'abc',
        recordId: 34,
      }),
    ).toBeNull();
    expect(
      MobileUrl.buildRecordUrl({
        origin: 'https://example.cybozu.com',
        appId: 0,
        recordId: 34,
      }),
    ).toBeNull();
    expect(
      MobileUrl.buildRecordUrl({
        origin: 'https://example.cybozu.com',
        appId: -1,
        recordId: 34,
      }),
    ).toBeNull();
  });

  test('recordIdが不正な場合はnullを返す', () => {
    expect(
      MobileUrl.buildRecordUrl({
        origin: 'https://example.cybozu.com',
        appId: 12,
        recordId: null,
      }),
    ).toBeNull();
    expect(
      MobileUrl.buildRecordUrl({
        origin: 'https://example.cybozu.com',
        appId: 12,
        recordId: 'x',
      }),
    ).toBeNull();
  });

  test('originが空の場合はnullを返す', () => {
    expect(
      MobileUrl.buildRecordUrl({ origin: '', appId: 12, recordId: 34 }),
    ).toBeNull();
  });
});

describe('MobileUrl.buildListUrl', () => {
  test('origin・appIdから正しいモバイル版レコード一覧URLを組み立てる', () => {
    // 実機で確認済みのURL形式: `/k/m/{appId}/`(PCの一覧`/k/{appId}/`のモバイル版)。
    expect(
      MobileUrl.buildListUrl({
        origin: 'https://example.cybozu.com',
        appId: 12,
      }),
    ).toBe('https://example.cybozu.com/k/m/12/');
  });

  test('appIdが不正な場合はnullを返す', () => {
    expect(
      MobileUrl.buildListUrl({
        origin: 'https://example.cybozu.com',
        appId: 'abc',
      }),
    ).toBeNull();
  });

  test('originが空の場合はnullを返す', () => {
    expect(MobileUrl.buildListUrl({ origin: '', appId: 12 })).toBeNull();
  });
});

describe('MobileUrl.resolve', () => {
  const origin = 'https://example.cybozu.com';

  test('対象アプリIDが未指定(現在のアプリと同じ)かつレコードIDがある場合はレコード詳細URL', () => {
    expect(
      MobileUrl.resolve({
        origin,
        currentAppId: 12,
        targetAppId: '',
        recordId: 34,
      }),
    ).toBe('https://example.cybozu.com/k/m/12/show?record=34');
  });

  test('対象アプリIDが現在のアプリと同じ値を明示していてもレコード詳細URL', () => {
    expect(
      MobileUrl.resolve({
        origin,
        currentAppId: 12,
        targetAppId: '12',
        recordId: 34,
      }),
    ).toBe('https://example.cybozu.com/k/m/12/show?record=34');
  });

  test('レコードIDが無い場合(新規作成画面等)は現在のアプリの一覧URL', () => {
    expect(
      MobileUrl.resolve({
        origin,
        currentAppId: 12,
        targetAppId: '',
        recordId: null,
      }),
    ).toBe('https://example.cybozu.com/k/m/12/');
  });

  test('対象アプリIDが現在のアプリと異なる場合は、レコードIDの有無に関わらずそのアプリの一覧URL', () => {
    expect(
      MobileUrl.resolve({
        origin,
        currentAppId: 12,
        targetAppId: '99',
        recordId: 34,
      }),
    ).toBe('https://example.cybozu.com/k/m/99/');
  });

  test('対象アプリID・現在のアプリIDのいずれも不正な場合はnull', () => {
    expect(
      MobileUrl.resolve({
        origin,
        currentAppId: 'abc',
        targetAppId: '',
        recordId: 34,
      }),
    ).toBeNull();
  });
});
