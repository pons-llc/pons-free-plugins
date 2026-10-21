(() => {
  'use strict';

  // PC(desktop.js)・モバイル(mobile.js)共通の「完了」アクション時の反映処理。
  // 画面固有の部分(変更内容の確認・ローディング表示・エラーの出し方)だけを呼び出し側から受け取る。
  const NS = window.AppSettingsRequest;
  const { CODES } = NS.FieldDefs;

  // DATETIMEフィールドの値はUTCのISO 8601(秒まで)。
  const nowForDatetime = () =>
    new Date().toISOString().replace(/\.[0-9]{3}Z$/, 'Z');

  // 結果: { ok: true, event } / { ok: false, error } / { ok: false, cancelled: true }(確認でキャンセル)。
  // confirm(change)は、ユーザーが反映を了承したらtrueに解決されるPromiseを返す。
  NS.handleCompletingAction = async ({
    event,
    ownAppId,
    confirm,
    showLoading,
  }) => {
    const parsed = NS.ChangeRequest.parseChange(
      event.record[CODES.changeJson]
        ? event.record[CODES.changeJson].value
        : '',
    );
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    // ダイアログはユーザーが閉じるまで解決されないため、ローディングは確認の後に表示する
    // (同じtry/finallyで囲むとオーバーレイでダイアログを閉じられなくなる。CLAUDE.mdの既知の落とし穴)。
    if (!(await confirm(parsed.change))) {
      return { ok: false, cancelled: true };
    }
    let result;
    showLoading(true);
    try {
      result = await NS.ApplyRunner.runApply({
        api: (path, method, body) => kintone.api(path, method, body),
        selfPath: (path) => kintone.api.url(path, true),
        wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        record: event.record,
        ownAppId,
        recordId: event.record.$id.value,
      });
    } catch (err) {
      result = {
        ok: false,
        error: `反映中にエラーが発生しました: ${NS.ApiPath.describeApiError(err)}`,
      };
    } finally {
      showLoading(false);
    }
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    // フィールドの値の書き換えはproceedイベントで可能(レコードの編集権限が必要。ドキュメントで確認済み)。
    if (event.record[CODES.result]) {
      event.record[CODES.result].value = result.message;
    }
    if (event.record[CODES.appliedAt]) {
      event.record[CODES.appliedAt].value = nowForDatetime();
    }
    return { ok: true, event };
  };
})();
