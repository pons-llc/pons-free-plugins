'use strict';

const UserAttributeMapping = require('../js/lib/user-attribute-mapping');

describe('UserAttributeMapping.buildFieldValues', () => {
  const userInfo = {
    name: '佐藤 太郎',
    email: 'sato@example.com',
    phone: '03-1111-2222',
    mobilePhone: '',
    extensionNumber: '',
    employeeNumber: 'E001',
    url: '',
    description: '',
  };
  const organizations = [
    { organization: { name: '営業部', primary: true }, title: null },
    { organization: { name: '第一グループ', primary: false }, title: null },
  ];
  const groups = [{ name: '全社員' }, { name: '管理者' }];

  test('REST由来の属性(氏名・メール等)をそのまま転記する', () => {
    const mappings = [
      { attribute: 'name', destinationFieldCode: 'out_name' },
      { attribute: 'email', destinationFieldCode: 'out_email' },
    ];
    expect(
      UserAttributeMapping.buildFieldValues(userInfo, null, null, mappings),
    ).toEqual({
      out_name: '佐藤 太郎',
      out_email: 'sato@example.com',
    });
  });

  test('値が空文字列のREST属性はそのまま空文字列になる', () => {
    const mappings = [
      { attribute: 'mobilePhone', destinationFieldCode: 'out_mobile' },
    ];
    expect(
      UserAttributeMapping.buildFieldValues(userInfo, null, null, mappings),
    ).toEqual({ out_mobile: '' });
  });

  test('所属はカンマ区切りで結合する', () => {
    const mappings = [
      { attribute: 'organizations', destinationFieldCode: 'out_org' },
    ];
    expect(
      UserAttributeMapping.buildFieldValues(
        userInfo,
        organizations,
        null,
        mappings,
      ),
    ).toEqual({ out_org: '営業部,第一グループ' });
  });

  test('グループはカンマ区切りで結合する', () => {
    const mappings = [
      { attribute: 'groups', destinationFieldCode: 'out_group' },
    ];
    expect(
      UserAttributeMapping.buildFieldValues(userInfo, null, groups, mappings),
    ).toEqual({ out_group: '全社員,管理者' });
  });

  test('userInfoがnull(該当ユーザーなし)のときはすべて空文字列でクリアする', () => {
    const mappings = [
      { attribute: 'name', destinationFieldCode: 'out_name' },
      { attribute: 'organizations', destinationFieldCode: 'out_org' },
      { attribute: 'groups', destinationFieldCode: 'out_group' },
    ];
    expect(
      UserAttributeMapping.buildFieldValues(null, null, null, mappings),
    ).toEqual({ out_name: '', out_org: '', out_group: '' });
  });

  test('destinationFieldCodeが無いマッピングは無視する', () => {
    const mappings = [{ attribute: 'name', destinationFieldCode: '' }];
    expect(
      UserAttributeMapping.buildFieldValues(userInfo, null, null, mappings),
    ).toEqual({});
  });
});
