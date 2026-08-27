(function (root) {
  'use strict';

  // kintone.app.getFormFields()の戻り値(トップレベルのフィールドコードをキーにした平坦な
  // オブジェクト。テーブル内側の列は各テーブルフィールド自身の`fields`にネストされる、
  // REST APIドキュメント「フィールドを取得する」で確認済み)から、フィールドコード→
  // { type, subtableFieldCode, label } のフラットなカタログを組み立てる。subtableFieldCodeは
  // トップレベルのフィールドではnull、テーブルの列では親テーブルのフィールドコードになる。
  // idea.md「[[ ]]による繰り返しブロック」が、ブロック内のプレースホルダーからそのブロックが
  // どのテーブルに属するかを逆引きするために使う。

  const buildFieldCatalog = (formFields) => {
    const catalog = {};
    Object.values(formFields || {}).forEach((field) => {
      catalog[field.code] = {
        type: field.type,
        subtableFieldCode: null,
        label: field.label,
      };
      if (field.type === 'SUBTABLE' && field.fields) {
        Object.values(field.fields).forEach((column) => {
          catalog[column.code] = {
            type: column.type,
            subtableFieldCode: field.code,
            label: column.label,
          };
        });
      }
    });
    return catalog;
  };

  const FieldCatalog = { buildFieldCatalog };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldCatalog;
  } else {
    root.TemplateInsert = root.TemplateInsert || {};
    root.TemplateInsert.FieldCatalog = FieldCatalog;
  }
})(typeof window !== 'undefined' ? window : globalThis);
