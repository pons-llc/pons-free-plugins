(function (root) {
  'use strict';

  // 時間帯集計項目自動作成プラグインの中核ロジック(kintoneに依存しない純粋関数)。
  // 区切り幅は1440分(24時間)を割り切れる値のみサポートする(最後の時間帯が必ず24:00で
  // きれいに終わるようにするため)。
  const BAND_WIDTH_OPTIONS = [15, 30, 60, 120, 180, 240, 360, 720];

  const pad2 = (n) => String(n).padStart(2, '0');

  // 0分〜1440分の範囲を"HH:MM"形式にする。1440は翌日0時を表すため"24:00"と表記する。
  const minutesToClock = (minutes) => {
    if (minutes >= 1440) {
      return '24:00';
    }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${pad2(h)}:${pad2(m)}`;
  };

  const formatBandLabel = (bandStart, bandWidthMinutes) =>
    `${minutesToClock(bandStart)}〜${minutesToClock(bandStart + bandWidthMinutes)}`;

  // 指定した区切り幅で1日(0〜1440分)をすべての時間帯に分割する。
  const generateBands = (bandWidthMinutes) => {
    const bands = [];
    for (let start = 0; start < 1440; start += bandWidthMinutes) {
      bands.push({ start, label: formatBandLabel(start, bandWidthMinutes) });
    }
    return bands;
  };

  // TIME型フィールドの値("HH:MM"、タイムゾーンを持たない時刻文字列)を
  // 0時からの経過分数に変換する(タイムゾーン変換は不要)。
  const parseTimeValueToMinutes = (value) => {
    if (typeof value !== 'string' || value === '') {
      return null;
    }
    const m = /^(\d{1,2}):(\d{2})/.exec(value);
    if (!m) {
      return null;
    }
    const hours = Number(m[1]);
    const minutes = Number(m[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    return hours * 60 + minutes;
  };

  // DATETIME型フィールドの値(UTCのISO8601文字列)を、指定したIANAタイムゾーンでの
  // 0時からの経過分数に変換する。実行ユーザーのタイムゾーン(kintone.getLoginUser().timezone)を
  // 渡すことで、ユーザーごとに算出される時間帯が変わる(idea.md「時間帯の算出方法」参照)。
  const parseDateTimeValueToMinutes = (value, timeZone) => {
    if (typeof value !== 'string' || value === '') {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour');
    const minutePart = parts.find((p) => p.type === 'minute');
    if (!hourPart || !minutePart) {
      return null;
    }
    // hourCycle: 'h23' でも一部環境で"24"を返すことがあるため%24で正規化する。
    const hours = Number(hourPart.value) % 24;
    const minutes = Number(minutePart.value);
    return hours * 60 + minutes;
  };

  const computeBandStart = (minutesOfDay, bandWidthMinutes) =>
    Math.floor(minutesOfDay / bandWidthMinutes) * bandWidthMinutes;

  // メインエントリー: 変換元フィールドの値・型・区切り幅・タイムゾーンから、
  // ドロップダウンへ書き込むラベル文字列と、数値フィールドへ書き込む数値(時間帯開始分、0〜1439)を
  // 算出する。値が空・不正な場合はnullを返す(呼び出し側で出力先を空にする)。
  const computeTimeBand = ({
    value,
    fieldType,
    bandWidthMinutes,
    timeZone,
  }) => {
    let minutesOfDay = null;
    if (fieldType === 'TIME') {
      minutesOfDay = parseTimeValueToMinutes(value);
    } else if (fieldType === 'DATETIME') {
      minutesOfDay = parseDateTimeValueToMinutes(value, timeZone);
    }
    if (minutesOfDay === null) {
      return null;
    }
    const bandStart = computeBandStart(minutesOfDay, bandWidthMinutes);
    return {
      label: formatBandLabel(bandStart, bandWidthMinutes),
      number: bandStart,
    };
  };

  const TimeBand = {
    BAND_WIDTH_OPTIONS,
    minutesToClock,
    formatBandLabel,
    generateBands,
    parseTimeValueToMinutes,
    parseDateTimeValueToMinutes,
    computeBandStart,
    computeTimeBand,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeBand;
  } else {
    root.TimeBandAggregator = root.TimeBandAggregator || {};
    root.TimeBandAggregator.TimeBand = TimeBand;
  }
})(typeof window !== 'undefined' ? window : globalThis);
