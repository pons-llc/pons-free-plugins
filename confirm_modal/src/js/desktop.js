(function (global, kintone) {
  'use strict';

  const NS = global.ConfirmModal;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 対象イベントの内部名(idea.mdの表)とkintoneのイベントタイプの対応。
  const EVENT_TYPES = {
    CREATE_SUBMIT: 'app.record.create.submit',
    EDIT_SUBMIT: 'app.record.edit.submit',
    INDEX_DELETE_SUBMIT: 'app.record.index.delete.submit',
    PROCESS_PROCEED: 'app.record.detail.process.proceed',
  };

  // PROCESS_PROCEEDイベントのみ{action}/{nextStatus}のプレースホルダーに値を持つ
  // (idea.mdの「プロセス管理アクションのプレースホルダー」参照)。他のイベントは空のコンテキストで
  // renderTemplateを呼んでも、プレースホルダーを含まない本文はそのまま返るだけなので安全。
  const buildContext = (event) => ({
    action: event.action ? event.action.value : '',
    nextStatus: event.nextStatus ? event.nextStatus.value : '',
  });

  // ルールに従って確認ダイアログを表示し、ユーザーがOK以外を選んだ場合は false を返す
  // (呼び出し元でそのままreturnすれば処理がキャンセルされる、idea.mdの「対象イベント」表参照)。
  const confirmOrCancel = async (triggerEvent, event) => {
    const rule = NS.RuleLookup.findRule(config.rules, triggerEvent);
    // ルールが設定されていない対象イベントでは、確認せずそのまま処理を続行する。
    if (!rule) {
      return true;
    }

    const context = buildContext(event);
    const result = await kintone.showConfirmDialog({
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

  kintone.events.on(EVENT_TYPES.INDEX_DELETE_SUBMIT, async (event) => {
    const proceed = await confirmOrCancel('INDEX_DELETE_SUBMIT', event);
    return proceed ? event : false;
  });

  kintone.events.on(EVENT_TYPES.PROCESS_PROCEED, async (event) => {
    const proceed = await confirmOrCancel('PROCESS_PROCEED', event);
    return proceed ? event : false;
  });
})(window, kintone);
