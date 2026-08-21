(function (root) {
  'use strict';

  const FieldCatalog =
    typeof module !== 'undefined' && module.exports
      ? require('./field-catalog')
      : root.ReportPromptBuilder.FieldCatalog;

  // フィールドカテゴリ別の値整形。以前はAIへのプロンプト内の文字列(コードスニペット)として
  // 埋め込んでいたロジックを、プラグイン自身が直接実行する実コードに昇格したもの
  // (idea.md「AI不要の直接描画への転換」参照)。

  const formatText = (field) =>
    field && typeof field.value === 'string' ? field.value : '';

  const formatNumber = (field) =>
    field && field.value !== '' && field.value != null
      ? String(field.value)
      : '';

  // DATE: 値は "YYYY-MM-DD" のタイムゾーン情報を持たない文字列。既知の落とし穴として、
  // Dateオブジェクト経由で整形するとUTCより時刻が遅れるタイムゾーンの環境で前日にずれることが
  // あるため、Dateオブジェクトを経由せず文字列分割で整形する。
  const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
  const formatDate = (field) => {
    if (!field || !field.value) {
      return '';
    }
    const match = DATE_PATTERN.exec(field.value);
    return match ? `${match[1]}年${match[2]}月${match[3]}日` : field.value;
  };

  // DATETIME・CREATED_TIME・UPDATED_TIME: 値はタイムゾーン付きのISO8601文字列。
  // Dateオブジェクトへ変換し実行ユーザーのローカルタイムゾーンで整形するのが期待動作
  // (DATEとは異なりこちらは変換してよい、time_band_aggregatorの既知の仕様と対になる)。
  const formatDateTime = (field) => {
    if (!field || !field.value) {
      return '';
    }
    const date = new Date(field.value);
    return Number.isNaN(date.getTime())
      ? field.value
      : date.toLocaleString('ja-JP');
  };

  const formatTime = (field) =>
    field && typeof field.value === 'string' ? field.value : '';

  // 桁区切り: kintoneのNUMBER/CALC(数値)フィールドの値は、JSのNumberで丸め誤差なく表現
  // できない桁数のこともあるため(帳票=金額を扱うことが多く、丸め誤差は許容できない)、
  // Numberへ変換せず文字列のまま整数部分にのみカンマを挿入する。
  const NUMERIC_STRING_PATTERN = /^-?\d+(\.\d+)?$/;
  const insertThousandsSeparators = (numericString) => {
    const isNegative = numericString.startsWith('-');
    const unsigned = isNegative ? numericString.slice(1) : numericString;
    const [integerPart, decimalPart] = unsigned.split('.');
    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const grouped =
      decimalPart !== undefined
        ? `${groupedInteger}.${decimalPart}`
        : groupedInteger;
    return isNegative ? `-${grouped}` : grouped;
  };

  // NUMBER型、およびCALC型で数値形式のフィールド向け。単位(kintoneのフィールド設定と同じ
  // unit/unitPosition)・桁区切りの表示有無を、設定画面での項目ごとの選択(showUnit/digitGrouping)
  // に応じて切り替える。
  const formatNumericValue = (field, options) => {
    if (!field || field.value === '' || field.value == null) {
      return '';
    }
    const rawValue = String(field.value);
    const grouped =
      options.digitGrouping && NUMERIC_STRING_PATTERN.test(rawValue)
        ? insertThousandsSeparators(rawValue)
        : rawValue;

    if (!options.showUnit || !options.unit) {
      return grouped;
    }
    return options.unitPosition === 'BEFORE'
      ? `${options.unit}${grouped}`
      : `${grouped}${options.unit}`;
  };

  const formatMultiChoice = (field) =>
    field && Array.isArray(field.value) ? field.value.join('、') : '';

  const formatEntity = (field) => {
    if (!field || !field.value) {
      return '';
    }
    const entities = Array.isArray(field.value) ? field.value : [field.value];
    return entities.map((entity) => entity.name).join('、');
  };

  const FORMATTERS_BY_CATEGORY = {
    TEXT: formatText,
    NUMBER: formatNumber,
    DATE: formatDate,
    DATETIME: formatDateTime,
    TIME: formatTime,
    CHOICE: formatText,
    MULTI_CHOICE: formatMultiChoice,
    ENTITY: formatEntity,
  };

  const formatFieldValue = (type, field) => {
    const category = FieldCatalog.categoryForType(type);
    const formatter = category && FORMATTERS_BY_CATEGORY[category];
    return formatter ? formatter(field) : '';
  };

  const FieldValueFormatter = {
    formatFieldValue,
    formatNumericValue,
    FORMATTERS_BY_CATEGORY,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldValueFormatter;
  } else {
    root.ReportPromptBuilder = root.ReportPromptBuilder || {};
    root.ReportPromptBuilder.FieldValueFormatter = FieldValueFormatter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
