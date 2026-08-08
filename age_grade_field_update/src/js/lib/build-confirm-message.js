(function (root) {
  'use strict';

  // 確認ダイアログ(PC: kintone.showConfirmDialog / モバイル: kintone.mobile.showConfirmBottomSheet、
  // いずれもconfig.bodyは文字列のみ)の本文を組み立てる純粋関数。idea.md「確認ダイアログ・実行」参照。
  const buildConfirmMessage = ({ targetCount, fieldLabel, valuePreview }) =>
    `対象レコード数: ${targetCount}件\n` +
    `書き込み先フィールド: ${fieldLabel}\n` +
    `書き込む値: ${valuePreview}\n\n` +
    `この内容で更新を実行しますか？`;

  const BuildConfirmMessage = { buildConfirmMessage };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BuildConfirmMessage;
  } else {
    root.AgeGradeFieldUpdate = root.AgeGradeFieldUpdate || {};
    root.AgeGradeFieldUpdate.BuildConfirmMessage = BuildConfirmMessage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
