(function (root) {
  'use strict';

  // ユーザー/組織/グループの選択結果を、対象者フィールドへ書き込む{code, name}の配列に
  // 正規化する(純粋関数)。idea.md「対象者フィールドと展開方式」参照。
  // 実際のUser API呼び出し(kintone.api())はこのファイルでは行わない
  // (テストのためkintone依存を持たせず、呼び出し結果をそのまま入力として受け取る)。

  const dedupeByCode = (entries) => {
    const seen = new Set();
    const result = [];
    (entries || []).forEach((entry) => {
      if (!entry || !entry.code || seen.has(entry.code)) {
        return;
      }
      seen.add(entry.code);
      result.push({ code: entry.code, name: entry.name });
    });
    return result;
  };

  // 実行時にユーザー選択UIで直接選ばれたユーザー一覧を正規化する。
  const normalizeUserSelection = (selectedUsers) => dedupeByCode(selectedUsers);

  // 実行時に組織選択UIで選ばれた組織一覧を正規化する(組織単位でレコードを作る場合)。
  const normalizeOrganizationSelection = (selectedOrganizations) =>
    dedupeByCode(selectedOrganizations);

  // 実行時にグループ選択UIで選ばれたグループ一覧を正規化する(グループ単位でレコードを作る場合)。
  const normalizeGroupSelection = (selectedGroups) =>
    dedupeByCode(selectedGroups);

  // 「組織の所属ユーザーを取得する」(GET /v1/organization/users.json)のレスポンスを
  // 選択組織の件数分集めた配列から、所属ユーザーを1人1件に展開する(複数組織に
  // またがって所属するユーザーは重複除去する)。レスポンス形式は`userTitles: [{ user, title }]`。
  const flattenOrganizationMembers = (organizationMembersResponses) => {
    const users = (organizationMembersResponses || []).flatMap((response) =>
      ((response && response.userTitles) || []).map((entry) => entry.user),
    );
    return dedupeByCode(users);
  };

  // 「グループの所属ユーザーを取得する」(GET /v1/group/users.json)のレスポンスを
  // 選択グループの件数分集めた配列から、所属ユーザーを1人1件に展開する。
  // レスポンス形式は`users: [User型]`(組織側の`userTitles`とは構造が異なる)。
  const flattenGroupMembers = (groupMembersResponses) => {
    const users = (groupMembersResponses || []).flatMap(
      (response) => (response && response.users) || [],
    );
    return dedupeByCode(users);
  };

  const AssigneeNormalizer = {
    normalizeUserSelection,
    normalizeOrganizationSelection,
    normalizeGroupSelection,
    flattenOrganizationMembers,
    flattenGroupMembers,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssigneeNormalizer;
  } else {
    root.BulkRecordCreation = root.BulkRecordCreation || {};
    root.BulkRecordCreation.AssigneeNormalizer = AssigneeNormalizer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
