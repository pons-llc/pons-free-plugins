const { buildFieldCatalog } = require('../js/lib/field-catalog.js');

const formFields = {
  body_text: { code: 'body_text', type: 'MULTI_LINE_TEXT', label: '本文' },
  customer_name: {
    code: 'customer_name',
    type: 'SINGLE_LINE_TEXT',
    label: '顧客名',
  },
  items: {
    code: 'items',
    type: 'SUBTABLE',
    label: '明細',
    fields: {
      item_name: { code: 'item_name', type: 'SINGLE_LINE_TEXT', label: '品名' },
      quantity: { code: 'quantity', type: 'NUMBER', label: '数量' },
    },
  },
};

describe('buildFieldCatalog', () => {
  test('トップレベルのフィールドはsubtableFieldCode: nullになる', () => {
    const catalog = buildFieldCatalog(formFields);
    expect(catalog.body_text).toEqual({
      type: 'MULTI_LINE_TEXT',
      subtableFieldCode: null,
      label: '本文',
    });
    expect(catalog.customer_name).toEqual({
      type: 'SINGLE_LINE_TEXT',
      subtableFieldCode: null,
      label: '顧客名',
    });
  });

  test('テーブル自身のフィールドコードもsubtableFieldCode: nullで登録される', () => {
    const catalog = buildFieldCatalog(formFields);
    expect(catalog.items).toEqual({
      type: 'SUBTABLE',
      subtableFieldCode: null,
      label: '明細',
    });
  });

  test('テーブル内側の列はsubtableFieldCodeに親テーブルのコードを持つ', () => {
    const catalog = buildFieldCatalog(formFields);
    expect(catalog.item_name).toEqual({
      type: 'SINGLE_LINE_TEXT',
      subtableFieldCode: 'items',
      label: '品名',
    });
    expect(catalog.quantity).toEqual({
      type: 'NUMBER',
      subtableFieldCode: 'items',
      label: '数量',
    });
  });

  test('formFieldsが空でも例外にならない', () => {
    expect(buildFieldCatalog({})).toEqual({});
  });

  test('formFieldsがnull/undefinedでも例外にならない', () => {
    expect(buildFieldCatalog(undefined)).toEqual({});
  });
});
