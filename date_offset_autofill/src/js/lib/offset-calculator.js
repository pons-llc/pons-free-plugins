(function (root) {
  'use strict';

  const MS_PER_DAY = 86400000;
  const MS_PER_SECOND = 1000;

  const isEmpty = (v) => v === undefined || v === null || v === '';

  // ルールのオフセット指定({ offsetSource, fixedValue })と、FIELD参照時のみ使う生のフィールド値
  // (record[offsetFieldCode].valueの文字列、未設定時はundefined)から、加減算する数値を解決する。
  // 数値として解決できない場合はnull(呼び出し側でそのルールをスキップする合図)を返す。
  const resolveOffsetMagnitude = (rule, offsetFieldRawValue) => {
    if (rule.offsetSource === 'FIXED') {
      return Number.isFinite(rule.fixedValue) ? rule.fixedValue : null;
    }
    if (rule.offsetSource === 'FIELD') {
      if (isEmpty(offsetFieldRawValue)) {
        return null;
      }
      const parsed = parseFloat(offsetFieldRawValue);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const pad2 = (n) => String(n).padStart(2, '0');

  // "YYYY-MM-DD" -> Date.UTC()のタイムスタンプ。DATE型はタイムゾーンを持たない暦日のため、
  // ローカルタイムゾーンを一切介在させずUTC演算に統一する(idea.md参照、DSTの影響を受けない)。
  const parseDateAsUtc = (dateValue) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue || '');
    if (!match) {
      return null;
    }
    const [, year, month, day] = match.map(Number);
    return Date.UTC(year, month - 1, day);
  };

  const formatUtcDate = (timestamp) => {
    const d = new Date(timestamp);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  };

  // UTC ISO8601からミリ秒部分を取り除く(age_grade_field_updateのformatDatetimeと同じ手法)。
  const formatUtcDatetime = (timestamp) =>
    new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');

  // 基準フィールドの値・型・オフセット(数値)・単位から、出力先フィールドへ書き込む値を計算する。
  // 基準値が空、またはmagnitudeがnull(=オフセットが解決できなかった)の場合はnullを返す
  // (呼び出し側はそのルールをスキップし、出力先フィールドを変更しない)。
  const applyOffset = (baseValue, baseFieldType, magnitude, unit) => {
    if (isEmpty(baseValue) || magnitude === null || magnitude === undefined) {
      return null;
    }
    const offsetMs =
      unit === 'SECONDS' ? magnitude * MS_PER_SECOND : magnitude * MS_PER_DAY;

    if (baseFieldType === 'DATE') {
      const baseTimestamp = parseDateAsUtc(baseValue);
      if (baseTimestamp === null || Number.isNaN(baseTimestamp)) {
        return null;
      }
      const result = baseTimestamp + offsetMs;
      return Number.isNaN(result) ? null : formatUtcDate(result);
    }

    if (baseFieldType === 'DATETIME') {
      const baseTimestamp = new Date(baseValue).getTime();
      if (Number.isNaN(baseTimestamp)) {
        return null;
      }
      const result = baseTimestamp + offsetMs;
      return Number.isNaN(result) ? null : formatUtcDatetime(result);
    }

    return null;
  };

  // resolveOffsetMagnitude + applyOffset を組み合わせた、desktop.js/mobile.jsから呼ぶ唯一の入口。
  const computeTargetValue = (
    rule,
    baseValue,
    baseFieldType,
    offsetFieldRawValue,
  ) => {
    const magnitude = resolveOffsetMagnitude(rule, offsetFieldRawValue);
    if (magnitude === null) {
      return null;
    }
    return applyOffset(baseValue, baseFieldType, magnitude, rule.unit);
  };

  const OffsetCalculator = {
    resolveOffsetMagnitude,
    applyOffset,
    computeTargetValue,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OffsetCalculator;
  } else {
    root.DateOffsetAutofill = root.DateOffsetAutofill || {};
    root.DateOffsetAutofill.OffsetCalculator = OffsetCalculator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
