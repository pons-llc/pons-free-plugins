(function (root) {
  'use strict';

  // 一括実行前に kintone.showConfirmDialog() の本文へ表示する、API実行回数の見積もりを組み立てる。
  // 対象アプリ内で完結する処理(他アプリへの問い合わせがない)ため、related_record_summaryの
  // api-estimate.jsと異なり集計設定数は計算に含めない。
  //   レコード取得API回数(見積り) = ceil(対象レコード数 ÷ 500)   … レコードカーソルAPI1ページの上限
  //   書き戻しAPI回数(見積り)     = ceil(対象レコード数 ÷ 100)   … PUT /k/v1/records.json 1回の上限
  const CURSOR_PAGE_SIZE = 500;
  const WRITE_BATCH_SIZE = 100;

  const divideCeil = (numerator, denominator) => {
    if (numerator <= 0) {
      return 0;
    }
    return Math.ceil(numerator / denominator);
  };

  const compute = (targetRecordCount) => {
    const readCalls = divideCeil(targetRecordCount, CURSOR_PAGE_SIZE);
    const writeCalls = divideCeil(targetRecordCount, WRITE_BATCH_SIZE);
    return { readCalls, writeCalls, totalCalls: readCalls + writeCalls };
  };

  const buildMessage = (targetRecordCount) => {
    const { readCalls, writeCalls, totalCalls } = compute(targetRecordCount);
    return (
      `対象レコード数: ${targetRecordCount}件\n` +
      `レコード取得API回数(見積り、レコードカーソルAPI): 約${readCalls}回\n` +
      `書き戻しAPI回数(見積り): 約${writeCalls}回\n` +
      `合計API実行回数(見積り): 約${totalCalls}回\n\n` +
      `この内容で一括実行しますか？`
    );
  };

  const ApiEstimate = {
    CURSOR_PAGE_SIZE,
    WRITE_BATCH_SIZE,
    compute,
    buildMessage,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiEstimate;
  } else {
    root.TimeBandAggregator = root.TimeBandAggregator || {};
    root.TimeBandAggregator.ApiEstimate = ApiEstimate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
