(function (global, kintone) {
  'use strict';

  const NS = global.SubtableCrossAppInsert;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 保存(submit)時: 発動条件を満たせば転送し、失敗したら保存自体を中止する
  // (plugin_idea_plan.md「1. サブテーブル別アプリ挿入プラグイン」で確定した仕様。
  // 「保存済みなのに転送されていない」状態を避けるため、REST失敗はevent.errorで保存をブロックする)。
  const handleSubmit = async (event) => {
    const config = loadConfig();
    if (!NS.ConfigStore.isComplete(config) || !config.triggerOnSubmit) {
      return event;
    }
    try {
      await NS.TransferService.runOnSubmit(config, event.record);
    } catch (err) {
      // kintoneのイベントオブジェクトはこのハンドラー呼び出し内でのみ使われ、
      // 同一イベントに対して並行して書き換えられることはないため、
      // require-atomic-updates(await後のプロパティ書き換え)の警告は無視してよい。
      // eslint-disable-next-line require-atomic-updates
      event.error = `サブテーブルの転送に失敗したため保存を中止しました: ${err.message || err}`;
    }
    return event;
  };

  kintone.events.on('app.record.create.submit', handleSubmit);
  kintone.events.on('app.record.edit.submit', handleSubmit);

  // 詳細画面: 手動転送ボタンを設置する。ボタンの設置先はプラグイン設定で指定された
  // スペースフィールド(kintone.app.record.getSpaceElement)。管理者がフォームに
  // 対応するスペースフィールドを配置していない場合は、要素が取得できず何もしない
  // (画面をクラッシュさせない。判断記録.md参照)。
  kintone.events.on('app.record.detail.show', (event) => {
    const config = loadConfig();
    if (
      !NS.ConfigStore.isComplete(config) ||
      !config.triggerOnManual ||
      !config.manualSpaceElementId
    ) {
      return event;
    }

    const spaceEl = kintone.app.record.getSpaceElement(
      config.manualSpaceElementId,
    );
    if (!spaceEl) {
      return event;
    }
    spaceEl.innerHTML = '';

    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'scai-manual-transfer-button kintoneplugin-button-normal';
    button.textContent = 'サブテーブルを別アプリへ転送';
    button.addEventListener('click', () => {
      NS.ManualDialog.openTransferDialog(config, event.record).catch((err) => {
        kintone.showNotification(
          'ERROR',
          `転送処理でエラーが発生しました: ${err.message || err}`,
        );
      });
    });
    spaceEl.appendChild(button);

    return event;
  });
})(window, kintone);
