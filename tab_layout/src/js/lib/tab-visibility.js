(function (root) {
  'use strict';

  // タブの配列+アクティブなタブのインデックスから、管理対象の各項目(フィールドコード/要素ID)を
  // 表示するかどうかのマップを組み立てる。タブに割り当てられていない項目はプラグインの管理外なので
  // マップに含めない(idea.mdの「表示/非表示のモデル」参照)。kintoneに依存しない純粋関数。
  const computeVisibility = (tabs, activeTabIndex) => {
    const list = Array.isArray(tabs) ? tabs : [];
    const result = {};

    // 先にすべてのタブの項目を非表示として登録しておく(重複登録は上書きしない = 既存の値を優先)。
    list.forEach((tab) => {
      (tab.itemCodes || []).forEach((code) => {
        if (!(code in result)) {
          result[code] = false;
        }
      });
    });

    // アクティブなタブの項目だけを表示に上書きする。同じ項目が他の非アクティブなタブにも属していても、
    // アクティブなタブに含まれていれば表示する(idea.mdの「重複割り当て」参照)。
    const activeTab = list[activeTabIndex];
    (activeTab ? activeTab.itemCodes || [] : []).forEach((code) => {
      result[code] = true;
    });

    return result;
  };

  // 設定された既定タブインデックスが有効な範囲にない場合、先頭のタブ(インデックス0)にフォールバックする。
  const resolveDefaultTabIndex = (tabs, defaultTabIndex) => {
    const list = Array.isArray(tabs) ? tabs : [];
    if (list.length === 0) {
      return 0;
    }
    if (
      Number.isInteger(defaultTabIndex) &&
      defaultTabIndex >= 0 &&
      defaultTabIndex < list.length
    ) {
      return defaultTabIndex;
    }
    return 0;
  };

  const TabVisibility = { computeVisibility, resolveDefaultTabIndex };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabVisibility;
  } else {
    root.TabLayout = root.TabLayout || {};
    root.TabLayout.TabVisibility = TabVisibility;
  }
})(typeof window !== 'undefined' ? window : globalThis);
