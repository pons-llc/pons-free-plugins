(function (root) {
  'use strict';

  const MS_PER_DAY = 86400000;
  const MS_PER_MINUTE = 60000;

  const isEmpty = (v) => v === undefined || v === null || v === '';
  const pad2 = (n) => String(n).padStart(2, '0');

  const formatUtcDate = (timestamp) => {
    const d = new Date(timestamp);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  };

  // UTC ISO8601からミリ秒部分を取り除く(date_offset_autofillのformatUtcDatetimeと同じ手法)。
  const formatUtcDatetime = (timestamp) =>
    new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');

  const toOffsetMs = (magnitude, unit) =>
    unit === 'MINUTES' ? magnitude * MS_PER_MINUTE : magnitude * MS_PER_DAY;

  // 「瞬間(絶対時刻)」を基準にオフセットを計算する。実行時点(NOW)・作成日時・更新日時は
  // いずれも「ある瞬間」を表すため、この関数で統一的に扱う。
  //
  // - 対象がDATE型の場合: 「実行時点」「作成日時」はカレンダー上の「その日」を指す概念のため、
  //   絶対時刻(UTCエポック)をそのまま使うとタイムゾーンによって日付がずれる(例: JST 00:30は
  //   UTCでは前日15:30)。ブラウザのローカルタイムゾーンでの年月日を基準にする
  //   (age_grade_field_update/current-value-formatter.jsのformatDateと同じ理由)。基準日が
  //   決まったあとの加減算自体は、DATE型そのものがタイムゾーンを持たない暦日であることに
  //   合わせてDate.UTC()によるUTC演算にする(DSTの影響を受けない)。
  // - 対象がDATETIME型の場合: 絶対時刻(瞬間)なのでタイムゾーンの概念自体が無く、基準の瞬間
  //   (エポックミリ秒)へそのままオフセットを加算すればよい。
  const computeInstantOffsetValue = (
    instantMs,
    targetFieldType,
    magnitude,
    unit,
  ) => {
    if (!Number.isFinite(magnitude) || !Number.isFinite(instantMs)) {
      return null;
    }
    const offsetMs = toOffsetMs(magnitude, unit);

    if (targetFieldType === 'DATE') {
      const instant = new Date(instantMs);
      const baseTimestamp = Date.UTC(
        instant.getFullYear(),
        instant.getMonth(),
        instant.getDate(),
      );
      const result = baseTimestamp + offsetMs;
      return Number.isNaN(result) ? null : formatUtcDate(result);
    }

    if (targetFieldType === 'DATETIME') {
      const result = instantMs + offsetMs;
      return Number.isNaN(result) ? null : formatUtcDatetime(result);
    }

    return null;
  };

  // "YYYY-MM-DD" -> Date.UTC()のタイムスタンプ。DATE型はタイムゾーンを持たない暦日のため、
  // ローカルタイムゾーンを一切介在させずUTC演算に統一する(date_offset_autofillと同じ手法)。
  const parseDateAsUtc = (dateValue) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue || '');
    if (!match) {
      return null;
    }
    const [, year, month, day] = match.map(Number);
    return Date.UTC(year, month - 1, day);
  };

  // 「DATE/DATETIME型フィールドの値そのもの」を基準にオフセットを計算する(特定フィールド参照
  // ソースで使う)。baseFieldTypeとtargetFieldTypeは常に一致する前提(設定画面のバリデーションで
  // 強制、DATE→DATETIMEやその逆はタイムゾーンの扱いが曖昧になるため対象外)。
  // baseFieldTypeがDATEならタイムゾーンなしの暦日としてUTC演算、DATETIMEなら絶対時刻として
  // そのまま加減算する(date_offset_autofillのapplyOffsetと同じ手法)。
  const computeFieldOffsetValue = (
    baseValue,
    baseFieldType,
    magnitude,
    unit,
  ) => {
    if (isEmpty(baseValue) || !Number.isFinite(magnitude)) {
      return null;
    }
    const offsetMs = toOffsetMs(magnitude, unit);

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

  const DateOffsetCalculator = {
    computeInstantOffsetValue,
    computeFieldOffsetValue,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DateOffsetCalculator;
  } else {
    root.ProcessActionAutofill = root.ProcessActionAutofill || {};
    root.ProcessActionAutofill.DateOffsetCalculator = DateOffsetCalculator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
