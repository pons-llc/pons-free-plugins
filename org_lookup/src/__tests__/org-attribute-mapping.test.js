'use strict';

const OrgAttributeMapping = require('../js/lib/org-attribute-mapping');

describe('OrgAttributeMapping.buildFieldValues', () => {
  const org = {
    code: 'sales_tokyo',
    name: '営業部東京支店',
    localName: '',
    description: '東京の営業拠点',
    parentCode: 'sales',
  };
  const parentOrg = {
    code: 'sales',
    name: '営業部',
    localName: 'Sales Dept.',
    description: '',
  };

  test('自組織の項目をそのまま転記する', () => {
    const mappings = [
      { attribute: 'name', destinationFieldCode: 'out_name' },
      { attribute: 'description', destinationFieldCode: 'out_desc' },
    ];
    expect(OrgAttributeMapping.buildFieldValues(org, null, mappings)).toEqual({
      out_name: '営業部東京支店',
      out_desc: '東京の営業拠点',
    });
  });

  test('parentCodeはparentOrgが無くてもorg自身の値を使う', () => {
    const mappings = [
      { attribute: 'parentCode', destinationFieldCode: 'out_parent_code' },
    ];
    expect(OrgAttributeMapping.buildFieldValues(org, null, mappings)).toEqual({
      out_parent_code: 'sales',
    });
  });

  test('親組織の項目はparentOrgから転記する', () => {
    const mappings = [
      { attribute: 'parentName', destinationFieldCode: 'out_parent_name' },
      {
        attribute: 'parentLocalName',
        destinationFieldCode: 'out_parent_local',
      },
    ];
    expect(
      OrgAttributeMapping.buildFieldValues(org, parentOrg, mappings),
    ).toEqual({
      out_parent_name: '営業部',
      out_parent_local: 'Sales Dept.',
    });
  });

  test('parentOrgがnullなら親組織系の項目はすべて空文字列', () => {
    const mappings = [
      { attribute: 'parentName', destinationFieldCode: 'out_parent_name' },
      {
        attribute: 'parentDescription',
        destinationFieldCode: 'out_parent_desc',
      },
    ];
    expect(OrgAttributeMapping.buildFieldValues(org, null, mappings)).toEqual({
      out_parent_name: '',
      out_parent_desc: '',
    });
  });

  test('orgがnull(該当組織なし)のときはすべて空文字列でクリアする', () => {
    const mappings = [
      { attribute: 'name', destinationFieldCode: 'out_name' },
      { attribute: 'parentName', destinationFieldCode: 'out_parent_name' },
    ];
    expect(OrgAttributeMapping.buildFieldValues(null, null, mappings)).toEqual({
      out_name: '',
      out_parent_name: '',
    });
  });

  test('destinationFieldCodeが無いマッピングは無視する', () => {
    const mappings = [{ attribute: 'name', destinationFieldCode: '' }];
    expect(OrgAttributeMapping.buildFieldValues(org, null, mappings)).toEqual(
      {},
    );
  });
});
