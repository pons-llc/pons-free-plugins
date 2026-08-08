(function (root) {
  'use strict';

  // 確認ダイアログ(PC: kintone.createDialog / モバイル: kintone.mobile.createBottomSheet、
  // いずれもconfig.bodyはElement)の本文のうち、テキストで表す部分(対象件数・絞り込み条件)を
  // 組み立てる純粋関数。idea.md「確認ダイアログ・実行」参照。書き込む値は、対象フィールドごとに
  // 都度入力する編集可能な入力欄として別途ダイアログに配置するため、ここでは含めない。
  // 一覧画面の現在の絞り込み条件(クエリ)をそのまま表示し、実行前に対象範囲を確認できるように
  // する(ユーザーからの要望: 更新前にダイアログでクエリを確認できるように)。
  const buildConfirmMessage = ({ targetCount, query }) =>
    `対象レコード数: ${targetCount}件\n` +
    `絞り込み条件: ${query ? query : '(絞り込みなし・全レコード)'}`;

  const BuildConfirmMessage = { buildConfirmMessage };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BuildConfirmMessage;
  } else {
    root.BulkFieldUpdate = root.BulkFieldUpdate || {};
    root.BulkFieldUpdate.BuildConfirmMessage = BuildConfirmMessage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
