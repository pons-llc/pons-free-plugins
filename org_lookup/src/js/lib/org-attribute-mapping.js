(function (root) {
  'use strict';

  // org(GET /v1/organizations.jsonのorganizations[0]、またはnull) + parentOrg(orgのparentCodeを
  // 使って追加取得した親組織、無ければnull) + mappings(設定行の転記項目の配列)から、出力先フィールドへ
  // 書き込む値のオブジェクトを組み立てる。該当する組織が無い(orgがnull)場合はすべて空文字列にする
  // (該当ユーザーが無い場合の既存プラグイン方針を踏襲)。parent系の属性は、parentOrgがnull
  // (親組織が無い、または取得できなかった)の場合は空文字列にする。ただしparentCodeのみは、org自身が
  // 持つ生の値をそのまま使う(親組織の取得に失敗していてもorg.parentCodeの値自体は分かるため)。
  const buildFieldValues = (org, parentOrg, mappings) => {
    const result = {};
    (mappings || []).forEach((mapping) => {
      if (!mapping || !mapping.destinationFieldCode) {
        return;
      }
      let value = '';
      switch (mapping.attribute) {
        case 'name':
          value = (org && org.name) || '';
          break;
        case 'localName':
          value = (org && org.localName) || '';
          break;
        case 'description':
          value = (org && org.description) || '';
          break;
        case 'parentCode':
          value = (org && org.parentCode) || '';
          break;
        case 'parentName':
          value = (parentOrg && parentOrg.name) || '';
          break;
        case 'parentLocalName':
          value = (parentOrg && parentOrg.localName) || '';
          break;
        case 'parentDescription':
          value = (parentOrg && parentOrg.description) || '';
          break;
        default:
          value = '';
      }
      result[mapping.destinationFieldCode] = value;
    });
    return result;
  };

  const OrgAttributeMapping = { buildFieldValues };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrgAttributeMapping;
  } else {
    root.OrgLookup = root.OrgLookup || {};
    root.OrgLookup.OrgAttributeMapping = OrgAttributeMapping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
