(function (global, kintone) {
  'use strict';

  const NS = global.RecordsToSubtable;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 取得元アプリID・書き込み先サブテーブル・フィールドマッピングが未設定の場合は、
  // まだ管理者がこのアプリ向けにプラグインを設定していない(またはgetConfig()が取得できなかった)
  // ということなので、何もせず処理を抜ける(画面全体をクラッシュさせない)。
  const isConfigured = (config) =>
    Boolean(
      config.sourceAppId &&
      config.subtableFieldCode &&
      config.fieldMappings.length > 0,
    );

  const removeAllChildren = (el) => {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  };

  const buildResultMessage = (result, config) => {
    if (result.truncated) {
      return `上限件数(${config.maxRecords}件)に達したため、先頭${result.keptCount}件のみ取り込みました。保存すると反映されます。`;
    }
    return `${result.keptCount}件のレコードを取り込みました。保存すると反映されます。`;
  };

  const attachImportButton = (event) => {
    const config = loadConfig();
    if (!isConfigured(config)) {
      return event;
    }

    const spaceEl = kintone.app.record.getHeaderMenuSpaceElement();
    if (!spaceEl) {
      return event;
    }
    removeAllChildren(spaceEl);

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal';
    // ユーザー入力(設定画面で入力したボタンラベル)をtextContentで出力し、innerHTMLは使わない
    // (secureCodingGuideline.mdのXSS対策に準拠)。
    buttonEl.textContent =
      config.buttonLabel || NS.ConfigStore.DEFAULTS.buttonLabel;

    buttonEl.addEventListener('click', () => {
      buttonEl.disabled = true;
      kintone.showLoading('VISIBLE');
      NS.ImportRunner.runImport(config, kintone.app.record)
        .then((result) => {
          window.alert(buildResultMessage(result, config));
        })
        .catch((err) => {
          window.alert(
            'レコードの取り込みに失敗しました: ' +
              (err && err.message ? err.message : String(err)),
          );
        })
        .finally(() => {
          buttonEl.disabled = false;
          kintone.showLoading('HIDDEN');
        });
    });

    spaceEl.appendChild(buttonEl);
    return event;
  };

  // 実行タイミングはボタン起点(追加/編集画面)に限定する(plugin_idea_plan.mdの確定判断)。
  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    attachImportButton,
  );
})(window, kintone);
