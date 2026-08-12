const GroupAuthorization = require('../js/lib/group-authorization');

describe('GroupAuthorization.isAuthorized', () => {
  test('true when the user belongs to one of the allowed groups', () => {
    const groups = [{ code: 'kanri_group' }, { code: 'admins' }];
    expect(GroupAuthorization.isAuthorized(groups, ['admins'])).toBe(true);
  });

  test('false when the user belongs to none of the allowed groups', () => {
    const groups = [{ code: 'general' }];
    expect(GroupAuthorization.isAuthorized(groups, ['admins'])).toBe(false);
  });

  test('false when allowedGroupCodes is empty, even if the user has groups (safe default)', () => {
    const groups = [{ code: 'admins' }];
    expect(GroupAuthorization.isAuthorized(groups, [])).toBe(false);
  });

  test('false when allowedGroupCodes is null/undefined', () => {
    const groups = [{ code: 'admins' }];
    expect(GroupAuthorization.isAuthorized(groups, null)).toBe(false);
    expect(GroupAuthorization.isAuthorized(groups, undefined)).toBe(false);
  });

  test('false when groups is empty/null/undefined', () => {
    expect(GroupAuthorization.isAuthorized([], ['admins'])).toBe(false);
    expect(GroupAuthorization.isAuthorized(null, ['admins'])).toBe(false);
    expect(GroupAuthorization.isAuthorized(undefined, ['admins'])).toBe(false);
  });
});
