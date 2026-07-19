(function (root) {
  'use strict';

  // 台帳アプリに自動作成するフィールドの定義(plugin_idea.mdの元メモのうち、システムフィールド
  // 〈レコード番号・作業者・作成者・更新者・ステータス・カテゴリー・作成日時・更新日時〉を除いた
  // 実際にadd-form-fields APIで作成可能な5項目のみ。idea.md「フィールド自動作成」参照)。
  // サブテーブルのフィールドコードは元メモ通りの`テーブル`ではなく`pcb_apps_table`にしている
  // (実環境E2Eテストで発見: TEST_APP_ID_1に元々「テーブル」という汎用的なコード名のSUBTABLEが
  // 存在し、コードが衝突すると本プラグインは「既存構成を尊重」して作成をスキップするため、
  // app_name/app_id/app_detailが永久に作れなくなる不具合があった。表示ラベルは元メモ通り
  // 「テーブル」のまま、コードだけ衝突しにくい一意な値に変更した)。
  const REQUIRED_FIELD_DEFINITIONS = [
    {
      code: 'plugin_id',
      type: 'SINGLE_LINE_TEXT',
      label: 'プラグインID',
      noLabel: false,
      required: true,
      unique: true,
      minLength: '',
      maxLength: '64',
      defaultValue: '',
    },
    {
      code: 'plugin_name',
      type: 'SINGLE_LINE_TEXT',
      label: 'プラグイン名称',
      noLabel: false,
      required: false,
      unique: false,
      minLength: '',
      maxLength: '',
      defaultValue: '',
    },
    {
      code: 'plugin_version',
      type: 'SINGLE_LINE_TEXT',
      label: 'バージョン',
      noLabel: false,
      required: false,
      unique: false,
      minLength: '',
      maxLength: '',
      defaultValue: '',
    },
    {
      code: 'plugin_detail',
      type: 'MULTI_LINE_TEXT',
      label: 'プラグイン詳細',
      noLabel: false,
      required: false,
      defaultValue: '',
    },
    {
      code: 'pcb_apps_table',
      type: 'SUBTABLE',
      label: 'テーブル',
      noLabel: false,
      fields: {
        app_name: {
          type: 'SINGLE_LINE_TEXT',
          code: 'app_name',
          label: 'アプリ名',
          noLabel: false,
          required: false,
          unique: false,
          minLength: '',
          maxLength: '',
          defaultValue: '',
        },
        app_id: {
          type: 'NUMBER',
          code: 'app_id',
          label: 'appid',
          noLabel: false,
          required: false,
          unique: false,
          defaultValue: '',
        },
        app_detail: {
          type: 'MULTI_LINE_TEXT',
          code: 'app_detail',
          label: 'アプリ説明',
          noLabel: false,
          required: false,
          defaultValue: '',
        },
      },
    },
  ];

  // 既存フィールド一覧(GET .../form/fields.jsonのproperties)に無い定義だけを抽出する。
  // 冪等性の中核: 2回目以降の設定保存でも、既存分を再作成しようとしてadd-form-fields APIを
  // 400エラーにしないため。テーブル自体が既に存在する場合、内包フィールドの過不足は見ない
  // (既存構成を尊重するスコープ、idea.md参照)。
  const diffMissingFields = (existingProperties, definitions) => {
    const defs = definitions || REQUIRED_FIELD_DEFINITIONS;
    const existingCodes = new Set(Object.keys(existingProperties || {}));
    return defs.filter((def) => !existingCodes.has(def.code));
  };

  // add-form-fields APIのpropertiesオブジェクト(キー=フィールドコード)へ組み立てる。
  const buildAddFieldsPayload = (missingDefinitions) => {
    const properties = {};
    missingDefinitions.forEach((def) => {
      properties[def.code] = def;
    });
    return properties;
  };

  const FieldDiff = {
    REQUIRED_FIELD_DEFINITIONS,
    diffMissingFields,
    buildAddFieldsPayload,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldDiff;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.FieldDiff = FieldDiff;
  }
})(typeof window !== 'undefined' ? window : globalThis);
