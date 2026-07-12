(function (root) {
  'use strict';

  // 一覧画面からの一括実行で、対象レコードをレコードカーソルAPIで列挙するための
  // orchestrationロジック。実際のAPI呼び出しは依存性注入(deps)にして、
  // kintoneに依存しない形でテストできるようにしている(related_record_summaryの
  // js/lib/cursor-enumerator.jsと同じ設計)。
  //
  // deps:
  //   - createCursor(): Promise<{ id, totalCount }>  … POST /k/v1/records/cursor.json
  //   - getCursor(id): Promise<{ records, next }>     … GET  /k/v1/records/cursor.json
  //   - deleteCursor(id): Promise<void>               … DELETE /k/v1/records/cursor.json (中断時のみ)
  //
  // 注意点:
  //   1. 同時に作成できるカーソルは1ドメイン10個まで。
  //   2. カーソルの有効期限は最終アクセスから10分、作成自体も5分でタイムアウト。
  //   3. next:true でも次のレスポンスの records が空のことがある
  //      → ループの継続条件は records.length ではなく next で判定する。
  //   4. 全件取得完了でカーソルは自動削除されるが、途中で例外が起きた場合は
  //      DELETE /k/v1/records/cursor.json で明示的に削除する(このモジュールが担当)。

  const enumerateAll = async (deps) => {
    const { id, totalCount } = await deps.createCursor();
    const records = [];
    try {
      for (;;) {
        const page = await deps.getCursor(id);
        if (page.records && page.records.length > 0) {
          records.push(...page.records);
        }
        if (!page.next) {
          break;
        }
      }
    } catch (err) {
      if (typeof deps.deleteCursor === 'function') {
        await deps.deleteCursor(id).catch(() => {});
      }
      throw err;
    }
    return { records, totalCount };
  };

  const CursorEnumerator = { enumerateAll };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CursorEnumerator;
  } else {
    root.TimeBandAggregator = root.TimeBandAggregator || {};
    root.TimeBandAggregator.CursorEnumerator = CursorEnumerator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
