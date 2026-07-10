(function (root) {
  'use strict';

  const DEFAULT_CHUNK_SIZE = 100;

  // 保留中の変更(レコードID→新しい親の値のマップ)に1件追加/上書きした新しいオブジェクトを返す
  // (元のオブジェクトは変更しない、idea.mdの「編集モードと保留変更」参照)。
  const setChange = (changes, recordId, newParentValue) =>
    Object.assign({}, changes, { [recordId]: newParentValue });

  const chunk = (items, size) => {
    const chunkSize = size > 0 ? size : DEFAULT_CHUNK_SIZE;
    const result = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      result.push(items.slice(i, i + chunkSize));
    }
    return result;
  };

  // 保留中の変更から、PUT /k/v1/records.json 用のリクエストボディ(100件ずつ分割)を組み立てる。
  const buildUpdateRequestBodies = (
    appId,
    changes,
    parentFieldCode,
    chunkSize = DEFAULT_CHUNK_SIZE,
  ) => {
    const entries = Object.keys(changes || {});
    if (entries.length === 0) {
      return [];
    }
    const records = entries.map((recordId) => ({
      id: recordId,
      record: { [parentFieldCode]: { value: changes[recordId] } },
    }));
    return chunk(records, chunkSize).map((recordsChunk) => ({
      app: appId,
      records: recordsChunk,
    }));
  };

  const PendingChanges = {
    DEFAULT_CHUNK_SIZE,
    setChange,
    buildUpdateRequestBodies,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PendingChanges;
  } else {
    root.HierarchyView = root.HierarchyView || {};
    root.HierarchyView.PendingChanges = PendingChanges;
  }
})(typeof window !== 'undefined' ? window : globalThis);
