(function (root) {
  'use strict';

  // レコードの値(kintone.app.record.get()の.record、またはapp.record.detail.showイベントの
  // event.record)から、作成者(CREATOR型)フィールドの名前を探す。作成者フィールドのフィールド
  // コードはアプリごとに変更されうるため決め打ちせず、値の中からtypeで探す(idea.md参照)。
  const FALLBACK_NAME = '(作成者不明)';

  const findCreatorName = (record) => {
    if (!record) {
      return FALLBACK_NAME;
    }
    const creatorField = Object.values(record).find(
      (field) => field && field.type === 'CREATOR',
    );
    if (!creatorField || !creatorField.value || !creatorField.value.name) {
      return FALLBACK_NAME;
    }
    return creatorField.value.name;
  };

  const FindCreatorName = { findCreatorName, FALLBACK_NAME };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FindCreatorName;
  } else {
    root.GenaiAppShare = root.GenaiAppShare || {};
    root.GenaiAppShare.FindCreatorName = FindCreatorName;
  }
})(typeof window !== 'undefined' ? window : globalThis);
