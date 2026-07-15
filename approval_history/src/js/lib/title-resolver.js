(function (root) {
  'use strict';

  // kintone.user.getOrganizations()の戻り値配列(idea.md「役職の解決方法」)から、
  // サブテーブルに記録する役職名(文字列)を1つ解決する。
  // 優先順: 1) primaryな組織のtitle.name 2) titleが設定されている最初の組織 3) 空文字列。
  const resolveTitle = (organizations) => {
    if (!Array.isArray(organizations) || organizations.length === 0) {
      return '';
    }

    const primary = organizations.find(
      (entry) =>
        entry &&
        entry.organization &&
        entry.organization.primary &&
        entry.title &&
        entry.title.name,
    );
    if (primary) {
      return primary.title.name;
    }

    const withTitle = organizations.find(
      (entry) => entry && entry.title && entry.title.name,
    );
    return withTitle ? withTitle.title.name : '';
  };

  const TitleResolver = { resolveTitle };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TitleResolver;
  } else {
    root.ApprovalHistory = root.ApprovalHistory || {};
    root.ApprovalHistory.TitleResolver = TitleResolver;
  }
})(typeof window !== 'undefined' ? window : globalThis);
