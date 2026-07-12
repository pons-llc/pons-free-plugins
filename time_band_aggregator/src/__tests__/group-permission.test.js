'use strict';

const GroupPermission = require('../js/lib/group-permission');

describe('GroupPermission.isAuthorized', () => {
  test('ユーザーの所属グループが許可グループに含まれれば true', () => {
    expect(
      GroupPermission.isAuthorized(['group_a', 'group_b'], ['group_b']),
    ).toBe(true);
  });

  test('含まれなければ false', () => {
    expect(GroupPermission.isAuthorized(['group_a'], ['group_b'])).toBe(false);
  });

  test('許可グループが未指定・空配列なら常に false', () => {
    expect(GroupPermission.isAuthorized(['group_a'], [])).toBe(false);
    expect(GroupPermission.isAuthorized(['group_a'], null)).toBe(false);
  });

  test('ユーザーのグループが空配列なら false', () => {
    expect(GroupPermission.isAuthorized([], ['group_a'])).toBe(false);
  });
});

describe('GroupPermission.parseGroupCodesInput', () => {
  test('カンマ区切りをトリムして配列にする', () => {
    expect(
      GroupPermission.parseGroupCodesInput('group_a, group_b ,group_c'),
    ).toEqual(['group_a', 'group_b', 'group_c']);
  });

  test('空要素・空文字は除外する', () => {
    expect(GroupPermission.parseGroupCodesInput('group_a,,  ,group_b')).toEqual(
      ['group_a', 'group_b'],
    );
  });

  test('未指定はnull/undefinedでも空配列', () => {
    expect(GroupPermission.parseGroupCodesInput('')).toEqual([]);
    expect(GroupPermission.parseGroupCodesInput(undefined)).toEqual([]);
  });
});
