(function (root) {
  'use strict';

  // 一覧画面からの一括集計で、対象レコードをレコードカーソルAPIで列挙するための
  // orchestrationロジック。実際のAPI呼び出しは依存性注入(deps)にして、
  // kintoneに依存しない形でテストできるようにしている。
  //
  // deps:
  //   - createCursor(): Promise<{ id, totalCount }>  … POST /k/v1/records/cursor.json
  //   - getCursor(id): Promise<{ records, next }>     … GET  /k/v1/records/cursor.json
  //   - deleteCursor(id): Promise<void>               … DELETE /k/v1/records/cursor.json (中断時のみ)
  //
  // 注意点(plugin_idea_plan.md「共通の前提・訂正事項」より、必ず守ること):
  //   1. 同時に作成できるカーソルは1ドメイン10個まで。
  //   2. カーソルの有効期限は最終アクセスから10分、作成自体も5分でタイムアウト。
  //   3. next:true でも次のレスポンスの records が空のことがある
  //      → ループの継続条件は records.length ではなく next で判定する。
  //   4. like/not like を含む条件は10万件で打ち切られ X-Cybozu-Warning ヘッダーが付く。
  //   5. 全件取得完了でカーソルは自動削除されるが、途中で例外が起きた場合は
  //      DELETE /k/v1/records/cursor.json で明示的に削除する(このモジュールが担当)。

  // カーソルを作成し、next が false になるまで records を集めて全件返す。
  // 途中で例外が発生した場合は deleteCursor() を試みてから例外を再スローする
  // (deleteCursor自体の失敗はもみ消し、元の例外を優先する)。
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
    root.RelatedRecordSummary = root.RelatedRecordSummary || {};
    root.RelatedRecordSummary.CursorEnumerator = CursorEnumerator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
