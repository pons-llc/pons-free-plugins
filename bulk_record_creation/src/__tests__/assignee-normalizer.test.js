'use strict';

const {
  normalizeUserSelection,
  normalizeOrganizationSelection,
  normalizeGroupSelection,
  flattenOrganizationMembers,
  flattenGroupMembers,
} = require('../js/lib/assignee-normalizer');

describe('normalizeUserSelection', () => {
  test('code重複を除去し{code,name}の配列にする', () => {
    const result = normalizeUserSelection([
      { code: 'sato', name: '佐藤', email: 'sato@example.com' },
      { code: 'kato', name: '加藤' },
      { code: 'sato', name: '佐藤(重複)' },
    ]);
    expect(result).toEqual([
      { code: 'sato', name: '佐藤' },
      { code: 'kato', name: '加藤' },
    ]);
  });

  test('未指定・空配列はそのまま空配列を返す', () => {
    expect(normalizeUserSelection(undefined)).toEqual([]);
    expect(normalizeUserSelection([])).toEqual([]);
  });
});

describe('normalizeOrganizationSelection', () => {
  test('code重複を除去する', () => {
    const result = normalizeOrganizationSelection([
      { code: 'sales', name: '営業部' },
      { code: 'sales', name: '営業部' },
      { code: 'dev', name: '開発部' },
    ]);
    expect(result).toEqual([
      { code: 'sales', name: '営業部' },
      { code: 'dev', name: '開発部' },
    ]);
  });
});

describe('normalizeGroupSelection', () => {
  test('code重複を除去する', () => {
    const result = normalizeGroupSelection([
      { code: 'pm', name: 'プロジェクトマネージャー' },
      { code: 'leader', name: 'チームリーダー' },
    ]);
    expect(result).toEqual([
      { code: 'pm', name: 'プロジェクトマネージャー' },
      { code: 'leader', name: 'チームリーダー' },
    ]);
  });
});

describe('flattenOrganizationMembers', () => {
  test('「組織の所属ユーザーを取得する」のuserTitlesレスポンス群を1人1件に展開・重複除去する', () => {
    const responses = [
      {
        userTitles: [
          { user: { code: 'sato', name: '佐藤' }, title: { code: 'Manager' } },
          { user: { code: 'kato', name: '加藤' }, title: null },
        ],
      },
      {
        // 別の組織にも所属している場合、同じユーザーが複数のレスポンスに登場し得る。
        userTitles: [
          { user: { code: 'sato', name: '佐藤' }, title: { code: 'Member' } },
          { user: { code: 'suzuki', name: '鈴木' }, title: null },
        ],
      },
    ];
    const result = flattenOrganizationMembers(responses);
    expect(result).toEqual([
      { code: 'sato', name: '佐藤' },
      { code: 'kato', name: '加藤' },
      { code: 'suzuki', name: '鈴木' },
    ]);
  });

  test('userTitlesが無い・空配列のレスポンスは無視する', () => {
    expect(flattenOrganizationMembers([{}, { userTitles: [] }])).toEqual([]);
    expect(flattenOrganizationMembers(undefined)).toEqual([]);
  });
});

describe('flattenGroupMembers', () => {
  test('「グループの所属ユーザーを取得する」のusersレスポンス群を1人1件に展開・重複除去する', () => {
    const responses = [
      {
        users: [
          { code: 'sato', name: '佐藤' },
          { code: 'kato', name: '加藤' },
        ],
      },
      {
        users: [
          { code: 'sato', name: '佐藤' },
          { code: 'suzuki', name: '鈴木' },
        ],
      },
    ];
    const result = flattenGroupMembers(responses);
    expect(result).toEqual([
      { code: 'sato', name: '佐藤' },
      { code: 'kato', name: '加藤' },
      { code: 'suzuki', name: '鈴木' },
    ]);
  });

  test('usersが無いレスポンスは無視する', () => {
    expect(flattenGroupMembers([{}])).toEqual([]);
    expect(flattenGroupMembers(undefined)).toEqual([]);
  });
});
