(function (root) {
  'use strict';

  const TreeBuilder =
    typeof module !== 'undefined' && module.exports
      ? require('./tree-builder')
      : root.HierarchyView.TreeBuilder;

  const findRecordByMatchValue = (list, matchFieldCode, value) =>
    list.find((r) => TreeBuilder.getFieldValue(r, matchFieldCode) === value);

  // レコード配列+移動するレコード+移動先の新しい親の値から、その移動が循環参照を生むかどうかを
  // 判定する。移動先の祖先をたどり、移動するレコード自身が現れれば循環になる
  // (idea.mdの「循環参照の防止」参照)。既存データに循環がある場合も訪問済み集合でフリーズを防ぐ。
  const wouldCreateCycle = (
    records,
    movingValue,
    newParentValue,
    parentFieldCode,
    matchFieldCode,
  ) => {
    if (movingValue === newParentValue) {
      return true;
    }
    if (newParentValue === undefined || newParentValue === '') {
      return false;
    }

    const list = Array.isArray(records) ? records : [];
    const visited = new Set();
    let current = newParentValue;

    while (current !== undefined && current !== '' && !visited.has(current)) {
      if (current === movingValue) {
        return true;
      }
      visited.add(current);
      const currentRecord = findRecordByMatchValue(
        list,
        matchFieldCode,
        current,
      );
      current = currentRecord
        ? TreeBuilder.getFieldValue(currentRecord, parentFieldCode)
        : undefined;
    }

    return false;
  };

  const CycleCheck = { wouldCreateCycle };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CycleCheck;
  } else {
    root.HierarchyView = root.HierarchyView || {};
    root.HierarchyView.CycleCheck = CycleCheck;
  }
})(typeof window !== 'undefined' ? window : globalThis);
