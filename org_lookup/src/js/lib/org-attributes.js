(function (root) {
  'use strict';

  // 転記できる組織情報項目の一覧。すべて GET /v1/organizations.json(User APIと同じ系統、実機で
  // 応答を確認済み。code/name/localName/localNameLocale/parentCode/descriptionの各プロパティが
  // 存在する)から取得する。
  //
  // parent系(親組織)は、自組織のparentCodeが設定されている場合のみ、親組織を1回だけ追加取得して
  // 埋める(祖父以上へは遡らない、元メモ「親組織があった場合は親組織もルックアップする。祖父以上までは
  // 遡らない」)。
  const ATTRIBUTES = [
    { key: 'name', label: '組織名' },
    { key: 'localName', label: '組織名(別言語)' },
    { key: 'description', label: '組織の説明' },
    { key: 'parentCode', label: '親組織コード' },
    { key: 'parentName', label: '親組織名' },
    { key: 'parentLocalName', label: '親組織名(別言語)' },
    { key: 'parentDescription', label: '親組織の説明' },
  ];

  const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key);

  const OrgAttributes = { ATTRIBUTES, ATTRIBUTE_KEYS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrgAttributes;
  } else {
    root.OrgLookup = root.OrgLookup || {};
    root.OrgLookup.OrgAttributes = OrgAttributes;
  }
})(typeof window !== 'undefined' ? window : globalThis);
