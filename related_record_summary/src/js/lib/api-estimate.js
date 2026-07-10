(function (root) {
  'use strict';

  // 一括集計実行前に kintone.showConfirmDialog() の本文へ表示する、API実行回数の見積もりを組み立てる。
  // 計算式(確定・plugin_idea_plan.md「4. 関連レコード集計プラグイン」より):
  //   参照先アプリへの取得API回数 = ceil(対象レコード数 × 関連フィールド数 ÷ 500)
  //   自アプリへの書き戻しAPI回数 = ceil(対象レコード数 ÷ 100)
  //   合計 = 取得API回数 + 書き戻しAPI回数
  //
  // GET_PAGE_SIZE(500)・WRITE_BATCH_SIZE(100)はkintone REST APIの1リクエストあたりの上限
  // (共通の前提・訂正事項を参照)。

  const GET_PAGE_SIZE = 500;
  const WRITE_BATCH_SIZE = 100;

  const divideCeil = (numerator, denominator) => {
    if (numerator <= 0) {
      return 0;
    }
    return Math.ceil(numerator / denominator);
  };

  const compute = (targetRecordCount, relatedFieldCount) => {
    const readCalls = divideCeil(
      targetRecordCount * relatedFieldCount,
      GET_PAGE_SIZE,
    );
    const writeCalls = divideCeil(targetRecordCount, WRITE_BATCH_SIZE);
    return { readCalls, writeCalls, totalCalls: readCalls + writeCalls };
  };

  // 確認ダイアログの本文(kintone.showConfirmDialog()のconfig.bodyは文字列のみ)として使う
  // テキストを組み立てる。
  const buildMessage = (targetRecordCount, relatedFieldCount) => {
    const { readCalls, writeCalls, totalCalls } = compute(
      targetRecordCount,
      relatedFieldCount,
    );
    return (
      `対象レコード数: ${targetRecordCount}件 / 集計設定数: ${relatedFieldCount}件\n` +
      `参照先アプリへの取得API回数(見積り): ${targetRecordCount} × ${relatedFieldCount} ÷ ${GET_PAGE_SIZE} 件 → 約${readCalls}回\n` +
      `書き戻しAPI回数(見積り): ${targetRecordCount} ÷ ${WRITE_BATCH_SIZE} 件 → 約${writeCalls}回\n` +
      `合計API実行回数(見積り): 約${totalCalls}回\n\n` +
      `この内容で一括集計を実行しますか？`
    );
  };

  const ApiEstimate = {
    GET_PAGE_SIZE,
    WRITE_BATCH_SIZE,
    compute,
    buildMessage,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiEstimate;
  } else {
    root.RelatedRecordSummary = root.RelatedRecordSummary || {};
    root.RelatedRecordSummary.ApiEstimate = ApiEstimate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
