(function (root) {
  'use strict';

  const MS_PER_DAY = 86400000;
  const MS_PER_MINUTE = 60000;

  const pad2 = (n) => String(n).padStart(2, '0');

  const formatUtcDate = (timestamp) => {
    const d = new Date(timestamp);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  };

  // UTC ISO8601からミリ秒部分を取り除く(date_offset_autofillのformatUtcDatetimeと同じ手法)。
  const formatUtcDatetime = (timestamp) =>
    new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');

  // 「実行時点(now)」± オフセット(日数/分)から、DATE/DATETIMEフィールドへ書き込む値を計算する。
  // date_offset_autofillのoffset-calculator.jsと異なり、基準値は常に「今」であり、基準フィールド
  // という概念が無い(未入力によるスキップは発生しない。magnitudeが数値でない場合のみnullを返す)。
  //
  // DATE型とDATETIME型で基準の扱いが異なる点に注意:
  // - DATE: 「実行時点」はカレンダー上の「今日」を指す。絶対時刻(UTCエポック)をそのまま使うと、
  //   UTCと異なるタイムゾーンの利用者(日本のJST等)では日付がずれる(例: JST 00:30はUTCでは前日
  //   15:30)ため、ブラウザのローカルタイムゾーンでの年月日を基準にする
  //   (age_grade_field_update/current-value-formatter.jsのformatDateと同じ理由)。基準日が
  //   決まったあとの加減算自体は、DATE型そのものがタイムゾーンを持たない暦日であることに合わせて
  //   date_offset_autofillと同じくDate.UTC()によるUTC演算にする(DSTの影響を受けない)。
  // - DATETIME: 絶対時刻(瞬間)なのでタイムゾーンの概念自体が無く、現在時刻(エポックミリ秒)へ
  //   そのままオフセットを加算すればよい(date_offset_autofillのDATETIME演算と同じ手法)。
  const computeNowOffsetValue = (now, targetFieldType, magnitude, unit) => {
    if (!Number.isFinite(magnitude)) {
      return null;
    }
    const nowDate = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(nowDate.getTime())) {
      return null;
    }

    const offsetMs =
      unit === 'MINUTES' ? magnitude * MS_PER_MINUTE : magnitude * MS_PER_DAY;

    if (targetFieldType === 'DATE') {
      const baseTimestamp = Date.UTC(
        nowDate.getFullYear(),
        nowDate.getMonth(),
        nowDate.getDate(),
      );
      const result = baseTimestamp + offsetMs;
      return Number.isNaN(result) ? null : formatUtcDate(result);
    }

    if (targetFieldType === 'DATETIME') {
      const result = nowDate.getTime() + offsetMs;
      return Number.isNaN(result) ? null : formatUtcDatetime(result);
    }

    return null;
  };

  const NowOffsetCalculator = { computeNowOffsetValue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NowOffsetCalculator;
  } else {
    root.ProcessActionAutofill = root.ProcessActionAutofill || {};
    root.ProcessActionAutofill.NowOffsetCalculator = NowOffsetCalculator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
