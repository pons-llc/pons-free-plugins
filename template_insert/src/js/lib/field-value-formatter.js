(function (root) {
  'use strict';

  // プレースホルダー置換用に、kintoneのフィールドオブジェクト({type, value})を
  // 1つの文字列へ整形する(idea.md「プレースホルダー記法」参照)。

  const JOIN_SEPARATOR = '、';

  const NAME_LIST_TYPES = [
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
    'STATUS_ASSIGNEE',
  ];
  const SINGLE_ENTITY_TYPES = ['CREATOR', 'MODIFIER'];
  const STRING_LIST_TYPES = ['CHECK_BOX', 'MULTI_SELECT', 'CATEGORY'];

  // 値を持たず、プレースホルダーの対象として意味を持たないフィールド種類
  // (idea.md「対応するのはレコード直下の値を持つフィールド」参照)。
  const NON_VALUE_TYPES = [
    'LABEL',
    'SPACER',
    'HR',
    'GROUP',
    'REFERENCE_TABLE',
    'SUBTABLE',
  ];

  const isPlaceholderEligibleFieldType = (type) =>
    NON_VALUE_TYPES.indexOf(type) === -1;

  const formatFieldValueForPlaceholder = (field) => {
    if (!field) {
      return '';
    }
    const { type, value } = field;

    if (NAME_LIST_TYPES.indexOf(type) !== -1) {
      return (value || []).map((entity) => entity.name).join(JOIN_SEPARATOR);
    }
    if (SINGLE_ENTITY_TYPES.indexOf(type) !== -1) {
      return value ? value.name : '';
    }
    if (STRING_LIST_TYPES.indexOf(type) !== -1) {
      return (value || []).join(JOIN_SEPARATOR);
    }
    if (type === 'FILE') {
      return (value || []).map((file) => file.name).join(JOIN_SEPARATOR);
    }
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  };

  const FieldValueFormatter = {
    formatFieldValueForPlaceholder,
    isPlaceholderEligibleFieldType,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldValueFormatter;
  } else {
    root.TemplateInsert = root.TemplateInsert || {};
    root.TemplateInsert.FieldValueFormatter = FieldValueFormatter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
