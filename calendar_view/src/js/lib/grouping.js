(function (root) {
  'use strict';

  // 日表示で使うグループ軸を組み立てる。グループ分けフィールド未設定時は単一グループ
  // 「すべて」として扱う(idea.md「グループ未設定の場合は単一グループとして扱う」)。

  const GROUPABLE_FIELD_TYPES = [
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
    'DROP_DOWN',
    'RADIO_BUTTON',
    'STATUS',
  ];

  // ドラッグ&ドロップでグループ軸の移動をレコード更新に反映できるフィールド型
  // (ステータスは更新APIで直接変更できないため対象外。idea.md参照)。
  const GROUP_FIELD_DRAG_UPDATABLE_TYPES = [
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
    'DROP_DOWN',
    'RADIO_BUTTON',
  ];

  const isGroupableField = (field) =>
    Boolean(field && GROUPABLE_FIELD_TYPES.includes(field.type));

  const isGroupDragUpdatable = (field) =>
    Boolean(field && GROUP_FIELD_DRAG_UPDATABLE_TYPES.includes(field.type));

  const buildDayGroups = (events) => {
    const map = new Map();
    events.forEach((evt) => {
      const key = evt.groupKey || '';
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: key === '' ? '(未設定)' : evt.groupLabel,
          events: [],
        });
      }
      map.get(key).events.push(evt);
    });
    if (map.size === 0) {
      return [{ key: '', label: 'すべて', events: [] }];
    }
    // 未設定グループは末尾に固定し、それ以外はラベルの辞書順。
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === '') return 1;
      if (b.key === '') return -1;
      return a.label.localeCompare(b.label, 'ja');
    });
  };

  const Grouping = {
    GROUPABLE_FIELD_TYPES,
    GROUP_FIELD_DRAG_UPDATABLE_TYPES,
    isGroupableField,
    isGroupDragUpdatable,
    buildDayGroups,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Grouping;
  } else {
    root.CalendarView = root.CalendarView || {};
    root.CalendarView.Grouping = Grouping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
