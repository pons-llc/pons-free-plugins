(function (root) {
  'use strict';

  // 転記できるユーザー情報項目の一覧。source は取得元API系統を表す。
  //   - REST: kintone.api()経由のUser API(GET /v1/users.json、実機で応答を確認済み。
  //     name/email/phone/mobilePhone/extensionNumber/employeeNumber/url/descriptionの
  //     各プロパティが存在する)
  //   - ORG: kintone.user.getOrganizations(code)(JavaScript API、REST不要)
  //   - GROUP: kintone.user.getGroups(code)(JavaScript API、REST不要)
  // ORG/GROUPはCLAUDE.md開発方針3(JavaScript API優先)に従い、REST(/v1/user/organizations.json等)を
  // 使わずJavaScript APIのみで完結させている(kintone公式Tips「アンチパターンから学ぶ ユーザーの
  // 組織情報とアイコンの取得」で推奨されている実装方法)。
  const ATTRIBUTES = [
    { key: 'name', label: '表示名', source: 'REST' },
    { key: 'email', label: 'メールアドレス', source: 'REST' },
    { key: 'phone', label: '電話番号', source: 'REST' },
    { key: 'mobilePhone', label: '携帯電話番号', source: 'REST' },
    { key: 'extensionNumber', label: '内線番号', source: 'REST' },
    { key: 'employeeNumber', label: '社員番号', source: 'REST' },
    { key: 'url', label: 'URL', source: 'REST' },
    { key: 'description', label: '自己紹介', source: 'REST' },
    { key: 'organizations', label: '所属(組織、複数は,区切り)', source: 'ORG' },
    { key: 'groups', label: 'グループ(複数は,区切り)', source: 'GROUP' },
  ];

  const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key);

  const UserAttributes = { ATTRIBUTES, ATTRIBUTE_KEYS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserAttributes;
  } else {
    root.UserInfoLookup = root.UserInfoLookup || {};
    root.UserInfoLookup.UserAttributes = UserAttributes;
  }
})(typeof window !== 'undefined' ? window : globalThis);
