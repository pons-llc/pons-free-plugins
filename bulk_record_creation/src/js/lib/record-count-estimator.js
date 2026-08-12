(function (root) {
  'use strict';

  // 対象者数×日付数から生成レコード数を見積もり、上限を超えないか判定する(純粋関数)。
  // idea.md「生成されるレコード数(直積)」参照。secureCodingGuideline「短時間で大量の
  // リクエスト送信を避ける」を踏まえ、実行不可にする安全弁としてのハードコード上限。
  const DEFAULT_MAX_RECORDS = 500;

  // estimateRecordCount({ assigneeCount, dateCount, limit }) => { count, withinLimit, limit }
  // assigneeCount/dateCountを省略した場合は、その次元が存在しない(1件のプレースホルダー、
  // record-payload-builder.jsのNO_DIMENSIONに対応)ものとして1を使う。
  const estimateRecordCount = ({ assigneeCount, dateCount, limit } = {}) => {
    const resolvedLimit =
      typeof limit === 'number' ? limit : DEFAULT_MAX_RECORDS;
    const assignees = typeof assigneeCount === 'number' ? assigneeCount : 1;
    const dates = typeof dateCount === 'number' ? dateCount : 1;
    const count = assignees * dates;
    return { count, withinLimit: count <= resolvedLimit, limit: resolvedLimit };
  };

  const RecordCountEstimator = { estimateRecordCount, DEFAULT_MAX_RECORDS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordCountEstimator;
  } else {
    root.BulkRecordCreation = root.BulkRecordCreation || {};
    root.BulkRecordCreation.RecordCountEstimator = RecordCountEstimator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
