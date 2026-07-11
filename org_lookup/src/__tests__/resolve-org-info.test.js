'use strict';

const { resolveOrgInfo } = require('../js/lib/resolve-org-info');

describe('resolveOrgInfo', () => {
  test('コードが空ならフェッチャーを呼ばず、org/parentOrgともnull', async () => {
    const fetchOrgByCode = jest.fn();
    const result = await resolveOrgInfo('', fetchOrgByCode);
    expect(result).toEqual({ org: null, parentOrg: null });
    expect(fetchOrgByCode).not.toHaveBeenCalled();
  });

  test('親組織を持たない組織は1回だけフェッチし、parentOrgはnull', async () => {
    const org = { code: 'sales', name: '営業部', parentCode: null };
    const fetchOrgByCode = jest.fn().mockResolvedValue(org);
    const result = await resolveOrgInfo('sales', fetchOrgByCode);
    expect(result).toEqual({ org, parentOrg: null });
    expect(fetchOrgByCode).toHaveBeenCalledTimes(1);
    expect(fetchOrgByCode).toHaveBeenCalledWith('sales');
  });

  test('親組織を持つ組織は親組織も1回だけ追加フェッチする(計2回)', async () => {
    const child = {
      code: 'sales_tokyo',
      name: '営業部東京支店',
      parentCode: 'sales',
    };
    const parent = { code: 'sales', name: '営業部', parentCode: null };
    const fetchOrgByCode = jest.fn((code) =>
      Promise.resolve(code === 'sales_tokyo' ? child : parent),
    );
    const result = await resolveOrgInfo('sales_tokyo', fetchOrgByCode);
    expect(result).toEqual({ org: child, parentOrg: parent });
    expect(fetchOrgByCode).toHaveBeenCalledTimes(2);
    expect(fetchOrgByCode).toHaveBeenNthCalledWith(1, 'sales_tokyo');
    expect(fetchOrgByCode).toHaveBeenNthCalledWith(2, 'sales');
  });

  test('祖父組織は絶対に取得しない(親のparentCodeを参照しない)', async () => {
    // grandparentも存在するが、fetchOrgByCodeがgrandparentのcodeで呼ばれることは無いはず。
    const child = {
      code: 'sales_tokyo',
      name: '営業部東京支店',
      parentCode: 'sales',
    };
    const parent = {
      code: 'sales',
      name: '営業部',
      parentCode: 'headquarters',
    };
    const grandparent = {
      code: 'headquarters',
      name: '本社',
      parentCode: null,
    };
    const orgsByCode = {
      sales_tokyo: child,
      sales: parent,
      headquarters: grandparent,
    };
    const fetchOrgByCode = jest.fn((code) =>
      Promise.resolve(orgsByCode[code] || null),
    );

    const result = await resolveOrgInfo('sales_tokyo', fetchOrgByCode);

    expect(result).toEqual({ org: child, parentOrg: parent });
    expect(fetchOrgByCode).toHaveBeenCalledTimes(2);
    expect(fetchOrgByCode).not.toHaveBeenCalledWith('headquarters');
  });

  test('該当する組織が見つからない場合(未知のコード)、org/parentOrgともnull', async () => {
    const fetchOrgByCode = jest.fn().mockResolvedValue(null);
    const result = await resolveOrgInfo('unknown_code', fetchOrgByCode);
    expect(result).toEqual({ org: null, parentOrg: null });
    expect(fetchOrgByCode).toHaveBeenCalledTimes(1);
  });

  test('親組織のコードはあるが親組織自体が見つからない場合、parentOrgはnull', async () => {
    const org = {
      code: 'sales_tokyo',
      name: '営業部東京支店',
      parentCode: 'missing_parent',
    };
    const fetchOrgByCode = jest.fn((code) =>
      Promise.resolve(code === 'sales_tokyo' ? org : null),
    );
    const result = await resolveOrgInfo('sales_tokyo', fetchOrgByCode);
    expect(result).toEqual({ org, parentOrg: null });
    expect(fetchOrgByCode).toHaveBeenCalledTimes(2);
  });
});
