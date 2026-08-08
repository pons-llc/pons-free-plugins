(function (root) {
  'use strict';

  // 確認ダイアログ(PC: kintone.createDialog / モバイル: kintone.mobile.createBottomSheet、
  // いずれもconfig.bodyはElement)の本文のうち、テキストで表す部分を組み立てる純粋関数。
  // 書き込む値そのものは編集可能な入力欄として別途ダイアログに配置するため、ここでは含めない
  // (idea.md「確認ダイアログ・実行」参照)。
  const buildConfirmMessage = ({ targetCount, fieldLabel }) =>
    `対象レコード数: ${targetCount}件\n` +
    `書き込み先フィールド: ${fieldLabel}\n\n` +
    `書き込む値(必要に応じて変更できます):`;

  const BuildConfirmMessage = { buildConfirmMessage };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BuildConfirmMessage;
  } else {
    root.AgeGradeFieldUpdate = root.AgeGradeFieldUpdate || {};
    root.AgeGradeFieldUpdate.BuildConfirmMessage = BuildConfirmMessage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
