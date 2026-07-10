(function (root) {
  'use strict';

  const UserAttributes =
    typeof module !== 'undefined' && module.exports
      ? require('./user-attributes')
      : root.UserInfoLookup.UserAttributes;

  const ATTRIBUTE_BY_KEY = {};
  UserAttributes.ATTRIBUTES.forEach((a) => {
    ATTRIBUTE_BY_KEY[a.key] = a;
  });

  // 所属/グループ(kintone.user.getOrganizations()/getGroups()の戻り値配列)を
  // idea.mdの方針通り「,」区切りの1つの文字列にまとめる。
  const joinOrganizations = (organizations) =>
    (organizations || [])
      .map((entry) =>
        entry && entry.organization ? entry.organization.name : '',
      )
      .filter((name) => !!name)
      .join(',');

  const joinGroups = (groups) =>
    (groups || [])
      .map((entry) => (entry ? entry.name : ''))
      .filter((name) => !!name)
      .join(',');

  // userInfo(REST User APIのusers[0]、またはnull) + organizations/groups(JS APIの戻り値、または
  // null) + mappings(設定行のマッピング配列)から、出力先フィールドへ書き込む値のオブジェクトを
  // 組み立てる。該当するユーザー情報が無い(userInfoがnull、または属性の値が空)場合は空文字列にする
  // (idea.mdの「一致しなかった場合は空文字列でクリアする」既存プラグイン方針を踏襲)。
  const buildFieldValues = (userInfo, organizations, groups, mappings) => {
    const result = {};
    (mappings || []).forEach((mapping) => {
      if (!mapping || !mapping.destinationFieldCode) {
        return;
      }
      const attribute = ATTRIBUTE_BY_KEY[mapping.attribute];
      let value = '';
      if (attribute) {
        if (attribute.source === 'REST') {
          value =
            userInfo && userInfo[mapping.attribute]
              ? userInfo[mapping.attribute]
              : '';
        } else if (attribute.source === 'ORG') {
          value = joinOrganizations(organizations);
        } else if (attribute.source === 'GROUP') {
          value = joinGroups(groups);
        }
      }
      result[mapping.destinationFieldCode] = value;
    });
    return result;
  };

  const UserAttributeMapping = { buildFieldValues };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserAttributeMapping;
  } else {
    root.UserInfoLookup = root.UserInfoLookup || {};
    root.UserInfoLookup.UserAttributeMapping = UserAttributeMapping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
