(function (root) {
  'use strict';

  // 一括ダウンロードの実行可否を、対象レコード件数と設定された上限件数から判定する純粋関数。
  // 実際のレコード件数取得(REST API)はグルーコード側の責務で、ここでは判定ロジックのみを扱う。

  const checkBulkLimit = (targetCount, limit) => {
    const base = { targetCount, limit };

    if (!Number.isInteger(targetCount) || targetCount < 0) {
      return {
        ...base,
        allowed: false,
        exceeded: false,
        message: '対象件数が不正です。',
      };
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      return {
        ...base,
        allowed: false,
        exceeded: false,
        message: '一括ダウンロードの上限件数が設定されていません。',
      };
    }
    if (targetCount === 0) {
      return {
        ...base,
        allowed: false,
        exceeded: false,
        message: 'ダウンロード対象のレコードがありません。',
      };
    }
    if (targetCount > limit) {
      return {
        ...base,
        allowed: false,
        exceeded: true,
        message: `対象レコード数(${targetCount}件)が一括ダウンロードの上限(${limit}件)を超えています。絞り込み条件を見直してください。`,
      };
    }
    return { ...base, allowed: true, exceeded: false, message: null };
  };

  const BulkLimit = { checkBulkLimit };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BulkLimit;
  } else {
    root.ExcelReportExport = root.ExcelReportExport || {};
    root.ExcelReportExport.BulkLimit = BulkLimit;
  }
})(typeof window !== 'undefined' ? window : globalThis);
