(function (global, kintone) {
  'use strict';

  const NS = global.ConfirmModal;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 対象イベントの内部名(idea.mdの表)とモバイルのイベントタイプの対応。
  // INDEX_DELETE_SUBMIT(レコード一覧からの削除)はkintoneドキュメントMCPで確認した通りモバイル版の
  // イベントが存在しない(レコード一覧画面自体、モバイルでは行選択からの一括削除のみで個別削除の
  // 確認イベントがない)ため、モバイル側では対象外(idea.mdの「モバイル対応」参照)。
  const EVENT_TYPES = {
    CREATE_SUBMIT: 'mobile.app.record.create.submit',
    EDIT_SUBMIT: 'mobile.app.record.edit.submit',
    PROCESS_PROCEED: 'mobile.app.record.detail.process.proceed',
  };

  // PROCESS_PROCEEDイベントのみ{action}/{nextStatus}のプレースホルダーに値を持つ
  // (idea.mdの「プロセス管理アクションのプレースホルダー」参照)。他のイベントは空のコンテキストで
  // renderTemplateを呼んでも、プレースホルダーを含まない本文はそのまま返るだけなので安全。
  const buildContext = (event) => ({
    action: event.action ? event.action.value : '',
    nextStatus: event.nextStatus ? event.nextStatus.value : '',
  });

  // ルールに従って確認ボトムシートを表示し、ユーザーがOK以外を選んだ場合は false を返す
  // (呼び出し元でそのままreturnすれば処理がキャンセルされる)。
  // kintone.mobile.showConfirmBottomSheet()はkintone.showConfirmDialog()(desktop.js)と
  // 引数・戻り値の形が同じであることをkintoneドキュメントMCPで確認済み。
  const confirmOrCancel = async (triggerEvent, event) => {
    const rule = NS.RuleLookup.findRule(config.rules, triggerEvent);
    // ルールが設定されていない対象イベントでは、確認せずそのまま処理を続行する。
    if (!rule) {
      return true;
    }

    const context = buildContext(event);
    const result = await kintone.mobile.showConfirmBottomSheet({
      title: NS.Template.renderTemplate(rule.title, context),
      body: NS.Template.renderTemplate(rule.body, context),
      showOkButton: true,
      okButtonText: rule.okButtonText || undefined,
      showCancelButton: true,
      cancelButtonText: rule.cancelButtonText || undefined,
      showCloseButton: true,
    });

    return result === 'OK';
  };

  kintone.events.on(EVENT_TYPES.CREATE_SUBMIT, async (event) => {
    const proceed = await confirmOrCancel('CREATE_SUBMIT', event);
    return proceed ? event : false;
  });

  kintone.events.on(EVENT_TYPES.EDIT_SUBMIT, async (event) => {
    const proceed = await confirmOrCancel('EDIT_SUBMIT', event);
    return proceed ? event : false;
  });

  kintone.events.on(EVENT_TYPES.PROCESS_PROCEED, async (event) => {
    const proceed = await confirmOrCancel('PROCESS_PROCEED', event);
    return proceed ? event : false;
  });
})(window, kintone);
