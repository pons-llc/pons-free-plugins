(function (global, kintone) {
  'use strict';

  const NS = global.RecordsToSubtable;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const loadConfig = () =>
    NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

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

  // kintone.mobile.app.getHeaderSpaceElement()はレコード一覧・詳細・追加・編集のすべての画面で
  // 有効なため、このイベントハンドラー自体をcreate.show/edit.showのみに限定することで、
  // 対象画面以外(一覧・詳細)にはボタンを設置しない。
  const attachImportButton = (event) => {
    const config = loadConfig();
    if (!isConfigured(config)) {
      return event;
    }

    const spaceEl = kintone.mobile.app.getHeaderSpaceElement();
    if (!spaceEl) {
      return event;
    }
    removeAllChildren(spaceEl);

    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'kintoneplugin-button-normal';
    buttonEl.textContent =
      config.buttonLabel || NS.ConfigStore.DEFAULTS.buttonLabel;

    buttonEl.addEventListener('click', () => {
      buttonEl.disabled = true;
      kintone.mobile.showLoading('VISIBLE');
      NS.ImportRunner.runImport(config, kintone.mobile.app.record)
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
          kintone.mobile.showLoading('HIDDEN');
        });
    });

    spaceEl.appendChild(buttonEl);
    return event;
  };

  kintone.events.on(
    ['mobile.app.record.create.show', 'mobile.app.record.edit.show'],
    attachImportButton,
  );
})(window, kintone);
