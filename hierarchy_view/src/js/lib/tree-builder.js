(function (root) {
  'use strict';

  // フラットなレコード配列+親子フィールドの設定から、階層構造(ルートノードの配列、各ノードは
  // { record, children })を組み立てる。kintoneに依存しない純粋関数。

  // '$id'はkintoneのシステム項目(レコード番号相当)を指す特別なコードとして扱う
  // (idea.mdの「照合対象フィールド」参照)。
  const getFieldValue = (record, code) => {
    if (!record) {
      return undefined;
    }
    if (code === '$id') {
      return record.$id ? record.$id.value : undefined;
    }
    const field = record[code];
    return field ? field.value : undefined;
  };

  const ROOT_KEY = null;

  const buildTree = (records, parentFieldCode, matchFieldCode) => {
    const list = Array.isArray(records) ? records : [];

    const matchMap = new Map();
    list.forEach((r) => {
      const key = getFieldValue(r, matchFieldCode);
      if (key !== undefined && key !== '' && !matchMap.has(key)) {
        matchMap.set(key, r);
      }
    });

    const childrenMap = new Map();
    const addChild = (key, record) => {
      if (!childrenMap.has(key)) {
        childrenMap.set(key, []);
      }
      childrenMap.get(key).push(record);
    };

    list.forEach((r) => {
      const parentValue = getFieldValue(r, parentFieldCode);
      const selfValue = getFieldValue(r, matchFieldCode);
      // 親の値が空/存在しない/自分自身を指している場合はルート扱いにする
      // (idea.mdの「親フィールドの値が誰とも一致しない場合」「自分自身を指す場合」参照)。
      const isValidParent =
        parentValue !== undefined &&
        parentValue !== '' &&
        matchMap.has(parentValue) &&
        parentValue !== selfValue;
      addChild(isValidParent ? parentValue : ROOT_KEY, r);
    });

    const visited = new Set();
    const buildNode = (record) => {
      const selfValue = getFieldValue(record, matchFieldCode);
      visited.add(selfValue);
      const childRecords = childrenMap.get(selfValue) || [];
      const children = childRecords
        .filter((child) => !visited.has(getFieldValue(child, matchFieldCode)))
        .map((child) => buildNode(child));
      return { record, children };
    };

    const nodes = (childrenMap.get(ROOT_KEY) || []).map((r) => buildNode(r));

    // 循環参照などでルートから到達できなかったレコードも、ルート扱いで追加する
    // (判断記録.mdの2番、ツリー構築時にレコードが失われないようにする)。
    list.forEach((r) => {
      const key = getFieldValue(r, matchFieldCode);
      if (!visited.has(key)) {
        nodes.push(buildNode(r));
      }
    });

    return nodes;
  };

  const TreeBuilder = { getFieldValue, buildTree };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TreeBuilder;
  } else {
    root.HierarchyView = root.HierarchyView || {};
    root.HierarchyView.TreeBuilder = TreeBuilder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
