(function (root) {
  'use strict';

  const pad = (value, length) => String(value).padStart(length, '0');

  // 実行IDは「いつ実行したか」が目で見て分かる形にする。
  // 同一秒の二重実行でも衝突しないよう末尾に乱数を付ける。
  const createRunId = (date, randomSuffix) => {
    const d = date || new Date();
    const stamp = [
      d.getFullYear(),
      pad(d.getMonth() + 1, 2),
      pad(d.getDate(), 2),
      '-',
      pad(d.getHours(), 2),
      pad(d.getMinutes(), 2),
      pad(d.getSeconds(), 2),
    ].join('');
    const suffix =
      randomSuffix === undefined || randomSuffix === null
        ? Math.random().toString(36).slice(2, 6)
        : String(randomSuffix);
    return `${stamp}-${suffix}`;
  };

  // 実行日時はISO 8601(UTC)で持ち、表示のときだけローカル時刻に直す。
  const toIsoString = (date) => (date || new Date()).toISOString();

  // 画面・サブテーブルに出す「2026-08-18 10:00」形式(ローカル時刻)
  const formatLocal = (isoText) => {
    if (!isoText) {
      return '';
    }
    const d = new Date(isoText);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)} ` +
      `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`
    );
  };

  // 添付するJSONのファイル名。実行IDを含めて重複しないようにする。
  const buildFileName = (runId) => `cross-app-check_${runId || 'run'}.json`;

  const RunId = {
    createRunId,
    toIsoString,
    formatLocal,
    buildFileName,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RunId;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.RunId = RunId;
  }
})(typeof window !== 'undefined' ? window : globalThis);
